// One-shot cleanup: delete the deprecated `abyss_diver_reports`
// collection. Data has been superseded by `diveLogs.deltas` +
// `diveLogs.predicted_at_time` (written by the new submitDiveLog
// callable). Firestore rules now fully deny client access — these
// docs are dead weight.
//
// Run once with the service account:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-adminsdk.json \
//     node scripts/drain-abyss-diver-reports.mjs
//
// Idempotent — safe to re-run. Logs each delete batch.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_SIZE = 200;
const TOP_COLLECTION = 'abyss_diver_reports';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function deleteCollection(path) {
  const ref = db.collection(path);
  let total = 0;
  while (true) {
    const snap = await ref.limit(BATCH_SIZE).get();
    if (snap.empty) return total;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    process.stdout.write(`  ${path}: ${total} deleted\r`);
    if (snap.size < BATCH_SIZE) return total;
  }
}

/**
 * `abyss_diver_reports/{spotId}/reports/{reportId}` has reports as a
 * subcollection — Firestore doesn't recursively delete docs that only
 * exist as parents of subcollections. We have to walk into each
 * spotId and drain reports first.
 */
async function main() {
  // Enumerate top-level docs (each spotId).
  const top = await db.collection(TOP_COLLECTION).listDocuments();
  console.log(`Found ${top.length} spotId doc(s) under ${TOP_COLLECTION}`);

  for (const spotDoc of top) {
    console.log(`spot ${spotDoc.id}:`);
    const subPath = `${TOP_COLLECTION}/${spotDoc.id}/reports`;
    const drained = await deleteCollection(subPath);
    process.stdout.write('\n');
    // Now delete the parent doc itself. May or may not exist as an
    // actual document (subcollection-parent docs are often empty).
    try {
      await spotDoc.delete();
      console.log(`  deleted parent doc, drained ${drained} reports`);
    } catch {
      console.log(`  drained ${drained} reports (no parent doc)`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('drain failed:', err);
  process.exit(1);
});
