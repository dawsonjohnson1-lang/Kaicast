/**
 * Share-card data assembly.
 *
 * Used by both `generateSpotShareImage` (the satori PNG renderer) and
 * `spotSharePage` (the OG-tag HTML page) so the social card and the
 * crawler metadata stay in sync.
 *
 * Reads the same `kaicast_reports/{spotId}_{hourKey}` cache the mobile
 * `getReport` HTTP endpoint and the desktop preview consume. We do NOT
 * recompute a fresh report here — that would 7×-spike every iMessage
 * link unfurl. If no recent cache exists we return null and the
 * callers render a "Check kaicast.com" placeholder.
 *
 * Date semantics:
 *   - `date` is an HST YYYY-MM-DD (the diver-facing date) or null.
 *   - null / today → use `report.now` (live snapshot).
 *   - 1-6 days out → use `report.days[i]` daily aggregate + the most
 *     representative midday window for the 3-hr metric row.
 *   - Beyond the report's horizon → null.
 */

const admin = require('firebase-admin');

const HST_OFFSET_MS = -10 * 3600 * 1000;
const M_TO_FT = 3.28084;
const DIRS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Hex from CLAUDE.md / desktop tokens. Single source so the social
// card and the in-app rating chips look identical to a reader who
// has both open side by side.
const TIER_COLORS = {
  excellent: '#09A1FB',
  great:     '#27D667',
  good:      '#FFD321',
  fair:      '#FF9D25',
  'no-go':   '#F73726',
};

const TIER_LABELS = {
  excellent: 'Excellent',
  great:     'Great',
  good:      'Good',
  fair:      'Fair',
  'no-go':   'No-go',
};

/** Compute the diver-facing HST date for a given UTC instant. */
function hstDateKey(ms) {
  const d = new Date(ms + HST_OFFSET_MS);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function tierFromRating(r) {
  const label = (r && (r.label || r.rating) ? String(r.label || r.rating) : '').toLowerCase();
  if (label.includes('excellent')) return 'excellent';
  if (label.includes('great'))     return 'great';
  if (label.includes('good'))      return 'good';
  if (label.includes('fair'))      return 'fair';
  if (label.includes('no-go') || label.includes('nogo')) return 'no-go';
  const s = r && typeof r.score === 'number' ? r.score : null;
  if (s == null) return 'good';
  if (s >= 80) return 'excellent';
  if (s >= 60) return 'great';
  if (s >= 40) return 'good';
  if (s >= 20) return 'fair';
  return 'no-go';
}

function tierFromScore(score) {
  if (score == null) return 'good';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
}

function degToCompass(deg) {
  if (deg == null || !Number.isFinite(deg)) return '';
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return DIRS_8[idx];
}

/** Walk up to 6h back for the most recent cached report (matches the
 *  resilience of readCachedReport in index.js but lighter — no schema
 *  upgrade guards, since stale caches are still good enough for a
 *  share preview). */
async function readLatestReport(db, spotId, nowMs) {
  for (let h = 0; h < 6; h++) {
    const at = new Date(nowMs - h * 3600000);
    const yyyy = String(at.getUTCFullYear());
    const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(at.getUTCDate()).padStart(2, '0');
    const hh = String(at.getUTCHours()).padStart(2, '0');
    const hourKey = `${yyyy}${mm}${dd}${hh}`;
    const snap = await db.collection('kaicast_reports').doc(`${spotId}_${hourKey}`).get();
    if (snap.exists) return snap.data();
  }
  return null;
}

/** Format the date row on the card. "Today" / "Tomorrow" / "Fri, Jun 7". */
function formatDateLabel(dateKey, todayHst) {
  if (!dateKey) return 'Today';
  if (dateKey === todayHst) return 'Today';
  const tomorrow = new Date(Date.parse(todayHst + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  if (dateKey === tomorrow) return 'Tomorrow';
  const d = new Date(dateKey + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

/** One-sentence summary templated from the rating label + key metrics.
 *  No LLM — deterministic so the OG image cache stays stable. */
function buildSummary({ tier, visFt, swellFt, swellPeriodS, windKt, windDir }) {
  const label = TIER_LABELS[tier];
  const parts = [];
  if (visFt != null)   parts.push(`${visFt} ft viz`);
  if (swellFt != null) parts.push(swellPeriodS != null ? `${swellFt} ft @ ${Math.round(swellPeriodS)}s swell` : `${swellFt} ft swell`);
  if (windKt != null)  parts.push(windDir ? `${windKt} kt ${windDir} wind` : `${windKt} kt wind`);
  if (parts.length === 0) return `${label} conditions.`;
  return `${label} — ${parts.join(', ')}.`;
}

/** Pick the most representative window for a future day: prefer the
 *  highest-scoring window between 9am–3pm HST (a diver's planning
 *  window). Falls back to any window on the day, then null. */
function pickRepresentativeWindow(windows, dateHst) {
  if (!Array.isArray(windows)) return null;
  const onDay = windows.filter((w) => {
    if (!w.startIso) return false;
    return hstDateKey(Date.parse(w.startIso)) === dateHst;
  });
  if (onDay.length === 0) return null;
  const midday = onDay.filter((w) => {
    const hHst = new Date(Date.parse(w.startIso) + HST_OFFSET_MS).getUTCHours();
    return hHst >= 9 && hHst <= 15;
  });
  const pool = midday.length > 0 ? midday : onDay;
  return pool.reduce((best, w) => {
    const s = (w.rating && typeof w.rating.score === 'number') ? w.rating.score : -1;
    const bs = (best.rating && typeof best.rating.score === 'number') ? best.rating.score : -1;
    return s > bs ? w : best;
  });
}

/**
 * Build the data the share card and OG page render.
 *
 * @param {object} opts
 * @param {string} opts.spotId   Canonical spot slug.
 * @param {string|null} opts.date  HST YYYY-MM-DD, or null for "today".
 * @returns {Promise<object|null>}  null when no cache exists at all.
 */
async function buildShareData({ spotId, date }) {
  const db = admin.firestore();
  const nowMs = Date.now();
  const todayHst = hstDateKey(nowMs);
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayHst;
  const isToday = targetDate === todayHst;

  const report = await readLatestReport(db, spotId, nowMs);
  if (!report) return null;

  // Spot identity — always pull from the report so we trust whatever
  // the canonical SPOTS array said at report-build time. Falls back to
  // the slug if a brand-new spot's first report hasn't shipped these
  // fields yet.
  const spotName = report.spotName || prettifySlug(spotId);
  const island = islandFromCoast(report.spotCoast) || '';

  let tier;
  let visFt = null;
  let swellFt = null;
  let swellPeriodS = null;
  let windKt = null;
  let windDir = '';

  if (isToday) {
    const now = report.now || {};
    tier = tierFromRating(now.rating);
    const visM = now.visibility && now.visibility.estimatedVisibilityMeters;
    if (typeof visM === 'number') visFt = Math.round(visM * M_TO_FT);
    const m = now.metrics || {};
    if (typeof m.waveHeightM === 'number') swellFt = Math.round(m.waveHeightM * M_TO_FT * 10) / 10;
    if (typeof m.wavePeriodS === 'number') swellPeriodS = m.wavePeriodS;
    if (typeof m.windSpeedKts === 'number') windKt = Math.round(m.windSpeedKts);
    if (typeof m.windDeg === 'number') windDir = degToCompass(m.windDeg);
  } else {
    const day = (Array.isArray(report.days) ? report.days : []).find((d) => d && d.date === targetDate);
    const win = pickRepresentativeWindow(report.windows, targetDate);
    if (!day && !win) return null;
    // Tier from the daily aggregate score when present (matches the
    // 7-day strip on the desktop); falls back to the representative
    // window's rating.
    if (day && typeof day.score === 'number')             tier = tierFromScore(day.score);
    else if (win && win.rating)                            tier = tierFromRating(win.rating);
    else                                                   tier = 'good';
    if (win && win.visibility && typeof win.visibility.estimatedVisibilityMeters === 'number') {
      visFt = Math.round(win.visibility.estimatedVisibilityMeters * M_TO_FT);
    }
    const waveAvgM = day && (day.waveAvgM != null ? day.waveAvgM : day.waveMaxM);
    if (typeof waveAvgM === 'number') swellFt = Math.round(waveAvgM * M_TO_FT * 10) / 10;
    if (day && typeof day.wavePeriodS === 'number') swellPeriodS = day.wavePeriodS;
    else if (win && win.avg && typeof win.avg.wavePeriodS === 'number') swellPeriodS = win.avg.wavePeriodS;
    if (day && typeof day.windAvgKts === 'number') windKt = Math.round(day.windAvgKts);
    else if (win && win.avg && typeof win.avg.windSpeedKts === 'number') windKt = Math.round(win.avg.windSpeedKts);
    // Daily aggregates don't carry wind direction; the representative
    // window does. The "now" snapshot's direction is the right
    // fallback when both are missing.
    if (win && win.avg && typeof win.avg.windDeg === 'number') windDir = degToCompass(win.avg.windDeg);
    else if (report.now && report.now.metrics && typeof report.now.metrics.windDeg === 'number') {
      windDir = degToCompass(report.now.metrics.windDeg);
    }
  }

  const summary = buildSummary({ tier, visFt, swellFt, swellPeriodS, windKt, windDir });
  const dateLabel = formatDateLabel(targetDate, todayHst);

  return {
    spotId,
    spotName,
    island,
    date: targetDate,
    dateLabel,
    isToday,
    tier,
    tierLabel: TIER_LABELS[tier],
    tierColor: TIER_COLORS[tier],
    visFt,
    swellFt,
    swellPeriodS,
    windKt,
    windDir,
    summary,
    generatedAt: report.generatedAt || null,
  };
}

function prettifySlug(slug) {
  return String(slug || '')
    .split('-')
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(' ');
}

function islandFromCoast(coast) {
  if (!coast) return '';
  // `spotCoast` values in the report look like "Oahu-Leeward" or
  // "Maui-South" — the island is the prefix. Title-case it for the
  // share card header.
  const island = String(coast).split('-')[0];
  if (!island) return '';
  return island === 'Oahu' ? "O'ahu"
       : island === 'Kauai' ? "Kaua'i"
       : island === 'Hawaii' ? 'Big Island'
       : island;
}

module.exports = {
  buildShareData,
  TIER_COLORS,
  TIER_LABELS,
  hstDateKey,
  formatDateLabel,
  prettifySlug,
};
