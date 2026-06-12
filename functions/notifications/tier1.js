/* eslint-env node */
'use strict';

/**
 * Tier 1 notification detectors.
 *
 * Each detector is a pure function. Inputs: the current report for a
 * single spot + history (most-recent N reports for the same spot, in
 * generatedAt-DESC order). Output: 0 or more alert candidates ready
 * for the dispatcher to validate + write.
 *
 * Detectors don't write to Firestore directly — the scheduler runs
 * them after kaicast_reports writes, collects the candidates, and
 * batches the actual writes through dispatcher.persist().
 *
 * Idempotency: each detector returns a stable `dedupeKey` so we don't
 * re-emit the same alert hour after hour while the condition holds.
 * dispatcher.persist() checks the key against existing /spot_alerts.
 */

const PCT_THRESHOLD = 0.90;          // 90th-percentile vis-spike threshold
const HISTORY_WINDOW_HOURS = 30 * 24; // 30 days
const MIN_HISTORY_POINTS = 30;       // need at least this many samples to fire a vis_spike

// ─── Helpers ────────────────────────────────────────────────────────

function pctile(values, p) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function daysAgo(report) {
  const t = Date.parse(report.generatedAt);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (24 * 3600 * 1000);
}

function ratingTierOf(report) {
  const label = report?.now?.rating?.label;
  return label ? String(label).toUpperCase() : null;
}

function islandFor(spot) {
  return spot?.island || spot?.region || null;
}

// ─── 1. Visibility spike ────────────────────────────────────────────
//
// Fires when current vis exceeds the 30-day 90th percentile AND beats
// it by at least 8 ft (so we don't fire on a 1-ft noise crossing).

function detectVisSpike({ spot, current, history }) {
  const curr = current?.now?.visibility?.estimatedVisibilityFeet;
  if (curr == null || !Number.isFinite(curr)) return [];
  if (!history || history.length < MIN_HISTORY_POINTS) return [];

  const past = history
    .map((r) => r?.now?.visibility?.estimatedVisibilityFeet)
    .filter((v) => Number.isFinite(v));
  if (past.length < MIN_HISTORY_POINTS) return [];

  const p90 = pctile(past, PCT_THRESHOLD);
  if (p90 == null || curr < p90 + 8) return [];

  // Find the most recent date the spot read this high
  let daysSinceLast = null;
  for (const r of history) {
    const v = r?.now?.visibility?.estimatedVisibilityFeet;
    if (v != null && v >= curr) {
      daysSinceLast = Math.round(daysAgo(r));
      break;
    }
  }
  const sinceTxt = daysSinceLast != null
    ? `clearest it's been in ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'}`
    : 'one of the clearest reads this month';

  return [{
    category: 'vis_spike',
    severity: 'info',
    affectedSpotIds: [spot.id],
    affectedIslands: [islandFor(spot)].filter(Boolean),
    title: `${spot.name} just hit ${curr} ft vis`,
    body: `Current reading is ${curr} ft — ${sinceTxt}. 90-day band tops out around ${p90} ft.`,
    startMs: Date.parse(current.generatedAt) || Date.now(),
    endMs: (Date.parse(current.generatedAt) || Date.now()) + 12 * 3600 * 1000,
    source: 'kaicast-derived',
    metadata: { visFt: curr, p90: p90, daysSinceLast },
    dedupeKey: `vis_spike:${spot.id}:${current.hourKey}`,
  }];
}

// ─── 2. Wind drop ───────────────────────────────────────────────────
//
// Fires when a future window in the next 24 h crosses below threshold
// AND the current hour is above it. Threshold default 10 kt — eventually
// per-user, but starts global so we surface the signal.

function detectWindDrop({ spot, current, windowsThresholdKt = 10 }) {
  const wins = current?.windows || [];
  if (wins.length === 0) return [];
  const currKt = current?.now?.metrics?.windSpeedKts;
  if (currKt == null || currKt <= windowsThresholdKt + 2) return [];

  // Find the first window in the next 24h whose windSpeedKts < threshold
  const within24h = wins.filter((w) => {
    const t = Date.parse(w.startIso);
    if (!Number.isFinite(t)) return false;
    return t - Date.now() < 24 * 3600 * 1000 && t > Date.now();
  });

  const dropWin = within24h.find((w) => {
    const kt = w?.avg?.windSpeedKts;
    return Number.isFinite(kt) && kt < windowsThresholdKt;
  });
  if (!dropWin) return [];

  const when = new Date(dropWin.startIso);
  const localHour = when.toLocaleTimeString(undefined, { hour: 'numeric', timeZone: 'Pacific/Honolulu' });
  const dropKt = Math.round(dropWin.avg.windSpeedKts);

  return [{
    category: 'wind_drop',
    severity: 'info',
    affectedSpotIds: [spot.id],
    affectedIslands: [islandFor(spot)].filter(Boolean),
    title: `Wind dropping at ${spot.name}`,
    body: `Forecast crosses below ${windowsThresholdKt} kt by ${localHour} HST (model says ${dropKt} kt). Currently ${Math.round(currKt)} kt.`,
    startMs: Date.now(),
    endMs: when.getTime(),
    source: 'kaicast-derived',
    metadata: { dropAtIso: dropWin.startIso, dropKt, currKt: Math.round(currKt) },
    // One alert per spot per dropoff window — different drops next hour
    // produce a different dedupe key
    dedupeKey: `wind_drop:${spot.id}:${dropWin.startIso}`,
  }];
}

// ─── 3. Window opening — no-go/fair → great/excellent ──────────────

function detectWindowOpen({ spot, current }) {
  const wins = current?.windows || [];
  if (wins.length < 2) return [];

  const currScore = current?.now?.rating?.score ?? 50;
  const currTier = scoreToTier(currScore);
  if (currTier === 'great' || currTier === 'excellent') return [];

  // Find the next upcoming window with score >= 60 (great+)
  const upcoming = wins
    .map((w) => ({ iso: w.startIso, score: Number(w?.rating?.score ?? 0), ms: Date.parse(w.startIso) }))
    .filter((w) => w.ms > Date.now() && w.ms - Date.now() < 12 * 3600 * 1000);

  const opens = upcoming.find((w) => w.score >= 60);
  if (!opens) return [];

  const hours = Math.round((opens.ms - Date.now()) / 3600000);
  const tier = scoreToTier(opens.score);

  return [{
    category: 'window_open',
    severity: 'info',
    affectedSpotIds: [spot.id],
    affectedIslands: [islandFor(spot)].filter(Boolean),
    title: `${spot.name} opens up in ${hours}h`,
    body: `Transitioning from ${currTier} → ${tier} around ${new Date(opens.ms).toLocaleTimeString(undefined, { hour: 'numeric', timeZone: 'Pacific/Honolulu' })} HST.`,
    startMs: Date.now(),
    endMs: opens.ms,
    source: 'kaicast-derived',
    metadata: { fromTier: currTier, toTier: tier, opensAtIso: opens.iso },
    dedupeKey: `window_open:${spot.id}:${opens.iso}`,
  }];
}

function scoreToTier(s) {
  if (s >= 80) return 'excellent';
  if (s >= 60) return 'great';
  if (s >= 40) return 'good';
  if (s >= 20) return 'fair';
  return 'no-go';
}

// ─── 4. Streak start / streak end ───────────────────────────────────
//
// Streak = consecutive days where day.rating >= 'great'. Uses the
// `days[]` array on the report which already aggregates per-day
// forecast. Streak start: a GREAT day after N+ non-GREAT days.
// Streak end: today is GREAT but tomorrow is not (and today's the
// last GREAT in the upcoming forecast window).

function detectStreakEvents({ spot, current, history }) {
  const days = current?.days || [];
  if (days.length === 0) return [];

  const tier = (d) => scoreToTier(d?.score ?? d?.rating?.score ?? 0);
  const today = days[0];
  const todayTier = tier(today);
  const todayIsGreatPlus = todayTier === 'great' || todayTier === 'excellent';

  const out = [];

  // Streak START: history must show the last N days were sub-GREAT,
  // and today is GREAT+.
  if (todayIsGreatPlus && history && history.length >= 6 * 24) {
    // Sample the recent past at 1-per-day cadence (24h apart)
    const dayBacks = [];
    for (let d = 1; d <= 14; d++) {
      const target = Date.now() - d * 24 * 3600 * 1000;
      // Find the closest history report
      let closest = null;
      let bestDelta = Infinity;
      for (const r of history) {
        const t = Date.parse(r.generatedAt);
        if (!Number.isFinite(t)) continue;
        const delta = Math.abs(t - target);
        if (delta < bestDelta) { bestDelta = delta; closest = r; }
      }
      if (closest && bestDelta < 6 * 3600 * 1000) {
        const score = closest?.now?.rating?.score ?? 0;
        dayBacks.push({ daysAgo: d, score, tier: scoreToTier(score) });
      }
    }
    const consecBelowGreat = (() => {
      let n = 0;
      for (const r of dayBacks) {
        if (r.tier === 'great' || r.tier === 'excellent') break;
        n++;
      }
      return n;
    })();
    if (consecBelowGreat >= 7) {
      out.push({
        category: 'streak_start',
        severity: 'info',
        affectedSpotIds: [spot.id],
        affectedIslands: [islandFor(spot)].filter(Boolean),
        title: `First ${todayTier.toUpperCase()} day at ${spot.name} in ${consecBelowGreat} days`,
        body: `${spot.name} just rated ${todayTier}. Hasn't read that high since ${consecBelowGreat} days ago.`,
        startMs: Date.now(),
        endMs: Date.now() + 24 * 3600 * 1000,
        source: 'kaicast-derived',
        metadata: { tier: todayTier, daysSinceLast: consecBelowGreat },
        dedupeKey: `streak_start:${spot.id}:${todayDateKey()}`,
      });
    }
  }

  // Streak END: today is GREAT, but the next sub-GREAT day inside the
  // 7-day forecast window is the start of a degrading trend.
  if (todayIsGreatPlus && days.length >= 3) {
    let lastGreatIdx = 0;
    for (let i = 0; i < days.length; i++) {
      const t = tier(days[i]);
      if (t === 'great' || t === 'excellent') lastGreatIdx = i;
      else break;
    }
    // Only fire if today is the LAST great day in the window AND there's
    // at least 2 days of sub-great after — avoids firing on a one-day blip.
    const subAfter = days.slice(lastGreatIdx + 1, lastGreatIdx + 3).filter((d) => {
      const t = tier(d);
      return t !== 'great' && t !== 'excellent';
    });
    if (lastGreatIdx === 0 && subAfter.length === 2) {
      const fallTier = tier(days[1]);
      out.push({
        category: 'streak_end',
        severity: 'info',
        affectedSpotIds: [spot.id],
        affectedIslands: [islandFor(spot)].filter(Boolean),
        title: `Last ${todayTier.toUpperCase()} day at ${spot.name} for a while`,
        body: `Today reads ${todayTier}; the next two days drop to ${fallTier}. If you've been waiting on this spot, today's the window.`,
        startMs: Date.now(),
        endMs: Date.now() + 18 * 3600 * 1000,
        source: 'kaicast-derived',
        metadata: { tier: todayTier, fallTier },
        dedupeKey: `streak_end:${spot.id}:${todayDateKey()}`,
      });
    }
  }

  return out;
}

function todayDateKey() {
  // HST date (UTC-10, no DST) — UTC would flip at 14:00 HST and break
  // dedupe keys mid-day for the hourly streak detectors.
  const d = new Date(Date.now() - 10 * 3600 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── 5. Tide alignment ──────────────────────────────────────────────
//
// Fires when a spot has a tide preference (e.g. "I dive Makaha best on
// negative low tide") and today's NOAA tide events match. Tide prefs
// will be a per-spot field on the user's saved-spots subcollection.
// For now, this detector is wired to fire ONLY when explicitly
// requested per-user — the scheduler doesn't compute it for everyone.
// See dispatcher.runPerUserDetectors() for the per-user path.

function detectTideAlignment({ spot, current, userPref }) {
  if (!userPref || !userPref.tide) return [];
  const tide = current?.tide;
  if (!tide) return [];

  const want = userPref.tide; // 'negative-low' | 'high' | 'rising' | 'falling' | 'slack'
  const eventsToday = [];

  // The tide block exposes the next ~12 hilo events on .events[]; if
  // that's missing, derive from the high/low extrema fields.
  const evs = Array.isArray(tide.events) ? tide.events : [];
  for (const e of evs) {
    const ts = Date.parse(e.tsMs || e.time);
    if (!Number.isFinite(ts)) continue;
    if (ts < Date.now() || ts > Date.now() + 12 * 3600 * 1000) continue;
    if (want === 'negative-low' && e.type === 'low' && (e.levelFt ?? 0) < 0) eventsToday.push(e);
    else if (want === 'high' && e.type === 'high') eventsToday.push(e);
  }
  if (eventsToday.length === 0) return [];

  const next = eventsToday[0];
  const when = new Date(next.tsMs || next.time);
  return [{
    category: 'tide_alignment',
    severity: 'info',
    affectedSpotIds: [spot.id],
    affectedIslands: [islandFor(spot)].filter(Boolean),
    title: `Tide matches your ${spot.name} preference`,
    body: `${want.replace('-', ' ')} tide at ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' })} HST today.`,
    startMs: Date.now(),
    endMs: when.getTime() + 2 * 3600 * 1000,
    source: 'kaicast-derived',
    metadata: { tideEventType: next.type, levelFt: next.levelFt, atMs: when.getTime() },
    dedupeKey: `tide_alignment:${spot.id}:${next.tsMs || next.time}:${want}`,
  }];
}

// ─── 6. Spot of the day ─────────────────────────────────────────────
//
// Runs once a day (separate cron — not per-spot). Returns the top 1-3
// great/excellent spots across the archipelago. Caller filters by the
// user's saved-island list at read time.

function detectSpotOfDay({ allCurrentReports }) {
  if (!Array.isArray(allCurrentReports) || allCurrentReports.length === 0) return [];

  const ranked = allCurrentReports
    .map((r) => ({
      spotId: r.spot,
      spotName: r.spotName,
      island: r.spotIsland || r.spotCoast || null,
      score: r?.now?.rating?.score ?? 0,
      visFt: r?.now?.visibility?.estimatedVisibilityFeet ?? null,
    }))
    .filter((r) => r.score >= 60)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return [];

  // Group by island, pick 1-3 across islands, prefer score
  const seen = new Set();
  const picks = [];
  for (const r of ranked) {
    if (picks.length >= 3) break;
    if (!r.island || seen.has(r.island)) continue;
    seen.add(r.island);
    picks.push(r);
  }
  if (picks.length === 0) picks.push(...ranked.slice(0, 3));

  const dateKey = todayDateKey();
  return picks.map((p, i) => ({
    category: 'spot_of_day',
    severity: 'info',
    affectedSpotIds: [p.spotId],
    affectedIslands: [p.island].filter(Boolean),
    title: `Spot of the day: ${p.spotName}`,
    body: p.visFt != null
      ? `${p.spotName} just scored ${p.score} (${scoreToTier(p.score)}) with ${p.visFt} ft visibility.`
      : `${p.spotName} just scored ${p.score} — top read across the archipelago this morning.`,
    startMs: Date.now(),
    endMs: Date.now() + 18 * 3600 * 1000,
    source: 'kaicast-derived',
    metadata: { score: p.score, visFt: p.visFt, rank: i + 1 },
    dedupeKey: `spot_of_day:${dateKey}:${p.spotId}`,
  }));
}

// ─── Public surface ─────────────────────────────────────────────────

module.exports = {
  detectVisSpike,
  detectWindDrop,
  detectWindowOpen,
  detectStreakEvents,
  detectTideAlignment,
  detectSpotOfDay,
  // Per-spot batch entry point — used by the scheduler
  detectAllForSpot({ spot, current, history }) {
    return [
      ...detectVisSpike({ spot, current, history }),
      ...detectWindDrop({ spot, current }),
      ...detectWindowOpen({ spot, current }),
      ...detectStreakEvents({ spot, current, history }),
    ];
  },
};
