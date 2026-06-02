// createCrewInvitation — charter admin invites a person (by email) to
// join their org as a crew member. Creates one /crew_invitations/{id}
// doc with status 'pending' and a 7-day expiry. The doc is server-only;
// the matching read rules let the org admin see their own pending
// invites and the invitee (matched by auth-token email) read the doc
// they're being invited to.
//
// The actual email-sending lives in Slice C2. This callable just
// persists the invite + returns the accept URL the client can copy
// to the clipboard for now.
//
// Idempotent: if a pending invitation already exists for (orgId,
// invitedEmail), we return that one instead of creating a duplicate.
// That keeps double-clicks + retries safe without exotic error
// handling on the client.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { z } = require('zod');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const ROLES = ['captain', 'divemaster', 'deckhand'];

const Input = z.object({
  orgId: z.string().min(1).max(120),
  invitedEmail: z.string().email().max(254),
  role: z.enum(ROLES),
  displayName: z.string().max(100).optional(),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

exports.createCrewInvitation = onCall(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to invite crew.');
    }
    const callerUid = req.auth.uid;

    let input;
    try {
      input = Input.parse(req.data);
    } catch (err) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid payload: ${err.issues?.[0]?.message ?? err.message}`,
      );
    }

    const { orgId, role, displayName } = input;
    const invitedEmail = input.invitedEmail.trim().toLowerCase();

    const db = admin.firestore();

    // Caller must be a charter admin of the target org.
    const callerSnap = await db.doc(`users/${callerUid}`).get();
    const caller = callerSnap.exists ? callerSnap.data() : null;
    if (!caller || caller.accountType !== 'charter' || caller.orgId !== orgId) {
      logger.warn('[invite] denied — not an admin of target org', {
        callerUid, orgId, callerAccountType: caller?.accountType,
      });
      throw new HttpsError(
        'permission-denied',
        'Only the charter admin of this org can invite crew.',
      );
    }

    // Pull the org name so the invite carries a friendly label without
    // the client needing to re-read /charter_accounts.
    const orgSnap = await db.doc(`charter_accounts/${orgId}`).get();
    if (!orgSnap.exists) {
      throw new HttpsError('not-found', `Unknown org: ${orgId}`);
    }
    const orgName = String(orgSnap.data()?.name ?? orgId);

    // Idempotency: if a pending invite already exists for this email +
    // org, return it instead of creating a duplicate. Expired pending
    // invites are NOT reused — those need a fresh invite.
    const nowMs = Date.now();
    const existing = await db.collection('crew_invitations')
      .where('orgId', '==', orgId)
      .where('invitedEmail', '==', invitedEmail)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      const data = doc.data();
      const expiresMs = data.expiresAt?.toMillis?.() ?? 0;
      if (expiresMs > nowMs) {
        logger.info('[invite] returning existing pending invite', {
          inviteId: doc.id, orgId, invitedEmail,
        });
        return {
          inviteId: doc.id,
          status: 'pending',
          orgName,
          role,
          expiresAt: expiresMs,
          reused: true,
        };
      }
      // Expired pending — mark it expired so the new one is the live
      // record. We DON'T delete it — keeping the history is useful for
      // an admin reviewing "who did I invite and never got back to me?"
      await doc.ref.update({ status: 'expired' });
    }

    // Create a fresh invite. The doc id is the inviteId we hand back
    // to the client — it's also the path token in the accept URL.
    const ref = db.collection('crew_invitations').doc();
    const expiresAtMs = nowMs + SEVEN_DAYS_MS;
    await ref.set({
      orgId,
      orgName,
      invitedEmail,
      invitedDisplayName: displayName ?? null,
      role,
      invitedBy: callerUid,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    });

    logger.info('[invite] created', {
      inviteId: ref.id, orgId, invitedEmail, role,
    });

    return {
      inviteId: ref.id,
      status: 'pending',
      orgName,
      role,
      expiresAt: expiresAtMs,
      reused: false,
    };
  },
);
