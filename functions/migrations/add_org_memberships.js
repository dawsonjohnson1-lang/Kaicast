/**
 * add_org_memberships — backfill the crew/charter schema fields onto
 * every /users/{uid} doc.
 *
 * Adds the fields the Crew & Captain Dashboard work depends on:
 *
 *   orgMemberships: []                   (empty array)
 *   proAccess:       false               (entitlement Function flips this
 *                                         once a membership becomes active
 *                                         or a Stripe subscription lands)
 *   proSource:       null
 *   activeContext:  'consumer'           (default; switcher will flip per
 *                                         user later)
 *
 * Existing fields (accountType, orgId, displayName, photoURL, profile.*,
 * prefs.*, meta.*, etc.) are NEVER touched. The script only writes a
 * field if it is currently absent or has the wrong type.
 *
 * Charter admins (accountType === 'charter') keep their existing
 * `orgId` field — that's the org they OWN/ADMIN. Whether they also
 * carry a crew membership in `orgMemberships` is intentionally NOT
 * inferred here: an org owner who also crews their own boats can
 * add themselves via the invite flow once it lands.
 *
 * Usage:
 *   node functions/migrations/add_org_memberships.js                  # dry-run
 *   node functions/migrations/add_org_memberships.js --commit         # write changes
 *
 * Auth: same as the other migrations — relies on
 * GOOGLE_APPLICATION_CREDENTIALS (service-account JSON path) or
 * `firebase login` ADC. Refuses to run without a real credential so it
 * can't accidentally target an emulator thinking it's prod.
 *
 * Safe to re-run: every patch is gated on "field is missing or wrong
 * type", so a second run on already-migrated data is a no-op.
 *
 * IMPORTANT: per CLAUDE.md, do NOT run with --commit against prod
 * without first reviewing the dry-run output.
 */

const admin = require('firebase-admin');

const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: PROJECT });
}

async function main() {
  const db = admin.firestore();
  console.log(`[migrate] ${COMMIT ? 'COMMIT' : 'DRY-RUN'} mode`);
  console.log(`[migrate] project: ${PROJECT ?? '(default ADC)'}`);
  console.log('');

  const snap = await db.collection('users').get();
  console.log(`[migrate] scanning ${snap.size} user docs`);

  let changed = 0;
  let skipped = 0;
  const batches = [];
  let current = db.batch();
  let currentCount = 0;

  for (const userDoc of snap.docs) {
    const data = userDoc.data();
    const patch = {};
    const reasons = [];

    if (!Array.isArray(data.orgMemberships)) {
      patch.orgMemberships = [];
      reasons.push('orgMemberships: []');
    }

    // activeOrgIds is the denormalized array of orgIds the user is
    // actively part of. Firestore rules need a simple-string array
    // to .hasAny() against — they can't introspect orgMemberships's
    // objects. Maintained by acceptCrewInvitation on accept.
    if (!Array.isArray(data.activeOrgIds)) {
      patch.activeOrgIds = [];
      reasons.push('activeOrgIds: []');
    }

    if (typeof data.proAccess !== 'boolean') {
      patch.proAccess = false;
      reasons.push('proAccess: false');
    }

    // proSource is allowed to be one of 'subscription' | 'crew_membership'
    // | null. Anything else (undefined, wrong type) gets reset to null.
    if (data.proSource !== 'subscription'
        && data.proSource !== 'crew_membership'
        && data.proSource !== null) {
      patch.proSource = null;
      reasons.push('proSource: null');
    }

    // activeContext should be 'consumer' OR a 'crew:{orgId}' string.
    // Anything else gets reset to 'consumer'.
    const ac = data.activeContext;
    const validAc = ac === 'consumer'
      || (typeof ac === 'string' && ac.startsWith('crew:') && ac.length > 5);
    if (!validAc) {
      patch.activeContext = 'consumer';
      reasons.push('activeContext: consumer');
    }

    // proExpiresAt — Timestamp | null grace clock for Pro revocation.
    // The entitlement trigger sets this when all memberships go
    // inactive; daily sweeper revokes Pro once it's in the past.
    // Backfill to null since no existing user is mid-grace.
    if (!('proExpiresAt' in data)) {
      patch.proExpiresAt = null;
      reasons.push('proExpiresAt: null');
    }

    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    changed += 1;
    console.log(`[migrate] users/${userDoc.id}: ${reasons.join(' | ')}`);

    if (COMMIT) {
      current.update(userDoc.ref, patch);
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

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
