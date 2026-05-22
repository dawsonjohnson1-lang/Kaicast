/**
 * restructure_settings_schema — fold every /users/{uid} doc into the
 * unified Settings shape used by both clients.
 *
 * Compounds three things in one pass so we only sweep prod once:
 *
 *   1. Rename `name`        → `displayName`
 *      Rename `photoUrl`    → `photoURL`
 *      (carried over from unify_user_schema.js — that script becomes
 *      redundant once this runs; we keep it around for projects that
 *      ran it independently.)
 *
 *   2. Move loose profile fields under `profile.*`:
 *      - `certification`             → `profile.certification`
 *      - first item of `activities`  → `profile.preferredDiveType`
 *        (heuristic — see WARNING below)
 *      - `homeSpot`                  → `profile.homeSpotId`
 *        (heuristic — existing `homeSpot` is sometimes a spotId, more
 *         often a free-text name; the script flags ambiguous values
 *         instead of guessing.)
 *
 *   3. Initialize `prefs.*` and `meta.*` namespaces with the
 *      DEFAULT_USER_SETTINGS values. Existing prefs/meta keys are
 *      preserved.
 *
 * Usage:
 *   node functions/migrations/restructure_settings_schema.js
 *     # dry-run; logs proposed changes
 *
 *   node functions/migrations/restructure_settings_schema.js --commit
 *     # writes to prod
 *
 *   node functions/migrations/restructure_settings_schema.js --commit --delete-legacy
 *     # also drops the old top-level `name`/`photoUrl`/`certification`/
 *     # `activities[0]`/`homeSpot` keys after writing the new ones.
 *     # ONLY do this after every deployed client is reading the new
 *     # shape — both clients currently read either, so it's safe once
 *     # the Settings PR ships.
 *
 * WARNING — homeSpot mapping:
 *   The existing `homeSpot` field on mobile-created user docs is a
 *   free-text string ("Three Tables, O'ahu") more often than a
 *   canonical spotId ("three-tables"). The script tries to resolve it
 *   to a spotId from the /spots collection by name match; failures are
 *   logged and skipped (the field stays empty under profile.homeSpotId
 *   so the user can pick one in the Settings UI). Audit the dry-run
 *   log for any user where this matters.
 *
 * Auth: relies on GOOGLE_APPLICATION_CREDENTIALS or `firebase login`.
 */

const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const {
  CERTIFICATION_VALUES,
  PREFERRED_DIVE_TYPE_VALUES,
  DEFAULT_USER_SETTINGS,
} = require('../shared/userSettings');

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DELETE_LEGACY = args.has('--delete-legacy');
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

if (DELETE_LEGACY && !COMMIT) {
  console.error('--delete-legacy requires --commit');
  process.exit(2);
}

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: PROJECT });
}

async function main() {
  const db = admin.firestore();
  console.log(`[migrate] ${COMMIT ? 'COMMIT' : 'DRY-RUN'} mode`);
  console.log(`[migrate] project: ${PROJECT ?? '(default ADC)'}`);
  if (DELETE_LEGACY) {
    console.log('[migrate] --delete-legacy enabled — will drop superseded top-level keys');
  }
  console.log('');

  // Pre-build a name→id index for homeSpot string → spotId resolution.
  const spotsByName = new Map();
  const spotsSnap = await db.collection('spots').get();
  for (const s of spotsSnap.docs) {
    const data = s.data();
    if (typeof data.name === 'string') {
      spotsByName.set(data.name.toLowerCase().trim(), s.id);
    }
  }
  console.log(`[migrate] indexed ${spotsByName.size} spots for homeSpot resolution`);

  const snap = await db.collection('users').get();
  console.log(`[migrate] scanning ${snap.size} user docs`);
  console.log('');

  let changed = 0;
  let skipped = 0;
  let homeSpotAmbiguous = 0;
  const batches = [];
  let current = db.batch();
  let currentCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};
    const reasons = [];

    // ── 1. name/photoUrl rename (idempotent with unify_user_schema.js)
    if (typeof data.name === 'string' && !data.displayName) {
      patch.displayName = data.name;
      reasons.push(`displayName <- name`);
    }
    if (typeof data.photoUrl === 'string' && !data.photoURL) {
      patch.photoURL = data.photoUrl;
      reasons.push(`photoURL <- photoUrl`);
    }

    // ── 2. Move into profile.*
    const profile = data.profile || {};

    if (!profile.certification) {
      // Existing `certification` is unconstrained string. Coerce to
      // a known enum value if we can — otherwise default to 'none'.
      const raw = typeof data.certification === 'string'
        ? data.certification.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        : '';
      const matched = CERTIFICATION_VALUES.find((v) => raw.includes(v.split('_').pop())) || null;
      if (matched) {
        patch['profile.certification'] = matched;
        reasons.push(`profile.certification <- "${data.certification}" → ${matched}`);
      } else if (data.certification) {
        patch['profile.certification'] = DEFAULT_USER_SETTINGS.profile.certification;
        reasons.push(`profile.certification <- DEFAULT (unparseable "${data.certification}")`);
      } else {
        patch['profile.certification'] = DEFAULT_USER_SETTINGS.profile.certification;
        reasons.push(`profile.certification <- DEFAULT`);
      }
    }

    if (!profile.preferredDiveType) {
      const acts = Array.isArray(data.activities) ? data.activities : [];
      const first = typeof acts[0] === 'string' ? acts[0].toLowerCase() : '';
      const matched = PREFERRED_DIVE_TYPE_VALUES.find((v) => first.includes(v));
      patch['profile.preferredDiveType'] =
        matched || DEFAULT_USER_SETTINGS.profile.preferredDiveType;
      reasons.push(
        `profile.preferredDiveType <- ${matched ? `activities[0] (${first})` : 'DEFAULT'}`,
      );
    }

    // Check for field presence, not truthiness — an empty string ""
    // is a valid "user hasn't picked a spot yet" sentinel and should
    // count as already-canonical on re-runs.
    if (typeof profile.homeSpotId !== 'string') {
      const hs = typeof data.homeSpot === 'string' ? data.homeSpot.trim() : '';
      if (hs.length === 0) {
        // Leave empty — the Settings UI will prompt for selection.
        patch['profile.homeSpotId'] = '';
        reasons.push(`profile.homeSpotId <- (empty)`);
      } else if (/^[a-z0-9-]+$/.test(hs) && spotsByName.has(hs.toLowerCase())) {
        // Looks like a slug AND matches a known spot — use as-is.
        patch['profile.homeSpotId'] = hs;
        reasons.push(`profile.homeSpotId <- ${hs} (slug match)`);
      } else {
        // Try name match.
        const resolved = spotsByName.get(hs.toLowerCase());
        if (resolved) {
          patch['profile.homeSpotId'] = resolved;
          reasons.push(`profile.homeSpotId <- ${resolved} (name match for "${hs}")`);
        } else {
          patch['profile.homeSpotId'] = '';
          reasons.push(`profile.homeSpotId <- (empty) // "${hs}" did not resolve — diver picks one in Settings`);
          homeSpotAmbiguous += 1;
        }
      }
    }

    // ── 3. prefs.* defaults
    const prefs = data.prefs || {};
    const pn = prefs.pushNotifications || {};
    const cats = pn.categories || {};

    if (typeof pn.enabled !== 'boolean') {
      patch['prefs.pushNotifications.enabled'] =
        DEFAULT_USER_SETTINGS.prefs.pushNotifications.enabled;
      reasons.push('prefs.pushNotifications.enabled <- DEFAULT');
    }
    if (typeof cats.conditionAlerts !== 'boolean') {
      patch['prefs.pushNotifications.categories.conditionAlerts'] =
        DEFAULT_USER_SETTINGS.prefs.pushNotifications.categories.conditionAlerts;
      reasons.push('prefs.pushNotifications.categories.conditionAlerts <- DEFAULT');
    }
    if (typeof cats.friendReports !== 'boolean') {
      patch['prefs.pushNotifications.categories.friendReports'] =
        DEFAULT_USER_SETTINGS.prefs.pushNotifications.categories.friendReports;
      reasons.push('prefs.pushNotifications.categories.friendReports <- DEFAULT');
    }
    if (typeof cats.system !== 'boolean') {
      patch['prefs.pushNotifications.categories.system'] =
        DEFAULT_USER_SETTINGS.prefs.pushNotifications.categories.system;
      reasons.push('prefs.pushNotifications.categories.system <- DEFAULT');
    }
    if (!prefs.units) {
      patch['prefs.units'] = DEFAULT_USER_SETTINGS.prefs.units;
      reasons.push('prefs.units <- DEFAULT');
    }

    // ── 4. meta stamp
    const meta = data.meta || {};
    if (!meta.updatedAt) {
      patch['meta.updatedAt'] = FieldValue.serverTimestamp();
      patch['meta.updatedBy'] = 'migration';
      reasons.push('meta.updatedAt/updatedBy <- now/migration');
    }

    // ── 5. phone scaffold (empty string is acceptable)
    if (typeof data.phone !== 'string') {
      patch.phone = '';
      reasons.push('phone <- ""');
    }

    // ── 6. delete legacy if requested
    if (DELETE_LEGACY) {
      const drops = [];
      if (data.name && (data.displayName || patch.displayName))      { patch.name = FieldValue.delete(); drops.push('name'); }
      if (data.photoUrl && (data.photoURL || patch.photoURL))         { patch.photoUrl = FieldValue.delete(); drops.push('photoUrl'); }
      if (data.certification && patch['profile.certification'])       { patch.certification = FieldValue.delete(); drops.push('certification (top-level)'); }
      if (data.homeSpot)                                              { patch.homeSpot = FieldValue.delete(); drops.push('homeSpot (top-level)'); }
      if (drops.length) reasons.push(`delete legacy: ${drops.join(', ')}`);
    }

    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    changed += 1;
    console.log(`[migrate] users/${doc.id}`);
    for (const r of reasons) console.log(`           - ${r}`);

    if (COMMIT) {
      current.update(doc.ref, patch);
      currentCount += 1;
      if (currentCount >= 400) {
        batches.push(current);
        current = db.batch();
        currentCount = 0;
      }
    }
  }

  if (COMMIT && currentCount > 0) batches.push(current);

  console.log('');
  console.log(`[migrate] ${changed} would change, ${skipped} already canonical`);
  if (homeSpotAmbiguous > 0) {
    console.log(`[migrate] ${homeSpotAmbiguous} users had unresolvable homeSpot values`);
    console.log(`[migrate]   → these users will see "Pick a spot" in Settings; this is intentional`);
  }

  if (COMMIT) {
    console.log(`[migrate] committing ${batches.length} batch(es)…`);
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`[migrate]   batch ${i + 1}/${batches.length} committed`);
    }
    console.log('[migrate] done');
  } else {
    console.log('[migrate] dry-run only — pass --commit to write');
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
