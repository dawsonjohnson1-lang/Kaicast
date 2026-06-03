// Crew invitation read + accept callables.
//
// getCrewInvitationPublic
//   Lets the signed-out invite landing page show org name + role +
//   expiry without first authenticating. Reading the raw doc is
//   gated by rules (charter admin or matching invitee email), so a
//   server-side bypass is the cleanest way to expose just the
//   fields the landing page needs.
//
// acceptCrewInvitation
//   Requires auth + matching email. Transactionally:
//     1. Marks the invitation 'accepted'
//     2. Pushes a new entry into users/{uid}.orgMemberships
//     3. Upgrades a plain consumer accountType → 'crew' (leaves
//        charter admins alone — they keep 'charter' even if they
//        also crew on their own boats)
//     4. Sets proAccess: true + proSource: 'crew_membership'
//        UNLESS the user is already on a paying subscription
//     5. Flips activeContext to 'crew:{orgId}' so the next page
//        load lands them in the crew context
//
// The Pro entitlement step happens inline here rather than via a
// separate Firestore trigger because the trigger work is its own
// slice (E). Inlining keeps Slice C2 self-contained: accept the
// invite, get Pro instantly. When Slice E lands, it owns the
// proAccess field exclusively and these inline writes get removed
// from this callable.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { z } = require('zod');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const Input = z.object({
  inviteId: z.string().min(1).max(120),
});

const COMMON = {
  region: 'us-central1',
  cors: true,
  timeoutSeconds: 30,
  memory: '256MiB',
};

// ─── getCrewInvitationPublic ─────────────────────────────────────────
//
// No auth required. Returns sanitized invite info OR { found: false }.
// Treats expired pending docs as 'expired' in the response (and bumps
// the doc's status so future reads agree) — saves the client having
// to do its own expiry math.

exports.getCrewInvitationPublic = onCall(
  COMMON,
  async (req) => {
    let input;
    try {
      input = Input.parse(req.data);
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid payload: ${err.issues?.[0]?.message ?? err.message}`,
      );
    }

    const db = admin.firestore();
    const ref = db.doc(`crew_invitations/${input.inviteId}`);
    const snap = await ref.get();
    if (!snap.exists) return { found: false };

    const invite = snap.data();
    const expiresMs = invite.expiresAt?.toMillis?.() ?? 0;
    const isExpired = expiresMs > 0 && expiresMs < Date.now();
    let status = String(invite.status ?? 'pending');

    if (isExpired && status === 'pending') {
      // Self-heal: bump pending → expired so any later view (admin
      // dashboard, accept callable) sees the same state.
      try { await ref.update({ status: 'expired' }); status = 'expired'; }
      catch (err) { logger.warn('[invite:public] expiry self-heal failed', { id: input.inviteId, error: err.message }); }
    }

    return {
      found: true,
      orgId: String(invite.orgId ?? ''),
      orgName: String(invite.orgName ?? ''),
      invitedEmail: String(invite.invitedEmail ?? ''),
      invitedDisplayName: typeof invite.invitedDisplayName === 'string' ? invite.invitedDisplayName : null,
      role: String(invite.role ?? 'deckhand'),
      status,
      expiresAt: expiresMs || null,
    };
  },
);

// ─── acceptCrewInvitation ────────────────────────────────────────────

exports.acceptCrewInvitation = onCall(
  COMMON,
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to accept the invitation.');
    }

    let input;
    try {
      input = Input.parse(req.data);
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid payload: ${err.issues?.[0]?.message ?? err.message}`,
      );
    }

    const callerUid = req.auth.uid;
    const callerEmail = String(req.auth.token?.email ?? '').toLowerCase();

    const db = admin.firestore();
    const inviteRef = db.doc(`crew_invitations/${input.inviteId}`);
    const userRef = db.doc(`users/${callerUid}`);

    let result;
    try {
      result = await db.runTransaction(async (tx) => {
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new HttpsError('not-found', 'Invitation not found.');
        }
        const invite = inviteSnap.data();

        // Email match (case-insensitive). Both sides should already be
        // lowercase per createCrewInvitation + Firebase Auth, but be
        // defensive here so a mixed-case auth token doesn't lock out
        // a legitimate invitee.
        if (String(invite.invitedEmail ?? '').toLowerCase() !== callerEmail) {
          throw new HttpsError(
            'permission-denied',
            `This invitation is addressed to ${invite.invitedEmail}. Sign in as that user to accept.`,
          );
        }

        // Status check + expiry self-heal.
        const expiresMs = invite.expiresAt?.toMillis?.() ?? 0;
        const isExpired = expiresMs > 0 && expiresMs < Date.now();
        if (isExpired || invite.status === 'expired') {
          tx.update(inviteRef, { status: 'expired' });
          throw new HttpsError('deadline-exceeded', 'This invitation has expired. Ask the admin for a new one.');
        }
        if (invite.status === 'accepted') {
          throw new HttpsError('failed-precondition', 'This invitation was already accepted.');
        }
        if (invite.status === 'declined') {
          throw new HttpsError('failed-precondition', 'This invitation was declined and cannot be reused.');
        }
        if (invite.status !== 'pending') {
          throw new HttpsError('failed-precondition', `Invitation has status '${invite.status}'.`);
        }

        // Read existing user doc — may be empty if the user just
        // signed up via the inline form on the invite page and
        // seedUserDocIfNew hasn't fully landed yet. We use set with
        // merge below so we don't depend on the doc existing.
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists ? userSnap.data() : {};
        const memberships = Array.isArray(userData.orgMemberships) ? [...userData.orgMemberships] : [];

        const alreadyActive = memberships.some((m) =>
          m && m.orgId === invite.orgId && m.status === 'active',
        );

        if (!alreadyActive) {
          // FieldValue.serverTimestamp() does NOT work inside array
          // elements — use Timestamp.now() so the timestamp is
          // server-clock consistent without sentinel restrictions.
          memberships.push({
            orgId: invite.orgId,
            orgName: invite.orgName,
            role: invite.role,
            status: 'active',
            invitedAt: invite.createdAt ?? null,
            acceptedAt: Timestamp.now(),
          });
        }

        const patch = {
          orgMemberships: memberships,
          activeContext: `crew:${invite.orgId}`,
        };

        // accountType: only upgrade plain consumers. Don't downgrade
        // a charter admin who's also being added as crew.
        if (userData.accountType !== 'charter' && userData.accountType !== 'crew') {
          patch.accountType = 'crew';
        }

        // Pro entitlement: comp Pro via crew membership UNLESS the
        // user is already on a paying subscription (don't clobber
        // the source-of-truth for billing).
        if (userData.proSource !== 'subscription') {
          patch.proAccess = true;
          patch.proSource = 'crew_membership';
        }

        tx.set(userRef, patch, { merge: true });
        tx.update(inviteRef, {
          status: 'accepted',
          acceptedBy: callerUid,
          acceptedAt: FieldValue.serverTimestamp(),
        });

        return {
          orgId: invite.orgId,
          orgName: invite.orgName,
          role: invite.role,
          newlyAdded: !alreadyActive,
        };
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('[invite:accept] transaction failed', { inviteId: input.inviteId, error: err.message });
      throw new HttpsError('internal', 'Could not accept invitation.');
    }

    logger.info('[invite:accept] accepted', {
      inviteId: input.inviteId, uid: callerUid, orgId: result.orgId,
    });
    return result;
  },
);
