// Per-spot forecast helpers shared between the spot list card (which
// shows a 7-day sparkline + "best upcoming window" callout) and the
// readiness calendar (which already shipped in Phase 3 against a
// similar shape).

import { tierFromRating } from '../data/getReport';

export type Tier = 'excellent' | 'great' | 'good' | 'fair' | 'no-go' | 'unknown';

export const TIER_COLOR: Record<Tier, string> = {
  excellent: '#09A1FB',
  great:     '#3DDC84',
  good:      '#3DDC84',
  fair:      '#F5A623',
  'no-go':   '#F73726',
  unknown:   '#3a3f4a',
};

export const TIER_LABEL: Record<Tier, string> = {
  excellent: 'Excellent',
  great:     'Great',
  good:      'Good',
  fair:      'Borderline',
  'no-go':   'No-go',
  unknown:   'No data',
};

/** Pull the per-day forecast tiers off a BackendReport-shaped object.
 *  Loose `unknown` input so callers don't have to fight TS over the
 *  fact that the BackendReport type's `days` is BackendDay[]. We dig
 *  defensively — the contract isn't strict at runtime anyway. */
export function tiersFromReport(report: unknown): Tier[] {
  const r = report as { days?: unknown[] } | null | undefined;
  if (!r?.days?.length) return [];
  return r.days.map((d) => {
    const rating = (d as { rating?: unknown })?.rating;
    if (!rating) return 'unknown';
    return tierFromRating(rating as { label?: string; rating?: string; score?: number }) ?? 'unknown';
  });
}

const GOOD_TIERS: Tier[] = ['excellent', 'great', 'good'];

export interface BestWindow {
  /** Index into the tiers array (0 = today). null if no Good+ day found. */
  dayIndex: number | null;
  /** Tier on that day. */
  tier: Tier | null;
  /** Days from today (0 = today, 1 = tomorrow, …). null when none. */
  daysOut: number | null;
}

/** Find the next day in the forecast horizon that hits Good or
 *  better. Returns null fields when nothing in the horizon qualifies. */
export function bestUpcomingWindow(tiers: Tier[]): BestWindow {
  for (let i = 0; i < tiers.length; i++) {
    if (GOOD_TIERS.includes(tiers[i])) {
      return { dayIndex: i, tier: tiers[i], daysOut: i };
    }
  }
  return { dayIndex: null, tier: null, daysOut: null };
}

/** Human-readable label for a BestWindow — "Today", "Tomorrow",
 *  "Friday", "Aug 21", or "No Good+ window in next 7 days". */
export function bestWindowLabel(bw: BestWindow): string {
  if (bw.daysOut == null) return 'No Good+ window in next 7 days';
  if (bw.daysOut === 0) return `Good today (${TIER_LABEL[bw.tier ?? 'good']})`;
  if (bw.daysOut === 1) return `${TIER_LABEL[bw.tier ?? 'good']} tomorrow`;
  // daysOut indexes report.days, which is anchored at HST today — format
  // in Pacific/Honolulu so mainland viewers don't see an off-by-one weekday.
  // Adding whole 86400000-ms days is safe: HST has no DST.
  const d = new Date(Date.now() + bw.daysOut * 86400000);
  if (bw.daysOut < 7) {
    return `${TIER_LABEL[bw.tier ?? 'good']} ${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' })}`;
  }
  return `${TIER_LABEL[bw.tier ?? 'good']} on ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' })}`;
}
