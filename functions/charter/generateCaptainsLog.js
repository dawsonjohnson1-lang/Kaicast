// generateCaptainsLog — render a CharterLog doc to HTML, upload both
// the dark in-app preview AND the printable light version to Cloud
// Storage, return signed URLs.
//
// Schema this generator reads (Phase 1 standalone log):
//   log.conditions.{abyss,observed}   — day-level conditions matrix
//   log.incident.{occurred,summary,uscgFlag,dlnrFlag}  — day-level incident
//   log.dayNotes                       — free-form day narrative
//   log.trips[].{type,label,durationHours,guestCount,notes}  — lightweight rows
//
// Legacy fields (passengerCount, observedConditions per-trip,
// speciesObserved, fareharborBookingId, etc.) are still on the trip
// type as optional placeholders for Phase 2 (FareHarbor re-enable).
// The renderer reads the lightweight fields with sensible fallbacks
// so archived logs from the old per-trip flow continue to render —
// just without trip-level conditions / guests.
//
// Output: two HTML files per submission —
//   logs/{logId}-dark.html   — dark theme (#0B1015 background), used
//                              for the in-app preview and the captain's
//                              quick on-device read.
//   logs/{logId}-light.html  — light theme, printable / archive friendly.
//
// Both files are uploaded with 7-day signed URLs. The callable returns
// `{ pdfUrl, lightPdfUrl }` — pdfUrl is the dark URL (backward-compat
// for callers that only know about that field).
//
// Typography: DM Sans for headers + body, JetBrains Mono for numeric
// / data values. Loaded from Google Fonts at the top of the document
// with safe system-font fallbacks.

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
    // is the authoritative write so the rendered document sees the
    // final state.)
    if (log.status === 'draft') {
      await ref.set({
        status: 'submitted',
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // ── Render both themes ─────────────────────────────────────────
    const darkHtml  = renderHtml(log, { theme: 'dark'  });
    const lightHtml = renderHtml(log, { theme: 'light' });

    let darkUrl = null;
    let lightUrl = null;
    try {
      [darkUrl, lightUrl] = await Promise.all([
        uploadAndSign(`${log.logId}-dark`,  darkHtml),
        uploadAndSign(`${log.logId}-light`, lightHtml),
      ]);
    } catch (err) {
      logger.warn('[captains-log] preview upload failed', {
        logDocId, error: err?.message || String(err),
      });
      // Fall through — surface null URLs so the client tells the
      // captain the log was submitted but the document is queued.
    }

    logger.info('[captains-log] submitted', {
      logDocId,
      operatorId: log.operatorId,
      tripCount: (log.trips || []).length,
      totalGuests: log.totalGuests,
      incidentOccurred: !!log.incident?.occurred,
      darkUrl,
      lightUrl,
    });

    return {
      pdfUrl: darkUrl,         // back-compat: legacy callers expect pdfUrl
      darkPdfUrl: darkUrl,
      lightPdfUrl: lightUrl,
    };
  },
);

// ── Renderers ──────────────────────────────────────────────────────

/** Theme tokens that swap by `theme: 'dark' | 'light'`. Kept as a
 *  single object so the markup-rendering code below stays
 *  theme-agnostic — it only reads `t.bg`, `t.text`, etc. */
function tokens(theme) {
  if (theme === 'light') {
    return {
      bg:        '#F7F8FA',
      surface:   '#FFFFFF',
      surfaceAlt:'#F1F3F6',
      text:      '#0F1115',
      textMuted: '#5C636D',
      textSub:   '#8A929E',
      border:    '#E2E6EC',
      borderHi:  '#CBD2DA',
      accent:    '#09A1FB',
      accentSoft:'rgba(9,161,251,0.10)',
      hazard:    '#D5292B',
      hazardSoft:'rgba(213,41,43,0.10)',
      warn:      '#C77400',
      warnSoft:  'rgba(199,116,0,0.10)',
      bannerBg:  '#FFFFFF',
    };
  }
  return {
    bg:        '#0B1015',
    surface:   '#11171F',
    surfaceAlt:'#161E27',
    text:      '#F4F6F8',
    textMuted: '#9AA4B2',
    textSub:   '#6B7480',
    border:    '#1F2832',
    borderHi:  '#2A3441',
    accent:    '#09A1FB',
    accentSoft:'rgba(9,161,251,0.14)',
    hazard:    '#F73726',
    hazardSoft:'rgba(247,55,38,0.14)',
    warn:      '#F5A623',
    warnSoft:  'rgba(245,166,35,0.14)',
    bannerBg:  '#11171F',
  };
}

/** Per-trip-type left-border accent. The bar is rendered as a 6px
 *  inset border on the card; readers can spot trip types by color
 *  at a glance. */
const TRIP_TYPE_COLOR = {
  snorkel:        '#2A9D8F',
  scuba:          '#09A1FB',
  freedive:       '#3DDC84',
  spearfishing:   '#A78BFA',
  fishing:        '#2E7D32',
  private:        '#F5A623',
  ash_scattering: '#E1A19D',
  sunset:         '#F76707',
  whale_watch:    '#1A5DAB',
  other:          '#8A929E',
};

const TRIP_TYPE_LABEL = {
  snorkel:        'Snorkel Tour',
  scuba:          'Scuba Dive',
  freedive:       'Freedive',
  spearfishing:   'Spearfishing Charter',
  fishing:        'Fishing Charter',
  private:        'Private Charter',
  ash_scattering: 'Ash Scattering / Memorial',
  sunset:         'Sunset / Sightseeing Cruise',
  whale_watch:    'Whale Watch',
  other:          'Custom',
};

function renderHtml(log, { theme }) {
  const t = tokens(theme);
  const esc = htmlEscape;

  const trips = Array.isArray(log.trips) ? log.trips : [];
  const cond = log.conditions || {};
  const abyss = cond.abyss || {};
  const observed = cond.observed || {};
  const incident = log.incident || {};

  const dateLabel = log.date
    ? new Date(log.date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : '—';

  const tripsHtml = trips.length === 0
    ? `<div class="empty">
         <div class="empty-title">No trips logged</div>
         <div class="empty-sub">Conditions captured for the day; no charters ran.</div>
       </div>`
    : trips.map((trip, idx) => renderTrip(trip, idx + 1, t, esc)).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(log.logId || 'Captain\'s Log')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: ${t.bg};
      --surface: ${t.surface};
      --surface-alt: ${t.surfaceAlt};
      --text: ${t.text};
      --text-muted: ${t.textMuted};
      --text-sub: ${t.textSub};
      --border: ${t.border};
      --border-hi: ${t.borderHi};
      --accent: ${t.accent};
      --accent-soft: ${t.accentSoft};
      --hazard: ${t.hazard};
      --hazard-soft: ${t.hazardSoft};
      --warn: ${t.warn};
      --warn-soft: ${t.warnSoft};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      padding: 40px 24px;
      max-width: 880px;
      margin: 0 auto;
      -webkit-font-smoothing: antialiased;
    }
    .mono, .num { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; }
    h1, h2, h3 { font-family: 'DM Sans', sans-serif; color: var(--text); margin: 0; }

    /* ── Header ─────────────────────────────────────────────────── */
    .head { margin-bottom: 32px; }
    .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      letter-spacing: 1.5px;
      color: var(--accent);
      text-transform: uppercase;
      font-weight: 700;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.8px;
      margin-top: 4px;
    }
    .head .meta {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 6px;
    }
    .head .logId {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-sub);
      margin-top: 4px;
    }

    /* ── Totals strip ──────────────────────────────────────────── */
    .totals {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 24px 0 32px 0;
    }
    .totals .cell {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .totals .num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      display: block;
    }
    .totals .label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 700;
      margin-top: 4px;
      display: block;
    }

    /* ── Section ──────────────────────────────────────────────── */
    .section { margin-bottom: 28px; }
    h2 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 12px;
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    h2 .sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 700;
    }

    /* ── Conditions matrix ────────────────────────────────────── */
    .cond-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .cond-col {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .cond-col-abyss { border-left: 4px solid var(--accent); }
    .cond-col-observed { border-left: 4px solid #3DDC84; }
    .cond-head {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .cond-row {
      display: flex;
      gap: 10px;
      padding: 5px 0;
      border-top: 1px solid var(--border);
    }
    .cond-row:first-of-type { border-top: 0; }
    .cond-label { flex: 0 0 110px; font-size: 12px; color: var(--text-muted); }
    .cond-val {
      flex: 1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text);
      font-weight: 600;
    }
    .cond-note {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
      font-style: italic;
    }

    /* ── Trip card ────────────────────────────────────────────── */
    .trip {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 10px;
      border-left: 6px solid var(--border);
      display: grid;
      grid-template-columns: 36px 1fr auto;
      gap: 12px;
      align-items: center;
    }
    .trip-index {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 700;
    }
    .trip-main { min-width: 0; }
    .trip-type {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 700;
    }
    .trip-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      margin-top: 2px;
    }
    .trip-meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .trip-notes {
      grid-column: 1 / -1;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
    }
    .trip-tally {
      grid-column: 1 / -1;
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
    }
    .trip-tally strong { color: var(--text); font-weight: 700; }

    /* ── Day notes ────────────────────────────────────────────── */
    .day-notes {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 13px;
      color: var(--text);
      white-space: pre-wrap;
    }

    /* ── Incident ─────────────────────────────────────────────── */
    .incident-card {
      background: var(--hazard-soft);
      border: 1px solid var(--hazard);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .incident-card.none {
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .incident-head {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--hazard);
    }
    .incident-card.none .incident-head { color: var(--text-muted); }
    .incident-summary {
      margin-top: 8px;
      font-size: 13px;
      color: var(--text);
      white-space: pre-wrap;
    }
    .incident-flags {
      margin-top: 10px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .flag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid currentColor;
    }
    .flag.warn { color: var(--warn); background: var(--warn-soft); }
    .flag.hazard { color: var(--hazard); background: var(--hazard-soft); }

    /* ── Sign-off + footer ───────────────────────────────────── */
    .signoff {
      margin-top: 32px;
      padding: 14px 16px;
      border-radius: 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
    }
    .signoff strong { color: var(--text); font-weight: 700; }

    .footer {
      margin-top: 36px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-sub);
      text-align: center;
      letter-spacing: 0.6px;
    }

    /* ── Empty state ─────────────────────────────────────────── */
    .empty {
      background: var(--surface);
      border: 1px dashed var(--border-hi);
      border-radius: 10px;
      padding: 22px 18px;
      text-align: center;
      color: var(--text-muted);
    }
    .empty-title { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); }
    .empty-sub { font-size: 12px; margin-top: 4px; }

    /* Print sanity */
    @media print {
      body { padding: 24px; }
      .trip { break-inside: avoid; }
      .cond-grid { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="head">
    <div class="eyebrow">Captain's Daily Log</div>
    <h1>${esc(log.vesselName || 'Vessel')}</h1>
    <div class="meta">
      ${esc(dateLabel)}${log.captainName ? ` · ${esc(log.captainName)}` : ''}${log.captainLicense ? ` · ${esc(log.captainLicense)}` : ''}${log.harborDeparture ? ` · ${esc(log.harborDeparture)}` : ''}
    </div>
    <div class="logId">${esc(log.logId || '')}</div>
  </header>

  <div class="totals">
    <div class="cell">
      <span class="num">${trips.length}</span>
      <span class="label">Trips</span>
    </div>
    <div class="cell">
      <span class="num">${esc(log.totalGuests || 0)}</span>
      <span class="label">Guests</span>
    </div>
    <div class="cell">
      <span class="num">${incident.occurred ? '1' : '0'}</span>
      <span class="label">Incident</span>
    </div>
  </div>

  <section class="section">
    <h2>Conditions <span class="sub">Abyss · Observed</span></h2>
    ${renderConditions(abyss, observed, t, esc)}
  </section>

  <section class="section">
    <h2>Trips <span class="sub">${trips.length} today</span></h2>
    ${tripsHtml}
  </section>

  ${log.dayNotes ? `
  <section class="section">
    <h2>Day notes</h2>
    <div class="day-notes">${esc(log.dayNotes)}</div>
  </section>` : ''}

  <section class="section">
    <h2>Incident</h2>
    ${renderIncident(incident, esc)}
  </section>

  ${renderSignOff(log, esc)}

  <div class="footer">
    Generated by KaiCast Charter · ${esc(new Date().toISOString())}
  </div>
</body>
</html>`;
}

function renderConditions(abyss, observed, t, esc) {
  const FIELDS = [
    { label: 'Visibility',  a: abyss.visibility,     o: observed.visibility       },
    { label: 'Water temp',  a: abyss.waterTemp,      o: observed.feltTemp         },
    { label: 'Swell',       a: abyss.swellHeight,    o: observed.seaState         },
    { label: 'Swell dir',   a: abyss.swellDirection, o: observed.swellDirObserved },
    { label: 'Wind',        a: abyss.windForecast,   o: observed.windObserved     },
    { label: 'Current',     a: abyss.surfaceCurrent, o: observed.currentObserved  },
    { label: 'Current dir', a: abyss.currentDirection, o: observed.currentDirObserved },
  ];
  const valOrDash = (v) => (v && String(v).trim()) || '—';

  return `<div class="cond-grid">
    <div class="cond-col cond-col-abyss">
      <div class="cond-head">Abyss · Auto</div>
      ${FIELDS.map((f) => `
        <div class="cond-row">
          <div class="cond-label">${esc(f.label)}</div>
          <div class="cond-val">${esc(valOrDash(f.a))}</div>
        </div>`).join('')}
      ${abyss.alerts ? `<div class="cond-note">⚠ ${esc(abyss.alerts)}</div>` : ''}
    </div>
    <div class="cond-col cond-col-observed">
      <div class="cond-head">Observed</div>
      ${FIELDS.map((f) => `
        <div class="cond-row">
          <div class="cond-label">${esc(f.label)}</div>
          <div class="cond-val">${esc(valOrDash(f.o))}</div>
        </div>`).join('')}
      ${observed.captainNote ? `<div class="cond-note">${esc(observed.captainNote)}</div>` : ''}
    </div>
  </div>`;
}

function renderTrip(trip, num, t, esc) {
  const type = String(trip.type || 'other');
  const accent = TRIP_TYPE_COLOR[type] || TRIP_TYPE_COLOR.other;
  // For 'other' trips with a captain-supplied custom label, the
  // custom string takes the slot the FareHarbor trip name would
  // occupy on a synced row. Keeps "Other" out of the PDF entirely.
  const customLabel = type === 'other'
    && trip.tripTypeCustom
    && String(trip.tripTypeCustom).trim();
  const typeLabel = customLabel || TRIP_TYPE_LABEL[type] || type;
  // Title prefers the captain's free-text label; falls back to the
  // legacy title field for old logs.
  const title = (trip.label && String(trip.label).trim())
    || (trip.title && String(trip.title).trim())
    || typeLabel;

  // Meta line: duration + guests, mono-formatted. Legacy
  // passengerCount picked up when the new guestCount isn't set.
  const guests = trip.guestCount != null ? trip.guestCount : (trip.passengerCount ?? null);
  const meta = [
    trip.durationHours != null ? `${formatNum(trip.durationHours)} h` : null,
    guests != null ? `${guests} guests` : null,
    trip.departureTime || null,  // legacy
    trip.primarySite  || null,   // legacy
  ].filter(Boolean).join(' · ');

  // Type-conditional tally lines — only rendered when there's
  // something to show. New lightweight schema uses freeform
  // speciesNotes / certLevelNotes (more useful for the captain's
  // end-of-day workflow); legacy structured fields kept as a
  // fallback so archived logs still render their species count.
  const speciesLabel = type === 'spearfishing' ? 'Catches' : 'Species';
  let speciesLine = '';
  if (trip.speciesNotes && String(trip.speciesNotes).trim()) {
    speciesLine = `<div class="trip-tally"><strong>${speciesLabel}:</strong> ${esc(trip.speciesNotes)}</div>`;
  } else if ((trip.speciesObserved || []).length) {
    speciesLine = `<div class="trip-tally"><strong>${speciesLabel}:</strong> ${
      trip.speciesObserved.map((s) => `${esc(s.species)} ×${esc(s.count)}`).join(', ')
    }</div>`;
  }

  let certLine = '';
  if (type === 'scuba') {
    if (trip.certLevelNotes && String(trip.certLevelNotes).trim()) {
      certLine = `<div class="trip-tally"><strong>Certs:</strong> ${esc(trip.certLevelNotes)}</div>`;
    } else if ((trip.guests || []).length) {
      const certs = trip.guests.filter((g) => g.certLevel).map((g) => esc(g.certLevel));
      if (certs.length) {
        certLine = `<div class="trip-tally"><strong>Certs:</strong> ${certs.join(', ')}</div>`;
      }
    }
  }

  return `<article class="trip" style="border-left-color: ${accent};">
    <div class="trip-index">#${num}</div>
    <div class="trip-main">
      <div class="trip-type" style="color: ${accent};">${esc(typeLabel)}</div>
      <div class="trip-title">${esc(title)}</div>
      ${meta ? `<div class="trip-meta">${esc(meta)}</div>` : ''}
    </div>
    <div></div>
    ${trip.notes ? `<div class="trip-notes">${esc(trip.notes)}</div>` : ''}
    ${speciesLine}
    ${certLine}
  </article>`;
}

function renderIncident(incident, esc) {
  if (!incident || !incident.occurred) {
    return `<div class="incident-card none">
      <div class="incident-head">No incident reported</div>
    </div>`;
  }
  const summary = incident.summary && String(incident.summary).trim();
  return `<div class="incident-card">
    <div class="incident-head">Incident — Reported</div>
    ${summary ? `<div class="incident-summary">${esc(summary)}</div>` : ''}
    <div class="incident-flags">
      ${incident.uscgFlag ? `<span class="flag hazard">USCG notified</span>` : ''}
      ${incident.dlnrFlag ? `<span class="flag warn">DLNR notified</span>` : ''}
    </div>
  </div>`;
}

function renderSignOff(log, esc) {
  const so = log.signOff;
  if (!so) {
    return `<div class="signoff">Draft — not yet signed.</div>`;
  }
  const when = so.signedAt
    ? new Date(so.signedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';
  return `<div class="signoff">
    Signed by <strong>${esc(so.signedBy || log.captainName || 'Captain')}</strong>${when ? ` · ${esc(when)}` : ''}
  </div>`;
}

// ── Utilities ──────────────────────────────────────────────────────

function htmlEscape(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}

function formatNum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  // Trim trailing zero on whole numbers so "2.0 h" prints as "2 h".
  return n % 1 === 0 ? String(n) : String(Math.round(n * 10) / 10);
}

async function uploadAndSign(fileBase, html) {
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const file = bucket.file(`logs/${fileBase}.html`);
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
