// One-shot backfill: stamp the rule-checkable `public` boolean onto
// existing diveLogs docs. The submitDiveLog callable now writes
// `public: privacy === 'public'` on every new log; this script brings
// the pre-existing corpus (both the snake_case callable docs written
// before the flag and the legacy camelCase client-written docs) in
// line so the spot / friends feeds can query `public == true` and the
// firestore.rules read clause matches.
//
// privacy semantics: 'public' → public: true; 'friends' and 'private'
// (and docs with no privacy field at all) → public: false. 'friends'
// stays non-public until a follower-graph rule ships.
//
// Run once with the service account:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-adminsdk.json \
//     node scripts/backfill-divelogs-public.mjs
//
// Idempotent — docs that already carry the correct flag are skipped.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_SIZE = 200;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function backfill() {
  const ref = db.collection('diveLogs');
  let scanned = 0;
  let updated = 0;
  let last = null;

  while (true) {
    let q = ref.orderBy('__name__').limit(BATCH_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let dirty = 0;
    for (const d of snap.docs) {
      scanned += 1;
      const data = d.data();
      const want = data.privacy === 'public';
      if (data.public !== want) {
        batch.update(d.ref, { public: want });
        dirty += 1;
      }
    }
    if (dirty > 0) {
      await batch.commit();
      updated += dirty;
    }
    last = snap.docs[snap.docs.length - 1];
    process.stdout.write(`  scanned ${scanned}, updated ${updated}\r`);
    if (snap.size < BATCH_SIZE) break;
  }
  console.log(`\ndone — scanned ${scanned}, updated ${updated}`);
}

backfill().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
