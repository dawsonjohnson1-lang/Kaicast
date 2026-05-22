/**
 * userStats — aggregate /users/{uid}/stats/summary on every diveLogs write.
 *
 * Both mobile and desktop clients READ /users/{uid}/stats/summary directly
 * (per the unified schema; see CHANGES.md). Neither client should compute
 * stats from diveLogs at render time. This function is the only writer.
 *
 * Trigger: onDocumentWritten on diveLogs/{logId} (create, update, delete).
 * Strategy: recompute the affected uid's full stats every time. The corpus
 * per user is tiny (<5k logs in the worst case for a power user), so the
 * full recompute is cheaper than maintaining incremental counters with
 * transactional update semantics.
 *
 * Output doc /users/{uid}/stats/summary fields (per spec):
 *   - totalDives:       number
 *   - totalBottomTime:  number  (seconds)
 *   - deepestDive:      number  (feet)
 *   - longestDive:      number  (seconds)
 *   - speciesCount:     number  (placeholder 0 until species capture lands)
 *   - spotsLogged:      number  (unique spotId count)
 *   - currentStreak:    number  (consecutive HST days ending today)
 *   - updatedAt:        Timestamp (server)
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// HST is UTC-10, no DST — matches the diver's mental model and the
// archiveHourly day-bucketing convention documented in CLAUDE.md.
const HST_OFFSET_MS = -10 * 60 * 60 * 1000;

exports.aggregateUserStats = onDocumentWritten(
  {
    document: 'diveLogs/{logId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data?.before?.data?.();
    const after = event.data?.after?.data?.();
    // Affected uid comes from the surviving snapshot (after for create/update,
    // before for delete). When both exist and disagree (a uid edit, which
    // shouldn't happen since logs are immutable), recompute both — cheap.
    const uids = new Set();
    if (after?.uid) uids.add(after.uid);
    if (before?.uid) uids.add(before.uid);

    if (uids.size === 0) {
      logger.warn('[userStats] write with no uid on either side; skipping', {
        logId: event.params.logId,
      });
      return;
    }

    await Promise.all([...uids].map(recomputeStatsForUser));
  },
);

async function recomputeStatsForUser(uid) {
  const db = admin.firestore();
  const snap = await db.collection('diveLogs').where('uid', '==', uid).get();

  let totalDives = 0;
  let totalBottomTimeSec = 0;
  let deepestDiveFt = 0;
  let longestDiveSec = 0;
  const spotIds = new Set();
  const diveDateKeys = new Set();

  for (const doc of snap.docs) {
    const d = doc.data();
    totalDives += 1;

    // Duration may be stored on the top-level legacy `durationMin` field
    // OR (preferred) on the server-normalized `observed.duration_min`
    // field written by submitDiveLog. Prefer the canonical server field.
    const durMin = pickNumber(d?.observed?.duration_min, d?.durationMin);
    if (durMin != null) {
      const sec = Math.max(0, Math.round(durMin * 60));
      totalBottomTimeSec += sec;
      if (sec > longestDiveSec) longestDiveSec = sec;
    }

    // Depth: scuba.maxDepthFt > legacy depthFt > observed.max_depth_ft.
    // submitDiveLog stores scuba payloads under `scuba.*` per the schema
    // in functions/types/schema.js.
    const depthFt = pickNumber(
      d?.scuba?.maxDepthFt,
      d?.observed?.max_depth_ft,
      d?.depthFt,
    );
    if (depthFt != null && depthFt > deepestDiveFt) {
      deepestDiveFt = depthFt;
    }

    if (typeof d.spotId === 'string' && d.spotId.length > 0) {
      spotIds.add(d.spotId);
    }

    // Streak counts unique HST calendar days a dive was logged on.
    const ts = d.loggedAt;
    const date = ts?.toDate?.() ?? (typeof ts === 'number' ? new Date(ts) : null);
    if (date instanceof Date && Number.isFinite(date.getTime())) {
      diveDateKeys.add(toHstDateKey(date));
    }
  }

  const currentStreak = computeCurrentStreak(diveDateKeys);

  const statsDoc = {
    totalDives,
    totalBottomTime: totalBottomTimeSec,
    deepestDive: deepestDiveFt,
    longestDive: longestDiveSec,
    // Species capture isn't in the diveLogs schema yet (CLAUDE.md notes
    // species tracking is a future tier-3 field). Holding the field with
    // 0 so the client can render the slot without conditional logic.
    speciesCount: 0,
    spotsLogged: spotIds.size,
    currentStreak,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection('users')
    .doc(uid)
    .collection('stats')
    .doc('summary')
    .set(statsDoc, { merge: true });

  logger.info('[userStats] recomputed', { uid, totalDives, spotsLogged: spotIds.size });
}

function pickNumber(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
  }
  return null;
}

function toHstDateKey(date) {
  // Shift to HST then read UTC fields — gives the local HST calendar day
  // without DST complications.
  const shifted = new Date(date.getTime() + HST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeCurrentStreak(dateKeys) {
  if (dateKeys.size === 0) return 0;
  const todayKey = toHstDateKey(new Date());
  // Walk backward from today, counting days that have an entry. The
  // streak breaks the first day with no log.
  let streak = 0;
  let cursor = new Date(parseHstKey(todayKey).getTime());
  // If there's no entry for today, allow yesterday to start the streak
  // (so a streak doesn't drop to 0 just because today hasn't happened
  // yet). Mirrors how GitHub's contribution streak counts.
  if (!dateKeys.has(toHstDateKey(cursor))) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    if (!dateKeys.has(toHstDateKey(cursor))) return 0;
  }
  while (dateKeys.has(toHstDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

function parseHstKey(key) {
  // key is 'YYYY-MM-DD' in HST. Build a UTC Date for that HST midnight
  // so the daily walk above can subtract 24h cleanly.
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d) - HST_OFFSET_MS);
}
