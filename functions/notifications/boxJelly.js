/* eslint-env node */
'use strict';

/**
 * Box jellyfish swarm window forecaster.
 *
 * Reliable biological signal in Hawaii: south-shore Oʻahu reefs see
 * Carybdea alata swarms 8–10 days after each full moon. Locals plan
 * around it; the Waikiki Aquarium and lifeguards publish calendars.
 * KaiCast surfaces this as a **window**, not a hard prediction, with
 * provenance ("8–10 days post-full-moon — the conventional swarm
 * window"). We don't pretend to know swarm density per day.
 *
 * Affected geography:
 *   The signal is specific to south- and southeast-facing Oʻahu reefs.
 *   Spots are tagged below — north-shore Oʻahu, Maui, Big Island,
 *   Kauai are NOT affected (different reef systems, different
 *   currents). Lying about the geography would be the fastest way
 *   to lose trust.
 *
 * Cadence:
 *   The boxJellyForecaster cron runs daily at 04:00 HST. It computes
 *   any window opening in the next 14 days and writes the resulting
 *   alerts to /spot_alerts. Windows that already exist (matched by
 *   dedupeKey) are not re-written. Past windows auto-expire via TTL.
 *
 * Provenance & framing:
 *   Body copy explicitly notes this is the conventional window and
 *   that active swarms haven't been confirmed today. We never label
 *   a single day as "swarm guaranteed". If we collect a season of
 *   dive-log observations and the model gains confidence, we can
 *   tighten the framing — but ONLY then.
 */

const SUNCALC_FULL_MOON_DEG = 180;   // sun-moon angle for full moon
const MS_PER_DAY = 24 * 3600 * 1000;

// Spots affected: south-shore + southeast-shore Oʻahu reefs only.
// Maui/Big Island/Kauai are NOT on this list — the Carybdea alata
// swarm pattern is documented for south Oʻahu specifically. Adding
// other spots without observational evidence would burn credibility.
const BOX_JELLY_AFFECTED_SPOTS = [
  'turtle-canyon',  // off Waikiki — directly affected
  'hanauma-bay',    // east-shore inlet, edge of the affected zone
  'china-walls',    // east-shore — same regional water mass
  // Notable EXCLUSIONS — do not add these without evidence:
  //   sharks-cove, three-tables, mokuleia (north-shore — different
  //   reef + different currents, no documented pattern)
  //   electric-beach, makua (leeward — usually clear of the swarm
  //   despite being technically south-facing)
  //   Mokulua (windward — wrong side of the island)
];

// ─── Lunar phase ────────────────────────────────────────────────────
//
// Self-contained full-moon finder so we don't depend on the abyss/
// moon code path. Algorithm: walk forward day-by-day, find the local
// maximum of the moon's illuminated fraction. Cheap, accurate to ±12h
// — plenty for an 8-10 day window prediction.

function julianDay(d) {
  const ms = d instanceof Date ? d.getTime() : Number(d);
  return ms / 86400000 + 2440587.5;
}

/** Approximate lunar phase angle in degrees (0 = new, 180 = full). */
function moonPhaseAngleDeg(d) {
  const jd = julianDay(d);
  const T = (jd - 2451545.0) / 36525;
  // Mean elongation of the Moon from the Sun
  const D = (297.8501921 + 445267.1114034 * T) % 360;
  return (D + 360) % 360;
}

/** Distance from "full moon" (180° elongation), wrapped to [0, 180]. */
function fullMoonDistanceDeg(d) {
  const ang = moonPhaseAngleDeg(d);
  let dist = Math.abs(ang - SUNCALC_FULL_MOON_DEG);
  if (dist > 180) dist = 360 - dist;
  return dist;
}

/** Is `d` within ~18h of a full moon? */
function isFullMoonDay(d) {
  return fullMoonDistanceDeg(d) < 7; // ~14° window ≈ 26 hr — accommodates daily-sampling slop
}

/** Find all full-moon dates between [from, to]. Returns Dates aligned
 *  to local-Hawaii noon for stability.
 *
 *  Algorithm: walk daily, track the rolling 3-day minimum of the
 *  full-moon distance. Whenever yesterday is a local minimum AND
 *  inside the threshold, record yesterday as the full moon. This
 *  avoids the prior bug where the daily sample could miss a full
 *  moon that fell between two sample points. */
function findFullMoonsBetween(fromMs, toMs) {
  const result = [];
  // Start one day before the range so the first comparison has a "yesterday"
  let cursor = new Date(fromMs - MS_PER_DAY);
  cursor.setUTCHours(22, 0, 0, 0); // ~noon HST (UTC-10)

  let dPrev = fullMoonDistanceDeg(cursor);
  cursor = new Date(cursor.getTime() + MS_PER_DAY);
  let dCurr = fullMoonDistanceDeg(cursor);

  const seenKeys = new Set();
  while (cursor.getTime() <= toMs + MS_PER_DAY) {
    const next = new Date(cursor.getTime() + MS_PER_DAY);
    const dNext = fullMoonDistanceDeg(next);

    // Local minimum check: current is closer to 180° than yesterday AND
    // tomorrow. And it must be within a reasonable distance.
    if (dCurr <= dPrev && dCurr <= dNext && dCurr < 10) {
      const key = cursor.toISOString().slice(0, 10);
      if (!seenKeys.has(key)) {
        result.push(new Date(cursor));
        seenKeys.add(key);
      }
    }

    dPrev = dCurr;
    dCurr = dNext;
    cursor = next;
  }
  return result;
}

// ─── Window generation ──────────────────────────────────────────────

/** For a given full-moon date, return the {start, end} of the swarm
 *  window (8 → 10 days post). Returned as ms-since-epoch. */
function swarmWindowFor(fullMoonDate) {
  const fm = fullMoonDate.getTime();
  return {
    startMs: fm + 8 * MS_PER_DAY,
    endMs:   fm + 11 * MS_PER_DAY,  // inclusive of day 10
    fullMoonMs: fm,
  };
}

/** Generate alert candidates for any box-jelly window opening within
 *  the next `horizonDays` days. */
function computeBoxJellyAlerts({ horizonDays = 14, nowMs = Date.now() } = {}) {
  const fms = findFullMoonsBetween(nowMs - MS_PER_DAY, nowMs + horizonDays * MS_PER_DAY + 11 * MS_PER_DAY);
  const alerts = [];

  for (const fm of fms) {
    const win = swarmWindowFor(fm);
    // Only surface windows that intersect the horizon
    if (win.endMs < nowMs) continue;
    if (win.startMs > nowMs + horizonDays * MS_PER_DAY) continue;

    const startDate = new Date(win.startMs);
    const endDate   = new Date(win.endMs - MS_PER_DAY); // inclusive end
    const fmt = (d) => d.toLocaleDateString(undefined, {
      timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric',
    });
    const range = `${fmt(startDate)}–${fmt(endDate)}`;

    // The dedupe key uses the full-moon date so the same window
    // doesn't double-emit across days the cron runs.
    const fmKey = fm.toISOString().slice(0, 10);

    alerts.push({
      category: 'box_jelly',
      severity: 'advisory',
      affectedSpotIds: [...BOX_JELLY_AFFECTED_SPOTS],
      affectedIslands: ['Oahu'],
      title: `Box jellyfish window: ${range}`,
      body: `8–10 days past the full moon — the conventional swarm window for south-shore Oʻahu. Active swarms haven't been confirmed today. Lifeguards post signs at affected beaches.`,
      startMs: win.startMs,
      endMs: win.endMs,
      source: 'kaicast-lunar',
      sourceUrl: 'https://www.waikikiaquarium.org/experience/daily-happenings/jellyfish-calendar/',
      metadata: {
        fullMoonMs: fm.getTime(),
        windowStartMs: win.startMs,
        windowEndMs: win.endMs,
        framingNote: 'window, not a hard prediction',
      },
      dedupeKey: `box_jelly:${fmKey}`,
    });
  }

  return alerts;
}

module.exports = {
  computeBoxJellyAlerts,
  // Exposed for testing
  findFullMoonsBetween,
  swarmWindowFor,
  isFullMoonDay,
  BOX_JELLY_AFFECTED_SPOTS,
};
