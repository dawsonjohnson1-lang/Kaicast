// reportConditions — MOBILE mirror of desktop/charter/reportConditions.ts,
// adapted to the mobile BackendReport shape (@/api/kaicast). Normalizes a
// report into a per-day conditions object (0 = today, 1 = tomorrow) that
// the vessel-summary + chip engines consume. Every field traces to a real
// pipeline value; missing fields stay null and are omitted downstream.

import type { BackendReport } from '@/api/kaicast';

const M_TO_FT = 3.28084;
const KT_FROM_WIND_CURRENT = 0.03;
const DIRS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

type Win = {
  startIso?: string;
  avg?: {
    windSpeedKts?: number | null;
    windGustKts?: number | null;
    waveHeightM?: number | null;
    wavePeriodS?: number | null;
    waterTempC?: number | null;
  };
  visibility?: { estimatedVisibilityMeters?: number | null };
  rating?: { score?: number | null };
};

function degToCompass(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return '';
  return DIRS_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
function cToF(c: number | null | undefined): number | null {
  return c == null || !Number.isFinite(c) ? null : Math.round((c * 9) / 5 + 32);
}
function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** HST calendar date (YYYY-MM-DD) for an epoch ms. */
function hstDateOf(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Honolulu', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
}

/** The 8 × 3hr windows for the HST day `dayOffset` days from today.
 *  Inlined here (desktop keeps this in getReport.ts). */
function windowsForDayOffset(allWindows: Win[] | undefined, dayOffset: number): Array<Win | undefined> {
  const out = new Array<Win | undefined>(8);
  if (!Array.isArray(allWindows) || allWindows.length === 0) return out;
  const target = hstDateOf(Date.now() + dayOffset * 86400000);
  for (const w of allWindows) {
    const ms = Date.parse(w.startIso ?? '');
    if (!Number.isFinite(ms)) continue;
    if (hstDateOf(ms) !== target) continue;
    // Bucket by HST hour / 3.
    const hourHst = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Pacific/Honolulu', hour: 'numeric', hour12: false,
    }).format(new Date(ms)));
    const idx = Math.floor((hourHst % 24) / 3);
    if (idx >= 0 && idx < 8) out[idx] = w;
  }
  return out;
}

export interface BoxJelly {
  open: boolean;
  daysUntil: number;
  label: string;
}

export interface DayConditions {
  dayOffset: number;
  label: string;
  hasData: boolean;
  waveFt: number | null;
  waveMinFt: number | null;
  waveMaxFt: number | null;
  periodS: number | null;
  windAvgKt: number | null;
  windMaxKt: number | null;
  gustKt: number | null;
  windDir: string;
  amWindKt: number | null;
  pmWindKt: number | null;
  amWaveFt: number | null;
  pmWaveFt: number | null;
  visibilityFt: number | null;
  rainMM: number | null;
  waterTempF: number | null;
  thermoclineFt: number | null;
  currentKt: number | null;
  boxJelly: BoxJelly | null;
}

function daytime(buckets: Array<Win | undefined>): Win[] {
  return buckets.slice(2, 6).filter((w): w is Win => !!w);
}
function maxWaveFt(ws: Win[]): number | null {
  const v = ws.map((w) => w.avg?.waveHeightM).filter((m): m is number => m != null).map((m) => m * M_TO_FT);
  return v.length ? Math.round(Math.max(...v) * 10) / 10 : null;
}
function minWaveFt(ws: Win[]): number | null {
  const v = ws.map((w) => w.avg?.waveHeightM).filter((m): m is number => m != null).map((m) => m * M_TO_FT);
  return v.length ? Math.round(Math.min(...v) * 10) / 10 : null;
}
function avgWindKt(ws: Win[]): number | null {
  const a = avg(ws.map((w) => w.avg?.windSpeedKts).filter((n): n is number => n != null));
  return a == null ? null : Math.round(a);
}
function avgWaveFt(ws: Win[]): number | null {
  const a = avg(ws.map((w) => w.avg?.waveHeightM).filter((n): n is number => n != null));
  return a == null ? null : Math.round(a * M_TO_FT * 10) / 10;
}

/** Box-jelly window from the report's own moon read (daysSinceFullMoon).
 *  South-shore Oahu jellies appear 8–10 days after a full moon — same
 *  rule the desktop moon-phase calc uses. */
function boxJellyFromMoon(report: BackendReport, dayOffset: number): BoxJelly | null {
  const since = report.now?.analysis?.moon?.daysSinceFullMoon;
  if (since == null || !Number.isFinite(since)) return null;
  const d = since + dayOffset;
  if (d >= 8 && d < 11) {
    return { open: true, daysUntil: 0, label: `Box jelly window open (day ${Math.floor(d - 8) + 1} of 3)` };
  }
  if (d < 8 && d >= 6) {
    const daysUntil = Math.ceil(8 - d);
    return { open: false, daysUntil, label: `Box jelly window opens in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}` };
  }
  return null;
}

export function dayConditions(report: BackendReport | null, dayOffset: number): DayConditions {
  const label = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : `+${dayOffset}d`;
  const box = report ? boxJellyFromMoon(report, dayOffset) : null;
  if (!report) return blankDay(dayOffset, label, box);

  const buckets = windowsForDayOffset(report.windows as Win[] | undefined, dayOffset);
  const day = daytime(buckets);
  const am = [buckets[2], buckets[3]].filter((w): w is Win => !!w);
  const pm = [buckets[4], buckets[5]].filter((w): w is Win => !!w);

  const periodS = (() => {
    const a = avg(day.map((w) => w.avg?.wavePeriodS).filter((n): n is number => n != null));
    return a == null ? null : Math.round(a);
  })();
  const visFt = (() => {
    const v = day.map((w) => w.visibility?.estimatedVisibilityMeters).filter((m): m is number => m != null);
    return v.length ? Math.round(Math.min(...v) * M_TO_FT) : null;
  })();
  const waterTempF = (() => {
    if (dayOffset === 0) {
      // subsurface isn't in the mobile BackendReport type but the backend
      // writes it — read defensively.
      const sub = (report.now as { subsurface?: { surfaceTempC?: number | null } } | undefined)?.subsurface?.surfaceTempC;
      const now = report.now?.metrics?.waterTempC;
      const c = sub ?? now;
      if (c != null) return cToF(c);
    }
    const a = avg(day.map((w) => w.avg?.waterTempC).filter((n): n is number => n != null));
    return a == null ? null : cToF(a);
  })();
  const thermoclineFt = (() => {
    if (dayOffset !== 0) return null;
    const m = (report.now as { subsurface?: { thermoclineDepthM?: number | null } } | undefined)?.subsurface?.thermoclineDepthM;
    return m != null && Number.isFinite(m) ? Math.round(m * M_TO_FT) : null;
  })();

  const windAvgKt = avgWindKt(day);
  const windMaxKt = (() => {
    const v = day.map((w) => w.avg?.windSpeedKts).filter((n): n is number => n != null);
    return v.length ? Math.round(Math.max(...v)) : null;
  })();
  const gustKt = (() => {
    const v = day.map((w) => w.avg?.windGustKts).filter((n): n is number => n != null);
    return v.length ? Math.round(Math.max(...v)) : null;
  })();

  const rainMM = report.days?.[dayOffset]?.rainTotalMM ?? null;
  const windDir = degToCompass(report.now?.metrics?.windDeg);
  const currentKt = windAvgKt == null ? null : Math.max(0.1, Math.round(windAvgKt * KT_FROM_WIND_CURRENT * 10) / 10);

  return {
    dayOffset, label, hasData: day.length > 0,
    waveFt: maxWaveFt(day), waveMinFt: minWaveFt(day), waveMaxFt: maxWaveFt(day),
    periodS,
    windAvgKt, windMaxKt,
    gustKt: gustKt != null && windMaxKt != null && gustKt > windMaxKt + 2 ? gustKt : null,
    windDir,
    amWindKt: avgWindKt(am), pmWindKt: avgWindKt(pm),
    amWaveFt: avgWaveFt(am), pmWaveFt: avgWaveFt(pm),
    visibilityFt: visFt, rainMM, waterTempF, thermoclineFt, currentKt,
    boxJelly: box,
  };
}

function blankDay(dayOffset: number, label: string, box: BoxJelly | null): DayConditions {
  return {
    dayOffset, label, hasData: false,
    waveFt: null, waveMinFt: null, waveMaxFt: null, periodS: null,
    windAvgKt: null, windMaxKt: null, gustKt: null, windDir: '',
    amWindKt: null, pmWindKt: null, amWaveFt: null, pmWaveFt: null,
    visibilityFt: null, rainMM: null, waterTempF: null,
    thermoclineFt: null, currentKt: null, boxJelly: box,
  };
}
