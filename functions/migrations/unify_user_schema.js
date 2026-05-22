/**
 * unify_user_schema — rename legacy /users/{uid} fields to the unified schema.
 *
 *   name      →  displayName
 *   photoUrl  →  photoURL
 *
 * Other fields are left as-is. The mobile app's extra fields (firstName,
 * lastName, nickname, homeTown, homeSpot, activities, experienceLevel,
 * yearsActive, certification, onboardingComplete, …) all stay on the
 * top-level user doc per the decision in CHANGES.md.
 *
 * Usage:
 *   node functions/migrations/unify_user_schema.js                 # dry-run
 *   node functions/migrations/unify_user_schema.js --commit        # write changes
 *   node functions/migrations/unify_user_schema.js --commit --delete-legacy
 *     (drops the old `name`/`photoUrl` keys after writing the new ones —
 *      do this ONLY after every client has been deployed reading the new
 *      field names)
 *
 * Auth: relies on GOOGLE_APPLICATION_CREDENTIALS (service-account JSON
 * path) or `firebase login` ADC. Will refuse to run without a real
 * credential — no implicit emulator fallback so we can't accidentally
 * write to local data thinking it's prod.
 *
 * IMPORTANT: per CLAUDE.md and the goal-2 spec, do NOT run with --commit
 * against prod without first reviewing the dry-run output and confirming
 * with the team.
 */

const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DELETE_LEGACY = args.has('--delete-legacy');
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

if (DELETE_LEGACY && !COMMIT) {
  console.error('--delete-legacy requires --commit');
  process.exit(2);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: PROJECT,
  });
}

async function main() {
  const db = admin.firestore();
  console.log(`[migrate] ${COMMIT ? 'COMMIT' : 'DRY-RUN'} mode`);
  console.log(`[migrate] project: ${PROJECT ?? '(default ADC)'}`);
  if (DELETE_LEGACY) console.log('[migrate] will delete legacy `name` and `photoUrl` keys after rename');
  console.log('');

  const snap = await db.collection('users').get();
  console.log(`[migrate] scanning ${snap.size} user docs`);

  let changed = 0;
  let skipped = 0;
  const batches = [];
  let current = db.batch();
  let currentCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};
    const reasons = [];

    if (typeof data.name === 'string' && !data.displayName) {
      patch.displayName = data.name;
      reasons.push(`displayName <- name (${trunc(data.name)})`);
    }

    if (typeof data.photoUrl === 'string' && !data.photoURL) {
      patch.photoURL = data.photoUrl;
      reasons.push(`photoURL <- photoUrl (${trunc(data.photoUrl)})`);
    }

    if (DELETE_LEGACY) {
      if ('name' in data && data.displayName != null) {
        patch.name = FieldValue.delete();
        reasons.push('name (delete legacy)');
      }
      if ('photoUrl' in data && data.photoURL != null) {
        patch.photoUrl = FieldValue.delete();
        reasons.push('photoUrl (delete legacy)');
      }
    }

    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    changed += 1;
    console.log(`[migrate] users/${doc.id}: ${reasons.join(' | ')}`);

    if (COMMIT) {
      current.update(doc.ref, patch);
      currentCount += 1;
      // Firestore caps a batch at 500 ops.
      if (currentCount >= 400) {
        batches.push(current);
        current = db.batch();
        currentCount = 0;
      }
    }
  }

  if (COMMIT && currentCount > 0) {
    batches.push(current);
  }

  console.log('');
  console.log(`[migrate] ${changed} would change, ${skipped} already canonical`);

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

function trunc(s) {
  if (typeof s !== 'string') return String(s);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
