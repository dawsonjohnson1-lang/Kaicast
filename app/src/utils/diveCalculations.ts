// Dive log calculation helpers. All inputs/outputs are in BASE units
// (psi, ft, °F, lbs, cu ft) to match the Firestore schema for dive_logs;
// the screen converts on render only.

export function calcDuration(timeIn: Date, timeOut: Date): number {
  return Math.round((timeOut.getTime() - timeIn.getTime()) / 60000);
}

export function calcAirConsumed(start: number, end: number): number {
  return start - end;
}

// Surface Air Consumption (SAC) in cu ft / minute, normalized to surface
// pressure. Approximates avg depth as max/2 unless caller provides one.
export function calcSAC(
  airConsumedPsi: number,
  tankSizeCuft: number,
  avgDepthFt: number,
  durationMin: number,
): number {
  if (durationMin <= 0 || tankSizeCuft <= 0) return 0;
  const cuftUsed = (airConsumedPsi / 3000) * tankSizeCuft;
  const pressureFactor = 14.7 / (avgDepthFt + 14.7);
  return Math.round(((cuftUsed * pressureFactor) / durationMin) * 100) / 100;
}

export function calcSurfaceInterval(
  prevTimeOut: Date | null,
  currentTimeIn: Date,
): number | null {
  if (!prevTimeOut) return null;
  return Math.round((currentTimeIn.getTime() - prevTimeOut.getTime()) / 60000);
}

export function formatSurfaceInterval(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Display-only unit conversions. Storage is always in the base unit.
export const ftToM = (ft: number): number => ft * 0.3048;
export const mToFt = (m: number): number => m / 0.3048;
export const psiToBar = (psi: number): number => psi * 0.0689476;
export const barToPsi = (bar: number): number => bar / 0.0689476;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;
export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const lbsToKg = (lbs: number): number => lbs * 0.453592;
export const kgToLbs = (kg: number): number => kg / 0.453592;
export const cuftToL = (cuft: number): number => cuft * 28.3168;
export const lToCuft = (l: number): number => l / 28.3168;
