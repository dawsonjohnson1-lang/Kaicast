// TripCard — renders one trip on the charter home screen.
//
// The card reads its own forecast via useSpotReport(primarySpotId)
// so each trip on the today list lights up its go/no-go badge
// independently. The badge tier is derived from the hourly window
// that lines up closest with the trip's planned departure hour —
// not the "current" report, since a 14:00 trip cares about 14:00
// conditions, not 06:00 conditions.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useSpotReport, tierFromRating, type BackendReport } from '../data/getReport';
import { SPOTS as CANONICAL_SPOTS } from '../data/spots';
import type { Trip, TripType } from './types';

type Tier = 'excellent' | 'great' | 'good' | 'fair' | 'no-go';

const TIER_COLOR: Record<Tier, string> = {
  excellent: '#09A1FB', // electric blue
  great:     '#3DDC84',
  good:      '#3DDC84',
  fair:      '#F5A623',
  'no-go':   '#F73726',
};

const TIER_LABEL: Record<Tier, string> = {
  excellent: 'EXCELLENT',
  great:     'GO',
  good:      'GO',
  fair:      'BORDERLINE',
  'no-go':   'NO-GO',
};

const TRIP_TYPE_LABEL: Record<TripType, string> = {
  dive:          '🤿 Scuba',
  snorkel:       '🐠 Snorkel',
  spearfishing:  '🎣 Spear',
  freedive:      '🫁 Freedive',
};

export function TripCard({ trip }: { trip: Trip }) {
  const primarySpotId = trip.spots[0] ?? null;
  const { data: report, loading: reportLoading } = useSpotReport(primarySpotId ?? undefined);

  // Pick the hourly window that overlaps the trip's planned departure.
  // useSpotReport returns the BackendReport with `windows` (hourly
  // chunks) — we find the one whose start aligns with departure.
  const windowMatch = React.useMemo(
    () => report ? findWindowForDeparture(report, trip.date, trip.departureTime) : null,
    [report, trip.date, trip.departureTime],
  );

  const tier: Tier | null = report
    ? windowMatch
      ? tierFromRating(windowMatch.rating as { label?: string; rating?: string; score?: number } | undefined)
      : tierFromRating(report.now?.rating as { label?: string; rating?: string; score?: number } | undefined)
    : null;

  const blocking = windowMatch ? blockingFactors(windowMatch) : [];
  const primarySpotName = primarySpotId
    ? (CANONICAL_SPOTS.find((s) => s.id === primarySpotId)?.name ?? primarySpotId)
    : 'No spot set';
  const remainingSpots = trip.spots.length > 1 ? trip.spots.length - 1 : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.depTime}>{trip.departureTime}</Text>
            <Text style={styles.depReturn}>→ {trip.returnTime}</Text>
            <Text style={styles.typeBadge}>{TRIP_TYPE_LABEL[trip.tripType]}</Text>
          </View>
          <Text style={styles.spotName}>{primarySpotName}</Text>
          {remainingSpots > 0 ? (
            <Text style={styles.spotMeta}>+{remainingSpots} more {remainingSpots === 1 ? 'stop' : 'stops'}</Text>
          ) : null}
        </View>

        {/* Go / no-go badge */}
        <View style={styles.badgeCol}>
          {reportLoading ? (
            <View style={[styles.badge, { borderColor: colors.hairlineStrong }]}>
              <Text style={[styles.badgeLabel, { color: colors.text3 }]}>READING…</Text>
            </View>
          ) : tier ? (
            <View style={[styles.badge, { borderColor: TIER_COLOR[tier], backgroundColor: tintFor(tier) }]}>
              <View style={[styles.badgeDot, { backgroundColor: TIER_COLOR[tier] }]} />
              <Text style={[styles.badgeLabel, { color: TIER_COLOR[tier] }]}>{TIER_LABEL[tier]}</Text>
            </View>
          ) : (
            <View style={[styles.badge, { borderColor: colors.hairlineStrong }]}>
              <Text style={[styles.badgeLabel, { color: colors.text3 }]}>NO DATA</Text>
            </View>
          )}
        </View>
      </View>

      {blocking.length > 0 ? (
        <View style={styles.blockingRow}>
          {blocking.map((b) => (
            <View key={b.label} style={styles.blockChip}>
              <Text style={styles.blockChipText}>{b.label}: {b.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.footerLabel}>
          {trip.headcount} {trip.headcount === 1 ? 'passenger' : 'passengers'}
          {trip.crew.length > 0 ? ` · ${trip.crew.length} crew` : ''}
          {trip.floatPlanFiled ? ' · ✓ Float plan filed' : ''}
        </Text>
        <View style={styles.footerActions}>
          <Pressable style={styles.footerBtn}>
            <Text style={styles.footerBtnText}>Open trip</Text>
          </Pressable>
          {tier === 'fair' || tier === 'no-go' ? (
            <Pressable style={[styles.footerBtn, styles.footerBtnAlt]}>
              <Text style={[styles.footerBtnText, styles.footerBtnTextAlt]}>Alternates</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────

/** Find the hourly window that starts at the trip's departure hour.
 *  Falls back to the closest earlier window if there's no exact match
 *  (e.g. trip at 13:30 lines up with the 13:00 window). Returns null
 *  when the report has no windows or all windows are in the future. */
function findWindowForDeparture(
  report: BackendReport,
  tripDate: Date,
  departureTime: string,
): { rating?: unknown; visibility?: { estimatedVisibilityFeet?: number }; wind?: { gustMph?: number; speedMph?: number }; swell?: { heightFt?: number } } | null {
  const [hStr, mStr] = departureTime.split(':');
  const hour = Number.parseInt(hStr ?? '0', 10);
  const minute = Number.parseInt(mStr ?? '0', 10);
  const tripStart = new Date(tripDate);
  tripStart.setHours(hour, minute, 0, 0);
  const targetMs = tripStart.getTime();
  const windows = (report.windows as Array<{ startIso?: string; rating?: unknown }> | undefined) ?? [];
  if (windows.length === 0) return null;
  let best: { delta: number; w: unknown } | null = null;
  for (const w of windows) {
    if (!w.startIso) continue;
    const wStart = Date.parse(w.startIso);
    const delta = Math.abs(wStart - targetMs);
    if (!best || delta < best.delta) best = { delta, w };
  }
  return best?.w as { rating?: unknown } | null;
}

/** Pull a couple of headline factors from a window so the card can
 *  surface "why borderline?" inline rather than making the captain
 *  open a detail panel. We pick the most surprising negative
 *  factors — high swell, low vis, gusty wind. */
function blockingFactors(
  w: { visibility?: { estimatedVisibilityFeet?: number }; wind?: { gustMph?: number; speedMph?: number }; swell?: { heightFt?: number } },
): Array<{ label: string; detail: string }> {
  const out: Array<{ label: string; detail: string }> = [];
  const vis = w.visibility?.estimatedVisibilityFeet;
  if (typeof vis === 'number' && vis < 25) {
    out.push({ label: 'Vis', detail: `${Math.round(vis)} ft` });
  }
  const swellFt = w.swell?.heightFt;
  if (typeof swellFt === 'number' && swellFt >= 6) {
    out.push({ label: 'Swell', detail: `${swellFt.toFixed(1)} ft` });
  }
  const gust = w.wind?.gustMph;
  if (typeof gust === 'number' && gust >= 25) {
    out.push({ label: 'Gust', detail: `${Math.round(gust)} mph` });
  }
  return out.slice(0, 3);
}

function tintFor(tier: Tier): string {
  // Use a very low-alpha overlay of the tier color as the badge background
  // so the rendered badge sits on the card without screaming color.
  return tier === 'excellent' ? 'rgba(9,161,251,0.10)'
       : tier === 'great' || tier === 'good' ? 'rgba(61,220,132,0.10)'
       : tier === 'fair' ? 'rgba(245,166,35,0.10)'
       : 'rgba(247,55,38,0.10)';
}

// ─── styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    padding: 18,
    gap: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  depTime: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  depReturn: { fontFamily: fonts.mono, fontSize: 13, color: colors.text3 },
  typeBadge: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  spotName: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    marginTop: 6,
  },
  spotMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 2 },
  badgeCol: { alignItems: 'flex-end', gap: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  blockingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  blockChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  blockChipText: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '600', color: colors.text2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  footerLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, flex: 1 },
  footerActions: { flexDirection: 'row', gap: 6 },
  footerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  footerBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text1 },
  footerBtnAlt: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  footerBtnTextAlt: { color: colors.accent },
});
