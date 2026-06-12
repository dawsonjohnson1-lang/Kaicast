// conditionChips — turns normalized day conditions + a vessel's factor
// profile into the ordered advisory chips the dashboard renders. Every
// chip is backed by a real pipeline value; if the data isn't there the
// chip is omitted (never fabricated). Vog / shark / UV have no wired
// fetcher (see HazardStrip.tsx) and are intentionally absent.
//
// MIRROR: app/src/charter/conditionChips.ts. Keep in sync.

import type { DayConditions } from './reportConditions';
import type { VesselFactors } from './vesselFactors';

export type ChipTone = 'good' | 'info' | 'warn' | 'danger';

export interface ConditionChip {
  key: string;
  label: string;     // e.g. "Seasickness: High"
  detail?: string;   // optional secondary line
  tone: ChipTone;
}

export type SeasicknessLevel = 'Low' | 'Moderate' | 'High' | 'Extreme';

const NARCOSIS_DEPTH_M = 25; // onset for many divers; chip shows from here up
const M_TO_FT = 3.28084;

/**
 * Baseline 0–1+ seasickness risk from sea state, scaled by the vessel's
 * hull modifier. Inputs: wave height, dominant period, wind speed,
 * current. Short-period chop punishes; long-period swell rides easy.
 * Returns the final adjective — the math stays internal per spec.
 */
export function seasicknessRisk(c: DayConditions, f: VesselFactors): SeasicknessLevel | null {
  // Need at least sea-state or wind to say anything honest.
  if (c.waveFt == null && c.windAvgKt == null) return null;

  let risk = 0;
  const waveFt = c.waveFt ?? 0;
  risk += waveFt * 0.12;
  if (c.periodS != null) {
    if (c.periodS < 7) risk += waveFt * 0.10;        // steep, short, slamming
    else if (c.periodS >= 11) risk -= waveFt * 0.05; // long ground swell
  }
  if (c.windAvgKt != null) risk += Math.max(0, c.windAvgKt - 8) * 0.015;
  if (c.currentKt != null) risk += c.currentKt * 0.10;

  risk = Math.max(0, Math.min(1.2, risk));
  const adjusted = risk * f.seasicknessModifier;

  if (adjusted < 0.25) return 'Low';
  if (adjusted < 0.5) return 'Moderate';
  if (adjusted < 0.8) return 'High';
  return 'Extreme';
}

const SEASICK_TONE: Record<SeasicknessLevel, ChipTone> = {
  Low: 'good', Moderate: 'info', High: 'warn', Extreme: 'danger',
};

/** Character of the wave field from its dominant period. */
function seaCharacter(periodS: number | null): 'chop' | 'mixed' | 'swell' {
  if (periodS == null) return 'mixed';
  if (periodS < 8) return 'chop';
  if (periodS >= 11) return 'swell';
  return 'mixed';
}

/**
 * Ordered chips for one vessel on one day. `spotDepthFt` is optional —
 * when given it unlocks the narcosis chip (from the spot's max depth)
 * for dive hulls.
 */
export function buildChips(
  c: DayConditions,
  f: VesselFactors,
  spotDepthFt?: number | null,
): ConditionChip[] {
  const chips: ConditionChip[] = [];

  // 1. Seasickness (vessel-modified) — lead chip.
  const risk = seasicknessRisk(c, f);
  if (risk) {
    chips.push({ key: 'seasickness', label: `Seasickness: ${risk}`, tone: SEASICK_TONE[risk] });
  }

  // 2. Visibility.
  if (c.visibilityFt != null) {
    const v = c.visibilityFt;
    const word = v >= 60 ? 'Excellent' : v >= 40 ? 'Good' : v >= 25 ? 'Fair' : 'Low';
    chips.push({
      key: 'visibility',
      label: `Visibility: ${word}`,
      detail: `~${v} ft`,
      tone: v >= 40 ? 'good' : v >= 25 ? 'info' : 'warn',
    });
  }

  // 3. Sea state — period-aware (chop vs swell from the single wave field;
  //    no fabricated swell/chop split).
  if (c.waveFt != null) {
    const char = seaCharacter(c.periodS);
    const range = c.waveMinFt != null && c.waveMaxFt != null && c.waveMaxFt - c.waveMinFt >= 1
      ? `${c.waveMinFt}–${c.waveMaxFt}ft` : `${c.waveFt}ft`;
    const periodTxt = c.periodS != null ? ` @ ${c.periodS}s` : '';
    const heading = char === 'swell' ? 'Swell' : char === 'chop' ? 'Chop' : 'Sea';
    const heavy = c.waveFt > f.maxChopFt;
    chips.push({
      key: 'sea-state',
      label: `${heading}: ${range}${periodTxt}`,
      detail: char === 'chop' ? 'short-period' : char === 'swell' ? 'long-period' : undefined,
      tone: heavy ? (char === 'swell' ? 'warn' : 'danger') : c.waveFt > f.maxChopFt * 0.6 ? 'info' : 'good',
    });
  }

  // 4. Wind.
  if (c.windAvgKt != null) {
    const am = c.amWindKt, pm = c.pmWindKt;
    let label = `Wind: ${c.windAvgKt}kt${c.windDir ? ` ${c.windDir}` : ''}`;
    if (am != null && pm != null && am - pm >= 4) label = `Wind: ${am}kt AM, easing to ${pm}kt PM`;
    else if (am != null && pm != null && pm - am >= 4) label = `Wind: ${am}kt AM, building to ${pm}kt PM`;
    chips.push({
      key: 'wind',
      label,
      detail: c.gustKt != null ? `gusts ${c.gustKt}kt` : undefined,
      tone: c.windAvgKt > f.maxWindKt ? 'danger' : c.windAvgKt > f.maxWindKt * 0.7 ? 'warn' : 'good',
    });
  }

  // 5. Rain (0 is real data → "None forecast").
  if (c.rainMM != null) {
    const r = c.rainMM;
    chips.push({
      key: 'rain',
      label: r < 0.5 ? 'Rain: None forecast' : r < 4 ? 'Rain: Passing showers' : 'Rain: Wet, periods of rain',
      detail: r >= 0.5 ? `~${Math.round(r)}mm` : undefined,
      tone: r < 0.5 ? 'good' : r < 4 ? 'info' : 'warn',
    });
  }

  // 6. Water temperature — dive hulls get the exposure note.
  if (c.waterTempF != null) {
    const t = c.waterTempF;
    const exposure = f.isDive && t < 76 ? ' (cool — consider a 5mm)' : f.isDive && t < 79 ? ' (consider a 3mm)' : '';
    chips.push({ key: 'water-temp', label: `Water: ${t}°F${exposure}`, tone: 'info' });
  }

  // 7. Thermocline — dive hulls only, today only (subsurface "now" read).
  if (f.isDive && c.thermoclineFt != null) {
    chips.push({
      key: 'thermocline',
      label: c.thermoclineFt < 45 ? `Thermocline: shallow (${c.thermoclineFt}ft)` : `Thermocline: ${c.thermoclineFt}ft`,
      tone: c.thermoclineFt < 45 ? 'warn' : 'info',
    });
  }

  // 8. Current / tidal flushing (wind-driven surface proxy).
  if (c.currentKt != null && c.currentKt >= 0.3) {
    chips.push({
      key: 'current',
      label: `Current: ~${c.currentKt.toFixed(1)}kt`,
      tone: c.currentKt >= 0.7 ? 'warn' : 'info',
    });
  }

  // 9. Box jelly (south-shore Oahu, within 48h).
  if (c.boxJelly) {
    chips.push({
      key: 'box-jelly',
      label: c.boxJelly.open ? 'Box jelly: window open' : c.boxJelly.label,
      detail: 'south-shore Oahu',
      tone: c.boxJelly.open ? 'danger' : 'warn',
    });
  }

  // 10. Narcosis — dive hulls only, when the spot's max depth approaches
  //     the recreational threshold. Static safety calc from spot depth.
  if (f.isDive && spotDepthFt && spotDepthFt > 0) {
    const depthM = spotDepthFt / M_TO_FT;
    if (depthM >= NARCOSIS_DEPTH_M) {
      chips.push({
        key: 'narcosis',
        label: 'Narcosis threshold: 40m / 130ft',
        detail: 'consider nitrox or limit depth',
        tone: 'warn',
      });
    }
  }

  return chips;
}
