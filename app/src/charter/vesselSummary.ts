// vesselSummary — MOBILE mirror of desktop/charter/vesselSummary.ts.
// 1–2 sentence skipper-voice read, vessel-behavior driven. Keep in sync.

import type { DayConditions } from './reportConditions';
import type { VesselFactors } from './vesselFactors';
import { seasicknessRisk } from './conditionChips';

function seaPhrase(c: DayConditions): string {
  if (c.waveFt == null) return 'light seas';
  const ft = c.waveFt;
  if (c.periodS != null && c.periodS < 8) return `the ${c.periodS}s chop${ft >= 2 ? ` at ${ft}ft` : ''}`;
  if (c.periodS != null && c.periodS >= 11) return `the ${ft}ft long-period swell`;
  return `the ${ft}ft sea`;
}

export function summaryFor(
  vesselName: string,
  f: VesselFactors,
  c: DayConditions,
  spotName?: string | null,
): string {
  if (!c.hasData) {
    return `No forecast in yet for ${spotName ?? 'this spot'} ${c.label.toLowerCase()} — check back closer to the day.`;
  }

  const risk = seasicknessRisk(c, f);
  const wave = c.waveFt ?? 0;
  const overChop = c.waveFt != null && c.waveFt > f.maxChopFt;
  const windHigh = c.windAvgKt != null && c.windAvgKt > f.maxWindKt;
  const easesPM = c.amWindKt != null && c.pmWindKt != null && c.amWindKt - c.pmWindKt >= 4;
  const longSwell = c.periodS != null && c.periodS >= 11;
  const shortChop = c.periodS != null && c.periodS < 8 && wave >= 2;

  let lead: string;
  switch (risk) {
    case 'Low':      lead = `${cap(f.plural)} will have a comfortable ride on ${seaPhrase(c)}`; break;
    case 'Moderate': lead = `${cap(f.plural)} will be fine on ${seaPhrase(c)}, with some motion`; break;
    case 'High':     lead = `${cap(f.plural)} are in for a sporty ride in ${seaPhrase(c)}`; break;
    case 'Extreme':  lead = `It's a beating out there for ${f.plural} — ${seaPhrase(c)} is past what they're happy in`; break;
    default:         lead = `${cap(f.plural)} should be okay on ${seaPhrase(c)}`;
  }

  if (shortChop && f.seasicknessModifier <= 0.85 && !overChop) {
    lead += `; the wide beam shrugs off the short-period stuff`;
  } else if (shortChop && f.seasicknessModifier >= 1.4) {
    lead += ` — ${f.concerns[0] ?? 'they take a pounding in short-period chop'}`;
  } else if (longSwell && f.maxSwellFt >= wave) {
    lead += `, and the long period keeps it manageable`;
  }

  const advice: string[] = [];
  if ((overChop || windHigh) && easesPM) {
    advice.push(`Schedule for the afternoon once the wind backs off to ${c.pmWindKt}kt`);
  } else if (overChop && f.seasicknessModifier >= 1.4) {
    advice.push(`Push to the afternoon or put guests on a bigger hull`);
  } else if (windHigh) {
    advice.push(`Wind's over this hull's comfort line — keep it inshore or stand down`);
  }
  if (f.isDive && c.visibilityFt != null && c.visibilityFt < 30) {
    advice.push(`viz is only ~${c.visibilityFt}ft, so brief divers to expect it`);
  }
  if (f.isDive && c.waterTempF != null && c.waterTempF < 76) {
    advice.push(`water's ${c.waterTempF}°F — push the 5mm`);
  }
  if (c.boxJelly?.open) advice.push(`mind the south-shore box-jelly window`);

  if (advice.length === 0) return `${lead}.`;
  return `${lead}. ${cap(advice.join(', '))}.`;
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
