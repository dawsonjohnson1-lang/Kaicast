// provisionCharterOperator — one-shot self-service tool that flips
// the caller's user doc to a charter account and seeds a fresh
// charter_accounts/{orgId} document with sensible defaults.
//
// Restricted by an email allowlist hard-coded below — this is dev
// infrastructure, not a permanent self-serve flow. When the real
// onboarding flow lands (manual review + billing), this function
// gets deleted.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Lower-cased — we compare against request.auth.token.email.toLowerCase().
// Add emails here to whitelist additional charter pilots.
const ALLOWED_EMAILS = new Set([
  'dawson@immersion.design',
]);

// Minimal org seed — the rest of the operations profile (fleet,
// harbors, operationsProfile, contact info) is gathered by the 5-step
// onboarding wizard at /charter/setup, which runs as the user's first
// view after provisioning. We seed setupComplete=false explicitly so
// the gate routes them straight into onboarding.
const ORG_DEFAULTS = {
  name: 'New Charter Org',
  setupComplete: false,
  // v1 legacy fields kept so any code still reading them doesn't crash;
  // the wizard overwrites these on Launch.
  homeHarbor: { name: '', lat: 0, lng: 0 },
  tripTypes: [],
};

exports.provisionCharterOperator = onCall(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in first, then re-run.');
    }
    const uid = req.auth.uid;
    const email = String(req.auth.token?.email ?? '').toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      logger.warn('[provision] denied — email not on allowlist', { email, uid });
      throw new HttpsError(
        'permission-denied',
        `${email || '(no email)'} is not on the charter-operator provisioning allowlist.`,
      );
    }

    const data = (req.data || {});
    const orgId = String(data.orgId || 'immersion-design').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(orgId)) {
      throw new HttpsError('invalid-argument', `Invalid orgId "${orgId}" — must be 2-41 lowercase alphanumeric/hyphen chars.`);
    }

    const db = admin.firestore();

    // 1. Flip the caller's user doc to a charter account.
    await db.collection('users').doc(uid).set({
      accountType: 'charter',
      orgId,
    }, { merge: true });

    // 2. Create or update the charter_accounts org doc.
    const orgRef = db.collection('charter_accounts').doc(orgId);
    const existing = await orgRef.get();
    if (!existing.exists) {
      await orgRef.set({
        ...ORG_DEFAULTS,
        name: data.orgName || ORG_DEFAULTS.name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Already exists — keep the existing fields, just ensure tripTypes
      // is populated for the wizard's defaults.
      await orgRef.set({
        tripTypes: existing.data()?.tripTypes || ORG_DEFAULTS.tripTypes,
      }, { merge: true });
    }

    // Demo content seeding was removed — the 5-step onboarding wizard
    // at /charter/setup now captures the real operations profile
    // (fleet, harbors, trip-type defaults) and the captain populates
    // their own spot library + crew roster afterwards.

    logger.info('[provision] charter operator provisioned', { uid, email, orgId });

    return {
      ok: true,
      uid,
      orgId,
      message: 'Charter operator provisioned. Reload /charter to enter the dashboard.',
    };
  },
);

// eslint-disable-next-line no-unused-vars
async function _legacySeedDemoSpots(db, orgId) {
  const spotsRef = db.collection('charter_accounts').doc(orgId).collection('spots');
  const existing = await spotsRef.limit(1).get();
  if (!existing.empty) return; // Don't re-seed an existing library.

  const demoSpots = [
    {
      name: 'Electric Beach Demo',
      lat: 21.355,
      lng: -158.140,
      isPrivate: false,
      linkedPublicSpotId: 'electric-beach',
      tripTypes: ['dive', 'snorkel'],
      maxGroupSize: 6,
      depthFt: 45,
      tidePreference: 'any',
      notes: "Seeded demo spot — Kahe Point warm-water outflow. Link is to KaiCast's public electric-beach so the sparkline reads from the real forecast.",
      goodWindowAlertsEnabled: true,
    },
    {
      name: "Sharks Cove Demo",
      lat: 21.6545,
      lng: -158.0651,
      isPrivate: false,
      linkedPublicSpotId: 'sharks-cove',
      tripTypes: ['snorkel', 'freedive'],
      maxGroupSize: 4,
      depthFt: 30,
      tidePreference: 'low',
      notes: 'Seeded demo spot — north shore tide-pool cove. Summer only.',
      goodWindowAlertsEnabled: true,
    },
    {
      name: 'Molokini Crater Demo',
      lat: 20.6323,
      lng: -156.496,
      isPrivate: false,
      linkedPublicSpotId: 'molokini-crater',
      tripTypes: ['dive', 'snorkel'],
      maxGroupSize: 8,
      depthFt: 80,
      tidePreference: 'slack',
      notes: 'Seeded demo spot — boat-only Maui crater dive.',
      goodWindowAlertsEnabled: false,
    },
  ];
  const now = admin.firestore.FieldValue.serverTimestamp();
  await Promise.all(demoSpots.map((s) => spotsRef.add({ ...s, createdAt: now, updatedAt: now })));
}

// eslint-disable-next-line no-unused-vars
async function _legacySeedDemoCrew(db, orgId) {
  const crewRef = db.collection('charter_accounts').doc(orgId).collection('crew');
  const existing = await crewRef.limit(1).get();
  if (!existing.empty) return;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const oneYearOut = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 86400000));
  const sixtyDaysOut = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 50 * 86400000));
  const demo = [
    {
      name: 'Dawson Johnson',
      role: 'owner',
      certs: [
        { type: 'USCG',       issuedBy: 'USCG NMC',    expiresAt: oneYearOut },
        { type: 'CPR',        issuedBy: 'Red Cross',   expiresAt: oneYearOut },
      ],
      uid: null,
    },
    {
      name: 'Kai Captain',
      role: 'captain',
      certs: [
        { type: 'USCG',       issuedBy: 'USCG NMC',    expiresAt: sixtyDaysOut }, // will glow amber as a demo
        { type: 'DiveMaster', issuedBy: 'PADI',        expiresAt: oneYearOut },
      ],
      uid: null,
    },
    {
      name: 'Lani Divemaster',
      role: 'divemaster',
      certs: [
        { type: 'DiveMaster', issuedBy: 'NAUI',        expiresAt: oneYearOut },
        { type: 'O2Provider', issuedBy: 'DAN',         expiresAt: oneYearOut },
      ],
      uid: null,
    },
  ];
  await Promise.all(demo.map((c) => crewRef.add({ ...c, createdAt: now, updatedAt: now })));
}
