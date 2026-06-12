// conditionChips — MOBILE mirror of desktop/charter/conditionChips.ts.
// Same seasickness model + data-backed chip set. Vog/shark/UV have no
// wired fetcher and are omitted. Keep in sync with desktop.

import type { DayConditions } from './reportConditions';
import type { VesselFactors } from './vesselFactors';

export type ChipTone = 'good' | 'info' | 'warn' | 'danger';

export interface ConditionChip {
  key: string;
  label: string;
  detail?: string;
  tone: ChipTone;
}

export type SeasicknessLevel = 'Low' | 'Moderate' | 'High' | 'Extreme';

const NARCOSIS_DEPTH_M = 25;
const M_TO_FT = 3.28084;

export function seasicknessRisk(c: DayConditions, f: VesselFactors): SeasicknessLevel | null {
  if (c.waveFt == null && c.windAvgKt == null) return null;
  let risk = 0;
  const waveFt = c.waveFt ?? 0;
  risk += waveFt * 0.12;
  if (c.periodS != null) {
    if (c.periodS < 7) risk += waveFt * 0.10;
    else if (c.periodS >= 11) risk -= waveFt * 0.05;
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

function seaCharacter(periodS: number | null): 'chop' | 'mixed' | 'swell' {
  if (periodS == null) return 'mixed';
  if (periodS < 8) return 'chop';
  if (periodS >= 11) return 'swell';
  return 'mixed';
}

export function buildChips(
  c: DayConditions,
  f: VesselFactors,
  spotDepthFt?: number | null,
): ConditionChip[] {
  const chips: ConditionChip[] = [];

  const risk = seasicknessRisk(c, f);
  if (risk) chips.push({ key: 'seasickness', label: `Seasickness: ${risk}`, tone: SEASICK_TONE[risk] });

  if (c.visibilityFt != null) {
    const v = c.visibilityFt;
    const word = v >= 60 ? 'Excellent' : v >= 40 ? 'Good' : v >= 25 ? 'Fair' : 'Low';
    chips.push({ key: 'visibility', label: `Visibility: ${word}`, detail: `~${v} ft`, tone: v >= 40 ? 'good' : v >= 25 ? 'info' : 'warn' });
  }

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

  if (c.windAvgKt != null) {
    const am = c.amWindKt, pm = c.pmWindKt;
    let label = `Wind: ${c.windAvgKt}kt${c.windDir ? ` ${c.windDir}` : ''}`;
    if (am != null && pm != null && am - pm >= 4) label = `Wind: ${am}kt AM, easing to ${pm}kt PM`;
    else if (am != null && pm != null && pm - am >= 4) label = `Wind: ${am}kt AM, building to ${pm}kt PM`;
    chips.push({ key: 'wind', label, detail: c.gustKt != null ? `gusts ${c.gustKt}kt` : undefined, tone: c.windAvgKt > f.maxWindKt ? 'danger' : c.windAvgKt > f.maxWindKt * 0.7 ? 'warn' : 'good' });
  }

  if (c.rainMM != null) {
    const r = c.rainMM;
    chips.push({ key: 'rain', label: r < 0.5 ? 'Rain: None forecast' : r < 4 ? 'Rain: Passing showers' : 'Rain: Wet, periods of rain', detail: r >= 0.5 ? `~${Math.round(r)}mm` : undefined, tone: r < 0.5 ? 'good' : r < 4 ? 'info' : 'warn' });
  }

  if (c.waterTempF != null) {
    const t = c.waterTempF;
    const exposure = f.isDive && t < 76 ? ' (cool — consider a 5mm)' : f.isDive && t < 79 ? ' (consider a 3mm)' : '';
    chips.push({ key: 'water-temp', label: `Water: ${t}°F${exposure}`, tone: 'info' });
  }

  if (f.isDive && c.thermoclineFt != null) {
    chips.push({ key: 'thermocline', label: c.thermoclineFt < 45 ? `Thermocline: shallow (${c.thermoclineFt}ft)` : `Thermocline: ${c.thermoclineFt}ft`, tone: c.thermoclineFt < 45 ? 'warn' : 'info' });
  }

  if (c.currentKt != null && c.currentKt >= 0.3) {
    chips.push({ key: 'current', label: `Current: ~${c.currentKt.toFixed(1)}kt`, tone: c.currentKt >= 0.7 ? 'warn' : 'info' });
  }

  if (c.boxJelly) {
    chips.push({ key: 'box-jelly', label: c.boxJelly.open ? 'Box jelly: window open' : c.boxJelly.label, detail: 'south-shore Oahu', tone: c.boxJelly.open ? 'danger' : 'warn' });
  }

  if (f.isDive && spotDepthFt && spotDepthFt > 0) {
    const depthM = spotDepthFt / M_TO_FT;
    if (depthM >= NARCOSIS_DEPTH_M) {
      chips.push({ key: 'narcosis', label: 'Narcosis threshold: 40m / 130ft', detail: 'consider nitrox or limit depth', tone: 'warn' });
    }
  }

  return chips;
}
