// generateCaptainsLog — render a CharterLog doc to a printable PDF
// and email a digest to the operator owner.
//
// CURRENT STATE (2026-06-05): The callable is wired end-to-end —
// validates auth + org membership, marks the log as submitted,
// uploads an HTML preview to Cloud Storage, returns its signed URL.
// The actual Puppeteer-rendered PDF is stubbed pending the design
// team's printable HTML template (referenced as "dark + light
// versions" in the spec; not yet checked into this repo). The
// captain experience works today via the HTML preview; swap in
// Puppeteer when the template lands.
//
// To finish:
//   1. Drop the printable HTML template at
//      functions/charter/templates/captainsLog.html (mustache-ish:
//      {{logId}}, {{trips}}, etc).
//   2. Replace renderHtmlPreview() with a Puppeteer render: load the
//      template, hydrate with the log data, call page.pdf().
//   3. Replace email body (currently text-only) with HTML digest +
//      PDF attachment.
//
// Auth: caller must be signed in AND belong to the log's operatorId.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const BUCKET_NAME = process.env.CAPTAINS_LOG_BUCKET || 'kaicast-charter-logs';
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

exports.generateCaptainsLog = onCall(
  {
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const logDocId = String(req.data?.logDocId || '').trim();
    if (!logDocId) throw new HttpsError('invalid-argument', 'logDocId is required.');

    const db = admin.firestore();
    const ref = db.collection('charter_logs').doc(logDocId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', `charter_logs/${logDocId} does not exist.`);
    }
    const log = snap.data();

    // Authorize — caller must belong to this log's operator.
    const userSnap = await db.collection('users').doc(uid).get();
    const callerOrg = userSnap.data()?.orgId;
    if (callerOrg !== log.operatorId) {
      throw new HttpsError('permission-denied', 'Not a member of this charter.');
    }

    // Flip status if still draft. (The client also flips locally; this
    // is the authoritative write so the email digest sees the final
    // state.)
    if (log.status === 'draft') {
      await ref.set({
        status: 'submitted',
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // ── Render ──────────────────────────────────────────────────────
    // TODO(captains-log-pdf): Replace with Puppeteer once the printable
    // HTML template lands. See the file header for the swap-in
    // checklist.
    const html = renderHtmlPreview(log);
    let signedUrl = null;
    try {
      signedUrl = await uploadAndSign(log.logId, html);
    } catch (err) {
      logger.warn('[captains-log] preview upload failed', {
        logDocId, error: err?.message || String(err),
      });
      // Fall through — surface null url so the client tells the
      // captain the log was submitted but the document is queued.
    }

    // ── Notify ──────────────────────────────────────────────────────
    // TODO(captains-log-email): Hook into the existing email transport
    // (functions/emails/) and send the digest with the rendered PDF
    // attached. For now we just log the event so it shows up in
    // observability — the captain still sees "submitted" in-app.
    logger.info('[captains-log] submitted', {
      logDocId,
      operatorId: log.operatorId,
      totalTrips: log.totalTrips,
      totalGuests: log.totalGuests,
      incidents: log.incidents,
      previewUrl: signedUrl,
    });

    return { pdfUrl: signedUrl };
  },
);

// ── Renderers ──────────────────────────────────────────────────────

/**
 * Bare-bones HTML preview of the log. Mirrors the structure of the
 * printable template so swapping to Puppeteer + a real template is a
 * one-file change. Inline CSS keeps the file self-contained.
 */
function renderHtmlPreview(log) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
  const tripsHtml = (log.trips || []).map((t) => `
    <section class="trip">
      <h3>${esc(t.tripNum)}. ${esc(t.title)}</h3>
      <p class="muted">${esc(t.type)} · ${esc(t.departureTime)} → ${esc(t.returnTime)} · ${esc(t.passengerCount)} guests</p>
      <p><strong>Site:</strong> ${esc(t.primarySite)} ${t.secondarySite ? `(also ${esc(t.secondarySite)})` : ''}</p>
      <p><strong>Observed:</strong>
        vis ${esc(t.observedConditions?.visibility)} ·
        temp ${esc(t.observedConditions?.feltTemp)} ·
        sea ${esc(t.observedConditions?.seaState)} ·
        wind ${esc(t.observedConditions?.windObserved)}
      </p>
      ${t.captainNote ? `<p><em>${esc(t.observedConditions?.captainNote)}</em></p>` : ''}
      ${(t.speciesObserved || []).length ? `<p><strong>Species:</strong> ${(t.speciesObserved).map((s) => `${esc(s.species)} ×${s.count}`).join(', ')}</p>` : ''}
      ${t.incident && t.incident !== 'None' ? `<p class="incident"><strong>Incident:</strong> ${esc(t.incident)} (${esc(t.incidentSeverity || 'unspecified')})</p>` : ''}
      ${t.equipmentNotes ? `<p><strong>Equipment:</strong> ${esc(t.equipmentNotes)}</p>` : ''}
      ${t.siteNotes ? `<p><strong>Site notes:</strong> ${esc(t.siteNotes)}</p>` : ''}
    </section>
  `).join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(log.logId)}</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0B1015; color: #f8f8f8; max-width: 720px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .id  { color: #9aa4b2; font-family: ui-monospace, monospace; font-size: 12px; }
  .totals { display: flex; gap: 24px; margin: 24px 0; }
  .totals div { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px; flex: 1; }
  .totals strong { display: block; font-size: 28px; }
  .totals small { color: #9aa4b2; text-transform: uppercase; letter-spacing: 0.8px; font-size: 10px; }
  .trip { border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; }
  .muted { color: #9aa4b2; }
  .incident { color: #f73726; }
</style></head>
<body>
  <h1>${esc(log.vesselName || 'Vessel')} — Daily Log</h1>
  <p class="id">${esc(log.logId)}</p>
  <p class="muted">${esc(log.captainName)} · ${esc(log.captainLicense)} · ${esc(log.harborDeparture)}</p>
  <div class="totals">
    <div><strong>${log.totalTrips || 0}</strong><small>Trips</small></div>
    <div><strong>${log.totalGuests || 0}</strong><small>Guests</small></div>
    <div><strong>${log.incidents || 0}</strong><small>Incidents</small></div>
  </div>
  ${log.dailyAlerts ? `<p style="background:rgba(245,176,65,0.14);border:1px solid #f5b041;padding:10px;border-radius:8px;"><strong>Alerts:</strong> ${esc(log.dailyAlerts)}</p>` : ''}
  ${tripsHtml}
  <p class="muted" style="margin-top: 36px; font-size: 11px;">
    Generated by KaiCast · This is the in-app HTML preview.
    A printable PDF will replace this once the captain's-log
    template lands.
  </p>
</body></html>`;
}

async function uploadAndSign(logId, html) {
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const file = bucket.file(`logs/${logId}.html`);
  await file.save(Buffer.from(html, 'utf-8'), {
    contentType: 'text/html; charset=utf-8',
    resumable: false,
    metadata: { cacheControl: 'public, max-age=300' },
  });
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });
  return url;
}
