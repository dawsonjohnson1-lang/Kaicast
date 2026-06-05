// syncFareHarborTripsCallable — on-demand version of the scheduled
// FareHarbor sync. The captain triggers this from the Daily Log
// "refresh" gesture when they want fresh data without waiting for the
// next 30-minute scheduler tick.
//
// Auth: caller must be signed in AND have users/{uid}.orgId === orgId.
// We don't allow cross-org pulls — only your own integration.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const { syncOneCharter } = require('./sync');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const FAREHARBOR_APP_KEY = defineSecret('FAREHARBOR_APP_KEY');

exports.syncFareHarborTripsCallable = onCall(
  {
    region: 'us-central1',
    cors: true,
    secrets: [FAREHARBOR_APP_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const orgId = String(req.data?.orgId || '').trim();
    if (!orgId) throw new HttpsError('invalid-argument', 'orgId is required.');

    const db = admin.firestore();

    // Verify the caller belongs to this org.
    const userSnap = await db.collection('users').doc(uid).get();
    const callerOrg = userSnap.data()?.orgId;
    if (callerOrg !== orgId) {
      throw new HttpsError('permission-denied', 'Not a member of this charter.');
    }

    // Load the integration doc — same shape the cron reads.
    const intRef = db.collection('charter_accounts').doc(orgId)
      .collection('integrations').doc('fareharbor');
    const intSnap = await intRef.get();
    if (!intSnap.exists) {
      throw new HttpsError('failed-precondition', 'FareHarbor not connected for this charter.');
    }

    try {
      const result = await syncOneCharter(db, orgId, intSnap.data());
      await intRef.set({
        lastSync: admin.firestore.FieldValue.serverTimestamp(),
        syncStatus: 'ok',
        errorMsg: null,
        tripCount: result.tripCount,
        itemCount: result.itemCount,
      }, { merge: true });
      logger.info('[fh-sync-callable] ok', { orgId, ...result });
      return { ok: true, ...result };
    } catch (err) {
      const msg = err?.message || String(err);
      await intRef.set({
        lastSync: admin.firestore.FieldValue.serverTimestamp(),
        syncStatus: 'error',
        errorMsg: msg,
      }, { merge: true });
      throw new HttpsError('internal', msg);
    }
  },
);
