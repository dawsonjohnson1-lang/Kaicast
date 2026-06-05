// Pro entitlement automation.
//
// Two functions live in this file:
//
//   onUserOrgMembershipsChanged
//     Firestore trigger on /users/{uid}. Watches orgMemberships +
//     proSource and keeps proAccess / proSource / proExpiresAt
//     consistent.
//
//     Inputs (the "after" snapshot of the user doc):
//       - orgMemberships  — array of {orgId, status, ...}
//       - proSource       — 'subscription' | 'crew_membership' | null
//       - proAccess       — boolean
//       - proExpiresAt    — Timestamp | null (grace clock)
//       - activeOrgIds    — denormalized string array (rules-friendly)
//
//     Behavior:
//       a. Any active membership AND proSource !== 'subscription'
//          → proAccess: true, proSource: 'crew_membership',
//            proExpiresAt: null (clears any pending grace clock).
//       b. Zero active memberships AND proSource === 'crew_membership'
//          AND proExpiresAt is null  → start grace clock at now+7d.
//          KEEP proAccess true and proSource crew_membership so the
//          user retains Pro through the grace window.
//       c. Subscription users are never touched.
//       d. activeOrgIds is self-healed to match orgMemberships's
//          active subset on every write — covers any future writer
//          that forgets to maintain the denormalization.
//
//     The trigger is safe against feedback loops: it only writes when
//     the computed patch actually differs from the current state, so a
//     second invocation by its own write produces an empty patch and
//     stops.
//
//   revokeExpiredCrewPro
//     Scheduled function (daily, 03:00 HST). Queries users where
//     proSource === 'crew_membership' AND proExpiresAt is in the past
//     AND no active memberships remain → flips proAccess to false,
//     clears proSource + proExpiresAt. Runs in HST so the cron lines
//     up with the diver-facing timezone.
//
// The acceptCrewInvitation callable still inline-sets proAccess +
// proSource at accept time so the user gets Pro instantly without
// waiting for the trigger to fire. The trigger reconciles afterward
// (empty patch, no extra write) and remains the single source of
// truth for the leave-org / grace-revoke paths.

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ─── onUserOrgMembershipsChanged ─────────────────────────────────────

exports.onUserOrgMembershipsChanged = onDocumentWritten(
  {
    document: 'users/{uid}',
    region: 'us-central1',
  },
  async (event) => {
    // Skip deletes — nothing to reconcile.
    const after = event.data?.after?.data();
    if (!after) return;

    const proSource = after.proSource ?? null;
    const proAccess = after.proAccess === true;
    const proExpiresAt = after.proExpiresAt ?? null;
    const memberships = Array.isArray(after.orgMemberships) ? after.orgMemberships : [];
    const activeMemberships = memberships.filter(
      (m) => m && m.status === 'active' && typeof m.orgId === 'string',
    );
    const activeOrgIdsExpected = activeMemberships.map((m) => m.orgId);
    const activeOrgIdsCurrent = Array.isArray(after.activeOrgIds)
      ? after.activeOrgIds.filter((v) => typeof v === 'string')
      : [];

    const patch = {};

    // ── Self-heal activeOrgIds ──
    if (!arraysSameAsSets(activeOrgIdsCurrent, activeOrgIdsExpected)) {
      patch.activeOrgIds = activeOrgIdsExpected;
    }

    // ── Subscription users: hands off proAccess/proSource. ──
    if (proSource === 'subscription') {
      // Clear stale grace clock if it somehow leaked onto a paying user.
      if (proExpiresAt != null) patch.proExpiresAt = null;
      return writePatchIfNeeded(event, patch);
    }

    // ── Has active memberships → comp Pro via crew. ──
    if (activeMemberships.length > 0) {
      if (!proAccess) patch.proAccess = true;
      if (proSource !== 'crew_membership') patch.proSource = 'crew_membership';
      if (proExpiresAt != null) patch.proExpiresAt = null;
      return writePatchIfNeeded(event, patch);
    }

    // ── No active memberships, currently comped via crew. ──
    if (activeMemberships.length === 0 && proSource === 'crew_membership') {
      // Start the grace clock once. If already set, leave it alone so
      // a repeated membership churn doesn't reset the user's window.
      if (proExpiresAt == null) {
        patch.proExpiresAt = Timestamp.fromMillis(Date.now() + SEVEN_DAYS_MS);
      }
      return writePatchIfNeeded(event, patch);
    }

    // ── No active memberships, no crew comp. Make sure entitlement
    //    fields stay null/false (e.g. a stale proAccess: true). ──
    if (activeMemberships.length === 0 && proSource == null) {
      if (proAccess) patch.proAccess = false;
      if (proExpiresAt != null) patch.proExpiresAt = null;
      return writePatchIfNeeded(event, patch);
    }

    return writePatchIfNeeded(event, patch);
  },
);

async function writePatchIfNeeded(event, patch) {
  if (Object.keys(patch).length === 0) return;
  try {
    await event.data.after.ref.update(patch);
    logger.info('[pro-entitlement] patch applied', {
      uid: event.params?.uid,
      keys: Object.keys(patch),
    });
  } catch (err) {
    logger.error('[pro-entitlement] patch failed', {
      uid: event.params?.uid,
      keys: Object.keys(patch),
      error: err.message,
    });
  }
}

function arraysSameAsSets(a, b) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const x of b) if (!setA.has(x)) return false;
  return true;
}

// ─── revokeExpiredCrewPro ────────────────────────────────────────────

exports.revokeExpiredCrewPro = onSchedule(
  {
    schedule: 'every day 03:00',
    region: 'us-central1',
    timeZone: 'Pacific/Honolulu',
    memory: '256MiB',
  },
  async () => {
    const db = admin.firestore();
    const now = Timestamp.now();

    // Composite query requires the (proSource, proExpiresAt) index
    // declared in firestore.indexes.json.
    const snap = await db.collection('users')
      .where('proSource', '==', 'crew_membership')
      .where('proExpiresAt', '<', now)
      .get();

    if (snap.empty) {
      logger.info('[pro-revoke] no users past grace');
      return;
    }

    let revoked = 0;
    let restored = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const memberships = Array.isArray(data.orgMemberships) ? data.orgMemberships : [];
      const hasActive = memberships.some((m) => m && m.status === 'active');

      if (hasActive) {
        // Race: the user got re-added to an org during their grace
        // window. Clear the grace clock — the trigger should already
        // have done this, but we double-check.
        batch.update(doc.ref, { proExpiresAt: null });
        restored += 1;
      } else {
        batch.update(doc.ref, {
          proAccess: false,
          proSource: null,
          proExpiresAt: null,
        });
        revoked += 1;
      }
      batchCount += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();

    logger.info('[pro-revoke] sweep complete', { revoked, restored, scanned: snap.size });
  },
);

