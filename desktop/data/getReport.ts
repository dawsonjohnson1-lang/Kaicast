// Thin client for the deployed `getReport` Firebase Function. The
// desktop preview talks to the same us-central1 endpoint the mobile
// app uses; no Firebase Web SDK is required since `getReport` is an
// unauthenticated onRequest HTTP function returning JSON.
//
// The hook below caches in-memory per spotId so re-navigating between
// spots doesn't re-fetch immediately. Reports refresh every 5 min on
// remount; the backend itself only regenerates hourly.

import { useEffect, useState } from 'react';

const ENDPOINT = 'https://us-central1-kaicast-207dc.cloudfunctions.net/getReport';

export type BackendRating = {
  rating?: string;
  label?: string;
  score?: number;
  reason?: string;
  cautionNote?: string;
};

export type BackendWindow = {
  startIso: string;
  endIso?: string;
  avg?: {
    windSpeedKts?: number | null;
    windGustKts?: number | null;
    waveHeightM?: number | null;
    wavePeriodS?: number | null;
    waterTempC?: number | null;
  };
  rating?: BackendRating;
  visibility?: { estimatedVisibilityMeters?: number | null };
};

export type BackendDay = {
  date: string;
  waveMinM?: number | null;
  waveMaxM?: number | null;
  waveAvgM?: number | null;
  wavePeriodS?: number | null;
  windAvgKts?: number | null;
  windMaxKts?: number | null;
  rainTotalMM?: number | null;
};

export type BackendReport = {
  spotId: string;
  generatedAt: string;
  confidence?: number | null;
  sources?: string[];
  qcFlags?: string[];
  now: {
    metrics: Record<string, number | null>;
    visibility?: {
      estimatedVisibilityMeters?: number | null;
      kd490?: number | null;
      chlorophyll?: number | null;
    };
    rating: BackendRating;
    runoff?: { severity?: string; safeToEnter?: boolean; healthRisk?: string };
    tide?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  };
  windows: BackendWindow[];
  days?: BackendDay[];
  tide?: Record<string, unknown>;
};

const inflight = new Map<string, Promise<BackendReport>>();
const cache = new Map<string, { at: number; data: BackendReport }>();
const CACHE_MS = 5 * 60 * 1000;

async function fetchReport(spotId: string): Promise<BackendReport> {
  const cached = cache.get(spotId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  const existing = inflight.get(spotId);
  if (existing) return existing;
  const p = (async () => {
    const url = `${ENDPOINT}?spotId=${encodeURIComponent(spotId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`getReport ${res.status}`);
    const json = (await res.json()) as BackendReport;
    cache.set(spotId, { at: Date.now(), data: json });
    inflight.delete(spotId);
    return json;
  })();
  inflight.set(spotId, p);
  return p;
}

export type SpotReportState = {
  data: BackendReport | null;
  loading: boolean;
  error: string | null;
};

export function useSpotReport(spotId: string | undefined): SpotReportState {
  const [state, setState] = useState<SpotReportState>({
    data: spotId ? cache.get(spotId)?.data ?? null : null,
    loading: !!spotId,
    error: null,
  });

  useEffect(() => {
    if (!spotId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchReport(spotId)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((err: Error) => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [spotId]);

  return state;
}

// ─── derivers ─────────────────────────────────────────────────────────────

/**
 * Representative spot for the global "HAWAII · NN°F" util-bar readout.
 * The top nav isn't spot-scoped, so we sample air temperature from one
 * central, reliably-instrumented Oahu spot. Air temp barely varies
 * island-to-island, so this stands in fine for an ambient reading.
 */
const STATUS_BAR_SPOT_ID = 'hanauma-bay';

/**
 * Current Hawaii air temperature in whole °F for the nav util bar, or
 * null while the report loads / when it carries no air-temp metric.
 * Sourced from the same backend report the forecast screens use
 * (`now.metrics.airTempC`), converted C→F. Callers should omit the
 * temperature segment when this is null rather than show a stale value.
 *
 * To show water temperature instead, read `now.metrics.waterTempC`.
 */
export function useHawaiiAirTempF(): number | null {
  const { data } = useSpotReport(STATUS_BAR_SPOT_ID);
  const c = data?.now?.metrics?.airTempC;
  if (c == null || !Number.isFinite(c)) return null;
  return Math.round((c * 9) / 5 + 32);
}

const TIER_FROM_SCORE = (score: number | undefined | null): 'excellent' | 'great' | 'good' | 'fair' | 'no-go' => {
  if (score == null) return 'good';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'great';
  if (score >= 40) return 'good';
  if (score >= 20) return 'fair';
  return 'no-go';
};

export function tierFromRating(r: BackendRating | undefined): 'excellent' | 'great' | 'good' | 'fair' | 'no-go' {
  // Single source of truth: the numeric score, mapped via TIER_FROM_SCORE.
  // Previously this preferred the backend's string label (`r.label` /
  // `r.rating`) which caused the map markers (label-driven) to disagree
  // with the spot detail page's day strip + hourly card (score-driven)
  // whenever server-side label thresholds drifted from the client's.
  // Label is now a last-resort fallback for legacy docs that have no
  // numeric score at all.
  if (typeof r?.score === 'number' && Number.isFinite(r.score)) {
    return TIER_FROM_SCORE(r.score);
  }
  const label = (r?.label ?? r?.rating ?? '').toLowerCase();
  if (label.includes('excellent')) return 'excellent';
  if (label.includes('great'))     return 'great';
  if (label.includes('good'))      return 'good';
  if (label.includes('fair'))      return 'fair';
  if (label.includes('no-go') || label.includes('nogo')) return 'no-go';
  return 'good';
}

const HOUR_LABEL = (h: number): string => {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
};

/**
 * Best window for the next 24h — the highest-scoring 3-hour window.
 * Returns a human-readable string like "9am – 12pm".
 */
export function bestWindowLabel(windows: BackendWindow[] | undefined): string | null {
  if (!Array.isArray(windows) || windows.length === 0) return null;
  let best: BackendWindow | null = null;
  for (const w of windows) {
    if (!best || (w.rating?.score ?? -1) > (best.rating?.score ?? -1)) best = w;
  }
  if (!best?.startIso) return null;
  const startMs = Date.parse(best.startIso);
  if (!Number.isFinite(startMs)) return null;
  const startHour = new Date(startMs).getHours();
  const endHour = (startHour + 3) % 24;
  return `${HOUR_LABEL(startHour)} – ${HOUR_LABEL(endHour)}`;
}

const M_TO_FT = 3.28084;

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Aggregate score from a daily forecast row. Mirrors the mobile app's
 * `aggregateDayScore`: continuous penalties on wind, swell, rain so
 * neighboring days don't all clip to the same tier.
 */
export function aggregateDayScore(day: BackendDay): number {
  const swellM = day.waveAvgM ?? 1;
  const wind = day.windAvgKts ?? 10;
  const rain = day.rainTotalMM ?? 0;
  let score = 78;
  score -= Math.max(0, swellM - 1) * 12;
  score -= Math.max(0, wind - 8) * 2;
  score -= Math.min(30, rain * 1.2);
  if (wind < 10 && swellM < 1.2 && rain < 1) score += 6;
  return clampScore(score);
}

/**
 * Bucket the report's windows by 3-hour slot for a single day. Index
 * 0 = 00-03, 1 = 03-06, ..., 7 = 21-24. Returns undefined for slots
 * the backend didn't return a window for (e.g. truncated reports).
 *
 * `dayOffset` is days from today (0 today, 1 tomorrow, ...).
 *
 * This is the SAME slicing logic the hourly card uses, so the day
 * card's bars and the hourly badges literally read the same scores.
 */
export function windowsForDayOffset(
  allWindows: BackendWindow[] | undefined,
  dayOffset: number,
): Array<BackendWindow | undefined> {
  const out = new Array<BackendWindow | undefined>(8);
  if (!Array.isArray(allWindows) || allWindows.length === 0) return out;
  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + dayOffset);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const datePrefix = `${yyyy}-${mm}-${dd}`;
  for (const w of allWindows) {
    if (!w.startIso?.startsWith(datePrefix)) continue;
    const ms = Date.parse(w.startIso);
    if (!Number.isFinite(ms)) continue;
    const idx = Math.floor(new Date(ms).getHours() / 3);
    if (idx >= 0 && idx < 8) out[idx] = w;
  }
  return out;
}

/**
 * 8 × 3h bar tiers for the day card. Source of truth: the hourly
 * window's own `rating.score` from the backend. The hourly table
 * badges read from the exact same scores via `TIER_FROM_SCORE`, so
 * the two views can no longer disagree.
 *
 * Slots without a window (truncated report, off-hour) fall back to
 * the day-level aggregate so the strip stays visually complete.
 */
export function dayBars(
  day: BackendDay,
  buckets?: Array<BackendWindow | undefined>,
): Array<'excellent' | 'great' | 'good' | 'fair' | 'no-go'> {
  const fallback = aggregateDayScore(day);
  if (!buckets) return [0, 0, 0, 0, 0, 0, 0, 0].map(() => TIER_FROM_SCORE(fallback));
  return buckets.map((w) => {
    const s = w?.rating?.score;
    return TIER_FROM_SCORE(typeof s === 'number' ? s : fallback);
  });
}

/**
 * Day's overall score = average of its window scores. Falls back to
 * the day-level aggregate when no windows exist. Used to derive the
 * top accent color AND the star count so all three day-card visual
 * elements (accent / stars / bars) tell the same story.
 */
export function dayOverallScore(
  day: BackendDay,
  buckets?: Array<BackendWindow | undefined>,
): number {
  const fallback = aggregateDayScore(day);
  if (!buckets) return fallback;
  const scores: number[] = [];
  for (const w of buckets) {
    const s = w?.rating?.score;
    if (typeof s === 'number' && Number.isFinite(s)) scores.push(s);
  }
  if (scores.length === 0) return fallback;
  return clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Desktop ForecastDay shape (waveLo/Hi in ft, vis string, 8 bars).
 * Derives label / date in the spot's local-ish frame; we assume Hawaii
 * for now since every canonical spot is in Hawaii.
 */
export type DesktopForecastDay = {
  label: string;
  date: string;
  rating: 'excellent' | 'great' | 'good' | 'fair' | 'no-go';
  waveLo: number;
  waveHi: number;
  vis: string;
  bars: Array<'excellent' | 'great' | 'good' | 'fair' | 'no-go'>;
};

export type DesktopHourRow = {
  time: string;
  rating: 'excellent' | 'great' | 'good' | 'fair' | 'no-go';
  stars: number;
  wave: string;
  vis: string;
  wind: string;
  current: string;
  tide: string;
  swell: string;
};

const KT_TO_MPH = 1.15078;
const DIRS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function degToCompass(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return '';
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return DIRS_8[idx];
}

function hourLabelSpaced(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function starsFromScore(score: number | undefined | null): number {
  if (score == null) return 3;
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

// Linear interp tide height at `atMs` from the named tide events the
// backend ships under report.tide. Same shape SpotsMapScreen's
// "now" tide chip uses — five labeled events across a half-cycle.
function tideAt(tide: Record<string, unknown> | undefined, atMs: number): { heightFt: number; rising: boolean } | null {
  if (!tide) return null;
  const pairs: Array<[string, string]> = [
    ['lowTide1Time', 'lowTide1Height'],
    ['risingTideTime', 'risingTideHeight'],
    ['highTideTime', 'highTideHeight'],
    ['fallingTideTime', 'fallingTideHeight'],
    ['lowTide2Time', 'lowTide2Height'],
  ];
  const events: Array<{ t: number; h: number }> = [];
  for (const [tk, hk] of pairs) {
    const iso = tide[tk];
    const h = tide[hk];
    if (typeof iso === 'string' && typeof h === 'number') {
      const t = Date.parse(iso);
      if (Number.isFinite(t)) events.push({ t, h });
    }
  }
  events.sort((a, b) => a.t - b.t);
  if (events.length < 2) return null;
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (atMs >= a.t && atMs <= b.t) {
      const frac = (atMs - a.t) / Math.max(1, b.t - a.t);
      return { heightFt: a.h + (b.h - a.h) * frac, rising: b.h > a.h };
    }
  }
  if (atMs < events[0].t) return { heightFt: events[0].h, rising: events[1].h > events[0].h };
  const last = events[events.length - 1];
  const prev = events[events.length - 2];
  return { heightFt: last.h, rising: last.h > prev.h };
}

/**
 * Per-row hourly forecast derived from the same `report.windows` the
 * day aggregates roll up from — keeps the "Hourly forecast · today"
 * table in sync with the "7-day forecast" strip above it. Windows are
 * 3-hour slots (backend granularity), so each row covers 3 hours
 * starting at `window.startIso`.
 *
 * Per-window fields:
 *   - wave / vis / wind / rating / stars come from `window.avg` and
 *     `window.rating` directly
 *   - current is the standard wind-driven surface-current proxy
 *     (≈3% of wind speed) used elsewhere in the desktop UI
 *   - tide is interpolated at the window's start time against the
 *     report-level tide events
 *
 * Static-per-report fields (windows don't carry these):
 *   - swell direction from `now.metrics.waveDirectionDegFrom`
 *   - wind direction from `now.metrics.windDeg`
 */
// `dayOffset` filters the report's windows down to the calendar date
// `dayOffset` days from today (0 = today, 1 = tomorrow, ...). Lets the
// hourly card pivot between days when the user clicks a card in the
// 7-day strip. Falls back to the full window list when no windows
// match (cold report, late-night edge cases) so the card never goes
// blank.
export function backendReportToHours(
  report: BackendReport,
  count = 8,
  dayOffset = 0,
): DesktopHourRow[] {
  let windows = report.windows ?? [];
  if (windows.length === 0) return [];

  // Always filter to the requested HST calendar day (including today).
  // The previous code skipped the filter when dayOffset === 0, which
  // let the first 8 windows wrap past midnight HST and produced rows
  // ordered "8A, 11A, 2P, 5P, 8P, 11P, 2A, 5A" — visually backwards.
  // We also build the target date in Hawaii-local time (not the
  // browser's tz), and compare each window's startIso in Hawaii-local
  // time. Otherwise a viewer in EST sees Hawaii's evening windows
  // attributed to "tomorrow" in their browser tz.
  const hstDateOf = (ms: number): string => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Honolulu',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(new Date(ms));
  };
  const targetMs = Date.now() + dayOffset * 86400000;
  const targetHstDate = hstDateOf(targetMs);

  const filtered = windows.filter((w) => {
    const ms = Date.parse(w.startIso ?? '');
    if (!Number.isFinite(ms)) return false;
    return hstDateOf(ms) === targetHstDate;
  });
  // Sort chronologically as a safety net — backend usually returns in
  // order but we don't want a single out-of-order entry to scramble
  // the table.
  filtered.sort((a, b) => Date.parse(a.startIso ?? '') - Date.parse(b.startIso ?? ''));
  // If the report doesn't carry windows for the requested day, fall
  // back to the full chronologically-sorted list — better than an
  // empty table. Trim to today's HST date range anyway by walking
  // until we cross midnight HST.
  if (filtered.length === 0) {
    const sorted = [...windows].sort((a, b) => Date.parse(a.startIso ?? '') - Date.parse(b.startIso ?? ''));
    const fallback: typeof sorted = [];
    let lastHstDate: string | null = null;
    for (const w of sorted) {
      const ms = Date.parse(w.startIso ?? '');
      if (!Number.isFinite(ms)) continue;
      const hstDate = hstDateOf(ms);
      if (lastHstDate && hstDate !== lastHstDate) break;
      lastHstDate = hstDate;
      fallback.push(w);
    }
    windows = fallback.length > 0 ? fallback : sorted;
  } else {
    windows = filtered;
  }
  const nowMetrics = (report.now?.metrics ?? {}) as Record<string, number | null | undefined>;
  const swellDir = nowMetrics.waveDirectionDegFrom;
  const swellLabel = swellDir != null && Number.isFinite(swellDir)
    ? `${Math.round(swellDir)}° ${degToCompass(swellDir)}`
    : '—';
  const windDirCompass = degToCompass(nowMetrics.windDeg);
  const tideObj = (report.tide ?? (report.now as { tide?: Record<string, unknown> } | undefined)?.tide) as Record<string, unknown> | undefined;

  return windows.slice(0, count).map((w): DesktopHourRow => {
    const startMs = Date.parse(w.startIso ?? '');
    const hasStart = Number.isFinite(startMs);
    // Hour-label in HAWAII local time, not the browser's timezone.
    // A viewer in EST/PST would otherwise see times shifted 3-5 hours
    // off what a Hawaii diver expects.
    const time = hasStart
      ? hourLabelSpaced(
          Number(new Intl.DateTimeFormat('en-US', {
            timeZone: 'Pacific/Honolulu',
            hour: 'numeric',
            hour12: false,
          }).format(new Date(startMs))),
        )
      : '—';

    const waveHM = w.avg?.waveHeightM;
    const waveFt = waveHM == null ? null : Math.round(waveHM * M_TO_FT * 10) / 10;
    const period = w.avg?.wavePeriodS;
    const wave = waveFt != null
      ? (period != null ? `${waveFt.toFixed(1)} FT @ ${Math.round(period)}s` : `${waveFt.toFixed(1)} FT`)
      : '—';

    const visM = w.visibility?.estimatedVisibilityMeters;
    const vis = visM != null ? `${Math.round(visM * M_TO_FT)} FT` : '—';

    const windKt = w.avg?.windSpeedKts;
    const wind = windKt != null
      ? `${Math.round(windKt)} KT${windDirCompass ? ' ' + windDirCompass : ''}`
      : '—';

    const currentKt = windKt == null ? null : Math.max(0.1, Math.round(windKt * 0.03 * 10) / 10);
    const current = currentKt != null ? `${currentKt.toFixed(1)} KT` : '—';

    const rating = TIER_FROM_SCORE(w.rating?.score);
    const stars = starsFromScore(w.rating?.score);

    let tide = '—';
    if (hasStart) {
      const t = tideAt(tideObj, startMs);
      if (t) tide = `${t.heightFt >= 0 ? '+' : ''}${t.heightFt.toFixed(1)} FT`;
    }

    return { time, rating, stars, wave, vis, wind, current, tide, swell: swellLabel };
  });
}

export function backendDayToDesktopDay(
  day: BackendDay,
  buckets?: Array<BackendWindow | undefined>,
): DesktopForecastDay {
  // `date` from backend is `YYYY-MM-DD`; treat as local midday so the
  // weekday formatter doesn't slip a day from UTC offset issues.
  const d = day.date ? new Date(day.date + 'T12:00:00') : new Date();
  const label = d.toLocaleDateString(undefined, { weekday: 'short' });
  const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lo = Math.max(0, Math.round((day.waveMinM ?? 0) * M_TO_FT));
  const hi = Math.max(lo, Math.round((day.waveMaxM ?? day.waveAvgM ?? 0) * M_TO_FT));

  // Visibility range — derive from the SAME per-window vis values the
  // hourly card reads (windows[].visibility.estimatedVisibilityMeters),
  // so the day strip and the hourly bars can't tell different stories.
  // Previously this was a synthetic `base ± 10` heuristic that ignored
  // the actual hourly spread — the strip said "42–60" while hourly
  // showed 25–75.
  let visLo: number;
  let visHi: number;
  const windowVisFt = (buckets ?? [])
    .map((w) => w?.visibility?.estimatedVisibilityMeters)
    .filter((m): m is number => typeof m === 'number' && Number.isFinite(m))
    .map((m) => Math.round(m * M_TO_FT));
  if (windowVisFt.length > 0) {
    visLo = Math.max(5, Math.min(...windowVisFt));
    visHi = Math.min(80, Math.max(...windowVisFt));
    // Guarantee a sensible range even when all windows report the same
    // value — show e.g. "60FT" not "60–60FT". Mapping handled in the
    // display string below.
  } else {
    // Fallback: legacy heuristic when this day has no windows attached
    // (truncated report, off-hour, etc.). Preserves the old behavior so
    // the strip never renders "—".
    const swellAvgM = day.waveAvgM ?? 1;
    const rain = day.rainTotalMM ?? 0;
    const base = Math.max(8, Math.min(80, Math.round(60 - swellAvgM * 10 - rain * 0.8)));
    visLo = Math.max(5, base - 10);
    visHi = Math.min(80, base + 10);
  }
  // One score drives all three day-card visuals (top accent, stars in
  // ForecastDayCard, and the bars) — derived from the same windows
  // the hourly card renders.
  const score = dayOverallScore(day, buckets);
  return {
    label,
    date: dateLabel,
    rating: TIER_FROM_SCORE(score),
    waveLo: lo,
    waveHi: hi,
    vis: visLo === visHi ? `${visLo}FT` : `${visLo}–${visHi}FT`,
    bars: dayBars(day, buckets),
  };
}

/**
 * Map a full backend report → 7 day cards using the report's windows
 * as the source of truth. Use this instead of mapping
 * backendDayToDesktopDay directly when you have access to
 * report.windows — it ensures the strip and the hourly table can't
 * tell different stories about the same day.
 */
export function backendReportToDesktopDays(report: BackendReport): DesktopForecastDay[] {
  const days = report.days ?? [];
  return days.slice(0, 7).map((day, i) => {
    const buckets = windowsForDayOffset(report.windows, i);
    return backendDayToDesktopDay(day, buckets);
  });
}

/**
 * Bulk-fetch ratings for many spotIds at once. Useful for the spots-map
 * sidebar and dashboard favorites: each row needs its current rating
 * tier (excellent/great/good/fair/no-go) but we don't want one fetch
 * per row firing serially. Each lookup hits the per-spot cache so
 * navigating around doesn't re-fetch.
 */
export function useSpotRatings(spotIds: string[]): Map<string, 'excellent' | 'great' | 'good' | 'fair' | 'no-go'> {
  const key = spotIds.slice().sort().join('|');
  const [ratings, setRatings] = useState<Map<string, 'excellent' | 'great' | 'good' | 'fair' | 'no-go'>>(new Map());

  useEffect(() => {
    if (spotIds.length === 0) return;
    let cancelled = false;
    Promise.allSettled(spotIds.map((id) => fetchReport(id))).then((results) => {
      if (cancelled) return;
      const next = new Map<string, 'excellent' | 'great' | 'good' | 'fair' | 'no-go'>();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          next.set(spotIds[i], tierFromRating(r.value.now?.rating));
        }
      });
      setRatings(next);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return ratings;
}

export function relativeTime(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 0 || delta < 60_000) return 'just now';
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ms).toLocaleDateString();
}
