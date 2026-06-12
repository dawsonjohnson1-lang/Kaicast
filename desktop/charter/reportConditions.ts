// reportConditions — normalize a BackendReport into a per-day
// conditions object the vessel-summary + chip engines consume. One
// object per day offset (0 = today, 1 = tomorrow). Every field traces
// to a real pipeline value; fields the report doesn't carry stay null
// and the chip/summary code omits them (never fabricates).
//
// Source of truth for the day slice: the report's 3-hour windows
// (windowsForDayOffset), the same ones the consumer forecast strip and
// hourly table read — so the charter view can't tell a different story.

import {
  type BackendReport,
  type BackendWindow,
  windowsForDayOffset,
} from '../data/getReport';
import { boxJellyState } from './moonPhase';

const M_TO_FT = 3.28084;
const KT_FROM_WIND_CURRENT = 0.03; // wind-driven surface-current proxy, same as getReport.ts
const DIRS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

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

/** Box-jelly read for a given day. Reuses the deterministic moon-phase
 *  window already trusted by HazardStrip — no separate fetcher. */
export interface BoxJelly {
  /** Window is open (south-shore Oahu) on this day. */
  open: boolean;
  /** Days until the window opens (0 = today). */
  daysUntil: number;
  label: string;
}

/** Normalized conditions for one operating day. Null = no pipeline data
 *  for that field (chip/summary omits it). */
export interface DayConditions {
  dayOffset: number;
  label: string;            // "Today" / "Tomorrow"
  hasData: boolean;

  // Sea state (wind-wave / combined sea from the forecast windows).
  waveFt: number | null;       // representative (daytime max)
  waveMinFt: number | null;
  waveMaxFt: number | null;
  periodS: number | null;      // dominant period (drives chop-vs-swell character)

  // Wind.
  windAvgKt: number | null;
  windMaxKt: number | null;
  gustKt: number | null;
  windDir: string;             // compass (from now.metrics.windDeg)

  // AM (06–12) vs PM (12–18) split — lets the prose say "ease by afternoon".
  amWindKt: number | null;
  pmWindKt: number | null;
  amWaveFt: number | null;
  pmWaveFt: number | null;

  visibilityFt: number | null;
  rainMM: number | null;
  waterTempF: number | null;
  thermoclineFt: number | null;  // today only (subsurface is a "now" read)
  currentKt: number | null;
  boxJelly: BoxJelly | null;
}

function bucketsDaytime(buckets: Array<BackendWindow | undefined>): BackendWindow[] {
  // Slots 2 (06–09) … 5 (15–18) cover the operating day.
  return buckets.slice(2, 6).filter((w): w is BackendWindow => !!w);
}

function maxWaveFt(ws: BackendWindow[]): number | null {
  const vals = ws.map((w) => w.avg?.waveHeightM).filter((m): m is number => m != null).map((m) => m * M_TO_FT);
  return vals.length ? Math.round(Math.max(...vals) * 10) / 10 : null;
}
function minWaveFt(ws: BackendWindow[]): number | null {
  const vals = ws.map((w) => w.avg?.waveHeightM).filter((m): m is number => m != null).map((m) => m * M_TO_FT);
  return vals.length ? Math.round(Math.min(...vals) * 10) / 10 : null;
}
function avgWindKt(ws: BackendWindow[]): number | null {
  const a = avg(ws.map((w) => w.avg?.windSpeedKts).filter((n): n is number => n != null));
  return a == null ? null : Math.round(a);
}
function avgWaveFt(ws: BackendWindow[]): number | null {
  const a = avg(ws.map((w) => w.avg?.waveHeightM).filter((n): n is number => n != null));
  return a == null ? null : Math.round(a * M_TO_FT * 10) / 10;
}

/** Build the normalized conditions for a day offset from a report. */
export function dayConditions(report: BackendReport | null, dayOffset: number): DayConditions {
  const label = dayOffset === 0 ? 'Today' : dayOffset === 1 ? 'Tomorrow' : `+${dayOffset}d`;
  const box = (() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    const s = boxJellyState(d);
    if (s.open) return { open: true, daysUntil: 0, label: `Box jelly window open (day ${s.dayOfWindow} of 3)` };
    if (s.daysUntil <= 2) return { open: false, daysUntil: s.daysUntil, label: `Box jelly window opens in ${s.daysUntil} ${s.daysUntil === 1 ? 'day' : 'days'}` };
    return null;
  })();

  if (!report) {
    return blankDay(dayOffset, label, box);
  }

  const buckets = windowsForDayOffset(report.windows, dayOffset);
  const day = bucketsDaytime(buckets);
  const am = [buckets[2], buckets[3]].filter((w): w is BackendWindow => !!w); // 06–12
  const pm = [buckets[4], buckets[5]].filter((w): w is BackendWindow => !!w); // 12–18

  // Dominant period — average of daytime window periods.
  const periodS = (() => {
    const a = avg(day.map((w) => w.avg?.wavePeriodS).filter((n): n is number => n != null));
    return a == null ? null : Math.round(a);
  })();

  // Visibility — min daytime window vis (worst-case for planning), in ft.
  const visFt = (() => {
    const vals = day.map((w) => w.visibility?.estimatedVisibilityMeters).filter((m): m is number => m != null);
    return vals.length ? Math.round(Math.min(...vals) * M_TO_FT) : null;
  })();

  // Water temp — today: subsurface/now metric; any day: daytime window avg.
  const waterTempF = (() => {
    if (dayOffset === 0) {
      const sub = report.now?.subsurface?.surfaceTempC;
      const now = (report.now?.metrics as Record<string, number | null> | undefined)?.waterTempC;
      const c = sub ?? now;
      if (c != null) return cToF(c);
    }
    const a = avg(day.map((w) => w.avg?.waterTempC).filter((n): n is number => n != null));
    return a == null ? null : cToF(a);
  })();

  // Thermocline — a "now" subsurface read; only meaningful for today.
  const thermoclineFt = (() => {
    if (dayOffset !== 0) return null;
    const m = report.now?.subsurface?.thermoclineDepthM;
    return m != null && Number.isFinite(m) ? Math.round(m * M_TO_FT) : null;
  })();

  const windAvgKt = avgWindKt(day);
  const windMaxKt = (() => {
    const vals = day.map((w) => w.avg?.windSpeedKts).filter((n): n is number => n != null);
    return vals.length ? Math.round(Math.max(...vals)) : null;
  })();
  const gustKt = (() => {
    const vals = day.map((w) => w.avg?.windGustKts).filter((n): n is number => n != null);
    return vals.length ? Math.round(Math.max(...vals)) : null;
  })();

  const rainMM = report.days?.[dayOffset]?.rainTotalMM ?? null;
  const windDir = degToCompass((report.now?.metrics as Record<string, number | null> | undefined)?.windDeg);
  const currentKt = windAvgKt == null ? null : Math.max(0.1, Math.round(windAvgKt * KT_FROM_WIND_CURRENT * 10) / 10);

  const hasData = day.length > 0;

  return {
    dayOffset,
    label,
    hasData,
    waveFt: maxWaveFt(day),
    waveMinFt: minWaveFt(day),
    waveMaxFt: maxWaveFt(day),
    periodS,
    windAvgKt,
    windMaxKt,
    gustKt: gustKt != null && windMaxKt != null && gustKt > windMaxKt + 2 ? gustKt : null,
    windDir,
    amWindKt: avgWindKt(am),
    pmWindKt: avgWindKt(pm),
    amWaveFt: avgWaveFt(am),
    pmWaveFt: avgWaveFt(pm),
    visibilityFt: visFt,
    rainMM,
    waterTempF,
    thermoclineFt,
    currentKt,
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
