// createCrewInvitation — charter admin invites a person (by email) to
// join their org as a crew member. Creates one /crew_invitations/{id}
// doc with status 'pending' and a 7-day expiry. The doc is server-only;
// the matching read rules let the org admin see their own pending
// invites and the invitee (matched by auth-token email) read the doc
// they're being invited to.
//
// After the doc is persisted, the callable fires a best-effort
// invitation email via Resend (see ./sendInviteEmail.js). Email
// failures NEVER fail the callable — the admin still gets the accept
// URL back and the copy-link path in the modal stays useful.
//
// Idempotent: if a pending invitation already exists for (orgId,
// invitedEmail), we return that one instead of creating a duplicate.
// Email is re-sent on every successful call so an admin clicking
// "Send invitation" again actually re-sends — that matches user
// intent better than silently no-op'ing the email.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { z } = require('zod');
const { sendInviteEmail } = require('./sendInviteEmail');

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Keep in sync with desktop/charter/types.ts CrewRole minus 'owner'
// (org owner role is set by provisionCharterOperator, not invited).
const ROLES = ['captain', 'divemaster', 'deckhand', 'manager', 'instructor'];

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
    secrets: [RESEND_API_KEY],
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

    let inviteId;
    let expiresAtMs;
    let reused;
    let effectiveDisplayName;
    let effectiveRole;

    if (!existing.empty) {
      const doc = existing.docs[0];
      const data = doc.data();
      const existingExpiresMs = data.expiresAt?.toMillis?.() ?? 0;
      if (existingExpiresMs > nowMs) {
        logger.info('[invite] returning existing pending invite', {
          inviteId: doc.id, orgId, invitedEmail,
        });
        inviteId = doc.id;
        expiresAtMs = existingExpiresMs;
        reused = true;
        effectiveDisplayName = typeof data.invitedDisplayName === 'string' ? data.invitedDisplayName : null;
        effectiveRole = typeof data.role === 'string' ? data.role : role;
      } else {
        // Expired pending — mark it expired so the new one is the live
        // record. We DON'T delete it — keeping the history is useful for
        // an admin reviewing "who did I invite and never got back to me?"
        await doc.ref.update({ status: 'expired' });
      }
    }

    if (inviteId == null) {
      // Create a fresh invite. The doc id is the inviteId we hand back
      // to the client — it's also the path token in the accept URL.
      const ref = db.collection('crew_invitations').doc();
      expiresAtMs = nowMs + SEVEN_DAYS_MS;
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
      inviteId = ref.id;
      reused = false;
      effectiveDisplayName = displayName ?? null;
      effectiveRole = role;
      logger.info('[invite] created', {
        inviteId, orgId, invitedEmail, role,
      });
    }

    // ── Email send (best-effort) ──
    // Failures are caught + logged inside sendInviteEmail; the result
    // tells us whether to flip `emailSent` in the response so the
    // modal can show either "Email sent" or the copy-link fallback.
    const inviterName = typeof caller?.displayName === 'string' && caller.displayName.trim().length > 0
      ? caller.displayName.trim()
      : (caller?.email || null);
    const emailResult = await sendInviteEmail({
      inviteId,
      invitedEmail,
      invitedDisplayName: effectiveDisplayName,
      orgName,
      role: effectiveRole,
      invitedByDisplayName: inviterName,
      expiresAtMs,
      resendApiKey: RESEND_API_KEY.value(),
    });

    return {
      inviteId,
      status: 'pending',
      orgName,
      role: effectiveRole,
      expiresAt: expiresAtMs,
      reused,
      emailSent: emailResult.sent,
      emailFailureReason: emailResult.sent ? null : (emailResult.reason ?? null),
    };
  },
);
