// Moon phase computation + Hawaiian box-jelly window detection.
//
// Hawaiian box jellies (Carybdea alata) spawn on a tidal/lunar cycle:
// they appear on the south-shore beaches of Oahu (Waikiki etc.) on
// roughly the 8th, 9th, and 10th days after the full moon. The
// pattern is consistent enough that Honolulu lifeguards publish a
// "box jelly calendar" 12 months out — same +8/+9/+10 days rule.
//
// We compute the synodic-phase age (days since last new moon) using
// Conway's approximation. It's accurate to ~0.5 days over the next
// century, which is plenty for "is the box-jelly window open today?"
// — the bracket is 3 days wide.

const SYNODIC_MONTH_DAYS = 29.5305882;
// Reference new moon: 2000-01-06 18:14 UTC (Julian Day 2451550.1) —
// the standard epoch used in Meeus's "Astronomical Algorithms" and
// every well-behaved moon-phase library. Drifts ~2 hours per century;
// fine for the multi-day windows we care about.
const KNOWN_NEW_MOON_JD = 2451550.1;

/** Julian Day Number for a JS Date, including fractional day. */
function julianDay(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

/**
 * Age of the moon in days since the last new moon. Range [0, 29.53).
 * 0 ≈ new, 14.77 ≈ full.
 *
 * Computes via reference-epoch subtraction (Meeus). Accurate to
 * within a few hours over the next century, which is plenty for
 * "is the box-jelly window open today?" — the bracket is 3 days wide.
 */
export function moonAgeDays(d: Date): number {
  const jd = julianDay(d);
  const elapsed = jd - KNOWN_NEW_MOON_JD;
  const age = ((elapsed % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  return age;
}

export type MoonPhaseName =
  | 'new'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

export function moonPhaseName(age: number): MoonPhaseName {
  // Eight-bin quantization on a 29.53-day cycle.
  const bin = age / SYNODIC_MONTH_DAYS;
  if (bin < 0.0625) return 'new';
  if (bin < 0.1875) return 'waxing-crescent';
  if (bin < 0.3125) return 'first-quarter';
  if (bin < 0.4375) return 'waxing-gibbous';
  if (bin < 0.5625) return 'full';
  if (bin < 0.6875) return 'waning-gibbous';
  if (bin < 0.8125) return 'last-quarter';
  return 'waning-crescent';
}

/** Days since the last full moon. Negative is not possible — wraps
 *  through the cycle. Used to compute box-jelly window proximity. */
export function daysSinceFullMoon(age: number): number {
  const FULL_AT = SYNODIC_MONTH_DAYS / 2; // ≈ 14.77
  if (age >= FULL_AT) return age - FULL_AT;
  // We're past last quarter / new — the previous full moon was
  // (29.53 - FULL_AT + age) days ago.
  return SYNODIC_MONTH_DAYS - FULL_AT + age;
}

export type BoxJellyState =
  | { open: false; daysUntil: number }
  | { open: true; dayOfWindow: 1 | 2 | 3 };

/** Hawaiian box-jelly window state for a given date.
 *  The window covers the 8th, 9th, and 10th day after the full moon
 *  (lifeguard convention). `daysUntil` is how many days until the
 *  window opens when it's closed. */
export function boxJellyState(d: Date): BoxJellyState {
  const sinceFull = daysSinceFullMoon(moonAgeDays(d));
  if (sinceFull >= 8 && sinceFull < 11) {
    return { open: true, dayOfWindow: (Math.floor(sinceFull - 8) + 1) as 1 | 2 | 3 };
  }
  // Window is days 8..10 after full. Next window opens at day 8.
  // If we're at sinceFull=11..29.53 we wait (8 + 29.53 - sinceFull) days
  // for the next full + 8 more days for the window to open.
  let daysUntil: number;
  if (sinceFull < 8) {
    daysUntil = 8 - sinceFull;
  } else {
    daysUntil = SYNODIC_MONTH_DAYS - sinceFull + 8;
  }
  return { open: false, daysUntil: Math.ceil(daysUntil) };
}
