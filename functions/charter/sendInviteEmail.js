// sendInviteEmail — best-effort transactional send for crew invites.
//
// Called from createCrewInvitation after the /crew_invitations/{id}
// doc is persisted. Wraps Resend so the calling code can stay in the
// "data first, side-effect second" shape: the invite is durable even
// if email delivery flakes, and the admin still has the copy-link
// fallback in the modal.
//
// Provider: Resend (chosen for the simple HTTP API + generous free
// tier). The API key lives in the RESEND_API_KEY secret. The from
// address comes from the FROM_ADDRESS module constant — currently
// the Resend sandbox sender so we can ship before kaicast.com DNS
// verification is wired. Swap to invites@kaicast.com once the TXT
// records resolve.
//
// Failures NEVER throw — the caller is wrapped in a try-block that
// would otherwise mask the more important "did the doc save" outcome.
// Instead we return { sent: boolean, reason?: string } and log every
// failure with enough detail to triage.

const logger = require('firebase-functions/logger');
const { Resend } = require('resend');

// Sandbox sender. Resend's onboarding domain auto-passes SPF/DKIM for
// internal testing; deliverability to non-Resend inboxes (Gmail etc.)
// is best-effort. Move to invites@kaicast.com after DNS verification.
const FROM_ADDRESS = 'KaiCast <onboarding@resend.dev>';

// Single product origin baked into the email body. We don't read from
// the request because the email is the source of truth a user clicks
// — it must point at the canonical hosting URL regardless of where
// the admin happened to be when they hit "Send".
const APP_ORIGIN = 'https://kaicast.com';

const KAICAST_ACCENT = '#09A1FB';
const KAICAST_TEXT = '#0F1115';
const KAICAST_MUTED = '#5C636D';

/**
 * Send a crew invitation email.
 * @param {Object} args
 * @param {string} args.inviteId  — id of the /crew_invitations/{id} doc
 * @param {string} args.invitedEmail
 * @param {string} args.invitedDisplayName  — may be empty / null
 * @param {string} args.orgName
 * @param {string} args.role  — captain | divemaster | deckhand | manager | instructor
 * @param {string} args.invitedByDisplayName  — who's sending the invite
 * @param {number} args.expiresAtMs
 * @param {string} args.resendApiKey  — pulled from the RESEND_API_KEY secret in the caller
 * @returns {Promise<{sent: boolean, reason?: string, messageId?: string}>}
 */
async function sendInviteEmail({
  inviteId,
  invitedEmail,
  invitedDisplayName,
  orgName,
  role,
  invitedByDisplayName,
  expiresAtMs,
  resendApiKey,
}) {
  // Treat whitespace-only values or the literal placeholder we set
  // during initial deploy as "not configured" — Secret Manager
  // rejects empty payloads, so a placeholder is required to unblock
  // deploys when a real Resend key isn't ready yet.
  if (!resendApiKey || !resendApiKey.trim() || resendApiKey.trim() === '__placeholder__') {
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const acceptUrl = `${APP_ORIGIN}/invite/${encodeURIComponent(inviteId)}`;
  const roleLabel = humanRole(role);
  const greeting = invitedDisplayName ? `Hi ${invitedDisplayName},` : 'Hi,';
  const inviter = invitedByDisplayName || 'The KaiCast crew';
  const expiryLine = expiresAtMs
    ? `This invite expires in 7 days (${new Date(expiresAtMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).`
    : 'This invite expires in 7 days.';

  const subject = `You're invited to crew ${orgName} on KaiCast`;
  const html = renderHtml({ greeting, orgName, roleLabel, inviter, acceptUrl, expiryLine });
  const text = renderText({ greeting, orgName, roleLabel, inviter, acceptUrl, expiryLine });

  try {
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: invitedEmail,
      subject,
      html,
      text,
      // Resend tags surface in their dashboard for filtering by use case.
      tags: [
        { name: 'kind', value: 'crew_invite' },
        { name: 'org', value: slugForTag(orgName) },
      ],
    });
    if (error) {
      logger.error('[invite:email] resend rejected', { invitedEmail, error: error.message ?? error });
      return { sent: false, reason: error.message ?? 'resend rejected' };
    }
    logger.info('[invite:email] sent', { invitedEmail, messageId: data?.id });
    return { sent: true, messageId: data?.id };
  } catch (err) {
    logger.error('[invite:email] threw', { invitedEmail, error: err?.message ?? String(err) });
    return { sent: false, reason: err?.message ?? 'unknown send error' };
  }
}

// ─── Templates ───────────────────────────────────────────────────────

function renderHtml({ greeting, orgName, roleLabel, inviter, acceptUrl, expiryLine }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>KaiCast crew invitation</title>
  </head>
  <body style="margin:0;padding:0;background:#F4F6F8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:14px;border:1px solid #E5E8EC;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #E5E8EC;">
                <div style="font-family:Inter,-apple-system,sans-serif;font-size:11px;color:${KAICAST_ACCENT};letter-spacing:1.5px;font-weight:700;text-transform:uppercase;">KaiCast</div>
                <div style="font-family:Inter,-apple-system,sans-serif;font-size:13px;color:${KAICAST_MUTED};margin-top:4px;">Crew invitation</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="font-size:15px;color:${KAICAST_TEXT};line-height:1.5;margin:0 0 16px 0;">${escapeHtml(greeting)}</p>
                <p style="font-size:15px;color:${KAICAST_TEXT};line-height:1.5;margin:0 0 16px 0;">
                  ${escapeHtml(inviter)} invited you to crew <strong>${escapeHtml(orgName)}</strong> on KaiCast as
                  <strong style="color:${KAICAST_ACCENT};">${escapeHtml(roleLabel)}</strong>.
                </p>
                <p style="font-size:14px;color:${KAICAST_MUTED};line-height:1.5;margin:0 0 24px 0;">
                  Accepting unlocks the crew dashboard, trip briefs for every trip you're assigned to, pre-filled dive logs, and Pro forecast features comped while you're active crew.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px 0;">
                  <tr>
                    <td style="border-radius:8px;background:${KAICAST_ACCENT};">
                      <a href="${acceptUrl}" target="_blank" style="display:inline-block;padding:13px 22px;font-family:Inter,-apple-system,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">
                        Accept invitation →
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size:12px;color:${KAICAST_MUTED};line-height:1.5;margin:16px 0 0 0;">
                  ${escapeHtml(expiryLine)}
                </p>
                <p style="font-size:11px;color:${KAICAST_MUTED};line-height:1.5;margin:24px 0 0 0;word-break:break-all;">
                  If the button doesn't open, paste this link into your browser:<br/>
                  <span style="font-family:Menlo,Monaco,Consolas,monospace;color:${KAICAST_TEXT};">${acceptUrl}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#FAFBFC;border-top:1px solid #E5E8EC;font-size:11px;color:${KAICAST_MUTED};line-height:1.5;">
                You're receiving this because someone at ${escapeHtml(orgName)} added your email to their crew invitation list. Not expecting this? Just ignore the message — the invitation expires automatically.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText({ greeting, orgName, roleLabel, inviter, acceptUrl, expiryLine }) {
  return [
    greeting,
    '',
    `${inviter} invited you to crew ${orgName} on KaiCast as ${roleLabel}.`,
    '',
    'Accepting unlocks the crew dashboard, trip briefs for every trip you\'re assigned to, pre-filled dive logs, and Pro forecast features comped while you\'re active crew.',
    '',
    'Accept your invitation:',
    acceptUrl,
    '',
    expiryLine,
    '',
    `Not expecting this? Just ignore the message — the invitation expires automatically.`,
    '',
    '— KaiCast',
  ].join('\n');
}

function humanRole(role) {
  switch (role) {
    case 'captain':    return 'Captain';
    case 'divemaster': return 'Divemaster';
    case 'instructor': return 'Instructor';
    case 'manager':    return 'Manager';
    default:           return 'Deckhand';
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugForTag(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'unknown';
}

module.exports = { sendInviteEmail };
