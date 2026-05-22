// One-off: confirm aggregateUserStats has populated /users/{uid}/stats/summary
// in prod, and show the doc shape so we can sanity-check what useUserStats
// will read on both surfaces.
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'kaicast-207dc' });
const db = admin.firestore();

(async () => {
  // Find a few uids that have dive logs.
  const logsSnap = await db.collection('diveLogs').limit(20).get();
  const uids = Array.from(new Set(logsSnap.docs.map(d => d.data().uid).filter(Boolean)));
  console.log(`uids with dive logs (sample of ${logsSnap.size}):`, uids.length);
  if (uids.length === 0) {
    console.log('No dive logs in prod yet — nothing to verify against.');
    process.exit(0);
  }

  for (const uid of uids.slice(0, 5)) {
    const ref = db.collection('users').doc(uid).collection('stats').doc('summary');
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`\nuid=${uid}: NO stats/summary doc (trigger never ran?)`);
      continue;
    }
    const d = snap.data();
    const userLogs = await db.collection('diveLogs').where('uid', '==', uid).count().get();
    console.log(`\nuid=${uid}`);
    console.log(`  actual diveLogs count: ${userLogs.data().count}`);
    console.log(`  stats.totalDives:      ${d.totalDives}`);
    console.log(`  stats.deepestDive (ft):${d.deepestDive}`);
    console.log(`  stats.totalBottomTime (s): ${d.totalBottomTime}`);
    console.log(`  → bottom time hours:   ${(d.totalBottomTime / 3600).toFixed(2)}`);
    console.log(`  stats.spotsLogged:     ${d.spotsLogged}`);
    console.log(`  stats.currentStreak:   ${d.currentStreak}`);
    console.log(`  updatedAt:             ${d.updatedAt?.toDate?.().toISOString() ?? d.updatedAt}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
