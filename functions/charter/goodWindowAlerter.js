// charterGoodWindowAlerter — Firestore trigger that watches every
// kaicast_reports/{docId} write (one per spot per hour) and fires a
// notification when a spot crosses from Fair/Poor into Good or
// better. Each subscribing charter org gets ONE alert doc per
// transition; the dashboard banner reads from
// charter_accounts/{orgId}/alerts/.
//
// We don't dedupe by "same tier in the next hour" — the cooldown
// logic skips alerts if any alert exists for the same charter spot
// within the past 24 hours. That stops a spot that bounces between
// Fair and Good every hour from filling the banner.
//
// Push notification via FCM is wired but no-ops when a user has no
// device tokens on file. The in-app alert doc is always written so
// the dashboard banner still surfaces it.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const GOOD_PLUS = new Set(['excellent', 'great', 'good']);
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

exports.charterGoodWindowAlerter = onDocumentCreated(
  {
    document: 'kaicast_reports/{reportId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    try {
      const docId = event.params.reportId;
      const parsed = parseReportId(docId);
      if (!parsed) {
        // Not a {spotId}_{hourKey} doc — skip silently. Some reports
        // are written with other id shapes (legacy / debug); we don't
        // want to throw on them.
        return;
      }
      const { spotId, hourKey } = parsed;
      const newData = event.data?.data();
      const newTier = tierLabel(newData?.now?.rating);
      if (!GOOD_PLUS.has(newTier)) return;

      // Compare against the previous hour's report.
      const prevHourKey = previousHourKey(hourKey);
      if (!prevHourKey) return;
      const db = admin.firestore();
      const prevSnap = await db.collection('kaicast_reports')
        .doc(`${spotId}_${prevHourKey}`)
        .get();
      if (!prevSnap.exists) return; // No comparison baseline.
      const prevTier = tierLabel(prevSnap.data()?.now?.rating);
      if (GOOD_PLUS.has(prevTier)) return; // Already was good — no transition.

      logger.info('[good-window] transition detected', {
        spotId, prevTier, newTier, hourKey,
      });

      // Find every charter spot subscribed to alerts for this public spot.
      const subscribed = await db.collectionGroup('spots')
        .where('linkedPublicSpotId', '==', spotId)
        .where('goodWindowAlertsEnabled', '==', true)
        .get();
      if (subscribed.empty) {
        logger.info('[good-window] no charter spots subscribed', { spotId });
        return;
      }

      const writes = [];
      // Spot docs that passed the cooldown — the push fan-out must use
      // this filtered list, not subscribed.docs, or cooled-down orgs
      // get re-pushed on every Fair→Good bounce.
      const eligibleSpotDocs = [];
      const cooldownCutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - ALERT_COOLDOWN_MS));
      for (const spotDoc of subscribed.docs) {
        // path: charter_accounts/{orgId}/spots/{charterSpotId}
        const segs = spotDoc.ref.path.split('/');
        const orgId = segs[1];
        const charterSpotId = spotDoc.id;
        const data = spotDoc.data();

        // Cooldown — skip if any recent alert for THIS charter spot.
        const recent = await db.collection('charter_accounts').doc(orgId)
          .collection('alerts')
          .where('charterSpotId', '==', charterSpotId)
          .where('createdAt', '>=', cooldownCutoff)
          .limit(1)
          .get();
        if (!recent.empty) {
          logger.info('[good-window] cooldown — skipping', { orgId, charterSpotId });
          continue;
        }

        eligibleSpotDocs.push(spotDoc);
        writes.push(
          db.collection('charter_accounts').doc(orgId)
            .collection('alerts')
            .add({
              kind: 'good-window',
              charterSpotId,
              charterSpotName: data.name || 'Unnamed spot',
              publicSpotId: spotId,
              previousTier: prevTier,
              newTier,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              read: false,
            }),
        );
      }
      await Promise.all(writes);
      if (eligibleSpotDocs.length === 0) {
        logger.info('[good-window] all subscribers cooling down', { spotId });
        return;
      }

      // FCM push — best-effort. When a charter user has registered a
      // device token via users/{uid}/devices/{tokenId} we send a push;
      // otherwise the in-app alert doc above is the only delivery
      // mechanism (the dashboard banner reads it).
      await fanOutPushNotifications(db, eligibleSpotDocs, spotId);

      logger.info('[good-window] alerts fired', { spotId, count: writes.length });
    } catch (err) {
      logger.error('charterGoodWindowAlerter failed', { error: err.message });
    }
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────

/** Convert the BackendRating-shaped `nowRating` to a normalized lower-
 *  case tier label. */
function tierLabel(rating) {
  if (!rating) return 'unknown';
  const raw = String(rating.label || rating.rating || '').toLowerCase();
  if (raw.includes('excellent')) return 'excellent';
  if (raw.includes('great'))     return 'great';
  if (raw.includes('good'))      return 'good';
  if (raw.includes('fair'))      return 'fair';
  if (raw.includes('no-go') || raw.includes('nogo')) return 'no-go';
  // Score-based fallback (matches desktop/data/getReport.ts).
  const s = rating.score;
  if (typeof s !== 'number') return 'unknown';
  if (s >= 80) return 'excellent';
  if (s >= 60) return 'great';
  if (s >= 40) return 'good';
  if (s >= 20) return 'fair';
  return 'no-go';
}

/** Parse a report doc id of shape `{spotId}_{YYYYMMDDHH}`. The hour
 *  key is the trailing 10-digit block; everything before the LAST
 *  underscore is the spot id (Hawaii spots have hyphens but no
 *  underscores, so this is robust). */
function parseReportId(docId) {
  const m = String(docId || '').match(/^(.+)_(\d{10})$/);
  if (!m) return null;
  return { spotId: m[1], hourKey: m[2] };
}

/** Step a YYYYMMDDHH key back by one hour. UTC arithmetic — matches
 *  buildHourKey() in functions/index.js which builds UTC keys. */
function previousHourKey(hourKey) {
  const m = hourKey.match(/^(\d{4})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const ms = Date.UTC(y, mo, d, h, 0, 0) - 3600 * 1000;
  const dt = new Date(ms);
  return (
    String(dt.getUTCFullYear()) +
    String(dt.getUTCMonth() + 1).padStart(2, '0') +
    String(dt.getUTCDate()).padStart(2, '0') +
    String(dt.getUTCHours()).padStart(2, '0')
  );
}

/** Fan FCM messages out to every charter user (accountType=='charter'
 *  AND orgId == one of the subscribing orgs) and every registered
 *  device under them. Best-effort — invalid tokens get a warning log,
 *  not a thrown error. */
async function fanOutPushNotifications(db, subscribedSpotDocs, spotId) {
  const orgIds = Array.from(new Set(subscribedSpotDocs.map((d) => d.ref.path.split('/')[1])));
  if (orgIds.length === 0) return;
  // Find charter users in each org.
  const allTokens = [];
  for (const orgId of orgIds) {
    const usersSnap = await db.collection('users')
      .where('accountType', '==', 'charter')
      .where('orgId', '==', orgId)
      .get();
    for (const userDoc of usersSnap.docs) {
      // Honor push prefs (see functions/shared/userSettings.js).
      // Default-allow when fields are missing, matching
      // DEFAULT_USER_SETTINGS where both default to true.
      const pushPrefs = userDoc.data()?.prefs?.pushNotifications;
      if (pushPrefs?.enabled === false || pushPrefs?.categories?.conditionAlerts === false) continue;
      const devicesSnap = await db.collection('users').doc(userDoc.id)
        .collection('devices').get();
      for (const dev of devicesSnap.docs) {
        const tok = dev.data()?.token;
        if (typeof tok === 'string' && tok.length > 0) allTokens.push(tok);
      }
    }
  }
  if (allTokens.length === 0) return;
  try {
    await admin.messaging().sendEachForMulticast({
      tokens: allTokens,
      notification: {
        title: 'Spot back in window',
        body: `A spot in your library is now Good or better. Plan a trip.`,
      },
      data: {
        kind: 'good-window',
        spotId,
      },
    });
  } catch (err) {
    logger.warn('[good-window] FCM fan-out failed', { error: err.message, tokenCount: allTokens.length });
  }
}
