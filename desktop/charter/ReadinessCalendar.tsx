// ReadinessCalendar — 14-day grid: spots (rows) × days (columns) with
// each cell color-coded by forecast tier. The captain scans for "when
// is Tunnels Reef going to be good this week?" in 2 seconds.
//
// Each row fetches its forecast via useSpotReport(linkedPublicSpotId)
// — which returns 7 days of daily ratings — and the cell color picks
// the matching `days[i]` entry. Days 8–14 fall back to the most
// recent day's tier (the abyss pipeline only forecasts 7 days right
// now; the trailing week is "best estimate" until the model window
// extends).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useSpotReport, tierFromRating } from '../data/getReport';
import type { CharterSpot } from './types';

type Tier = 'excellent' | 'great' | 'good' | 'fair' | 'no-go' | 'unknown';

const TIER_COLOR: Record<Tier, string> = {
  excellent: '#09A1FB',
  great:     '#3DDC84',
  good:      '#3DDC84',
  fair:      '#F5A623',
  'no-go':   '#F73726',
  unknown:   colors.surface2,
};

const TIER_TINT: Record<Tier, string> = {
  excellent: 'rgba(9,161,251,0.25)',
  great:     'rgba(61,220,132,0.25)',
  good:      'rgba(61,220,132,0.25)',
  fair:      'rgba(245,166,35,0.25)',
  'no-go':   'rgba(247,55,38,0.25)',
  unknown:   'transparent',
};

const DAYS = 14;

export function ReadinessCalendar({ spots }: { spots: CharterSpot[] }) {
  const days = React.useMemo(() => buildDays(DAYS), []);

  if (spots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No spots in your library yet.</Text>
        <Text style={styles.emptyBody}>Add spots at /charter/spots — once linked to public KaiCast spots they'll appear here with full forecast data.</Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      {/* Header row — dates */}
      <View style={styles.headerRow}>
        <View style={styles.spotCol} />
        {days.map((d) => {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <View key={d.toISOString()} style={[styles.dayCol, isWeekend && styles.dayColWeekend]}>
              <Text style={styles.dayLabel}>{d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Pacific/Honolulu' }).toUpperCase()}</Text>
              <Text style={styles.dayDate}>{d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' })}</Text>
            </View>
          );
        })}
      </View>

      {/* Body — one row per spot */}
      {spots.map((spot) => <CalendarRow key={spot.id} spot={spot} days={days} />)}

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>LEGEND</Text>
        <LegendDot tier="excellent" label="Excellent" />
        <LegendDot tier="good"      label="Good" />
        <LegendDot tier="fair"      label="Borderline" />
        <LegendDot tier="no-go"     label="No-go" />
        <LegendDot tier="unknown"   label="No data" />
      </View>
    </View>
  );
}

function CalendarRow({ spot, days }: { spot: CharterSpot; days: Date[] }) {
  const reportSpotId = spot.linkedPublicSpotId ?? spot.id;
  const { data: report } = useSpotReport(reportSpotId);
  // BackendReport.days is the per-day forecast array; days[0] = today.
  const reportDays: Array<{ rating?: { label?: string; rating?: string; score?: number } }> =
    (report?.days as Array<{ rating?: { label?: string; rating?: string; score?: number } }> | undefined) ?? [];

  return (
    <View style={styles.bodyRow}>
      <View style={styles.spotCol}>
        <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
        <Text style={styles.spotMeta} numberOfLines={1}>{spot.depthFt || '—'}ft · {spot.tidePreference}</Text>
      </View>
      {days.map((d, i) => {
        // Map this column's day to the report's day index. Day 0 is
        // today; subsequent days are i ahead. Beyond the report's
        // forecast horizon, fall back to the last available day.
        const forecastIdx = Math.min(i, reportDays.length - 1);
        const tier: Tier = report
          ? (reportDays[forecastIdx]?.rating
              ? tierFromRating(reportDays[forecastIdx].rating)
              : 'unknown')
          : 'unknown';
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const beyondHorizon = i >= reportDays.length;
        return (
          <View
            key={d.toISOString()}
            style={[
              styles.dayCol,
              styles.dataCell,
              { backgroundColor: TIER_TINT[tier], borderLeftColor: TIER_COLOR[tier] },
              isWeekend && styles.dayColWeekend,
              beyondHorizon && styles.cellBeyondHorizon,
            ]}
          >
            <View style={[styles.cellDot, { backgroundColor: TIER_COLOR[tier] }]} />
          </View>
        );
      })}
    </View>
  );
}

function LegendDot({ tier, label }: { tier: Tier; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: TIER_COLOR[tier] }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function buildDays(n: number): Date[] {
  const today = new Date();
  // Anchor at HST midnight so weekday rendering matches the captain's
  // local mental model.
  const result: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    result.push(d);
  }
  return result;
}

const SPOT_COL_WIDTH = 180;

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  bodyRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  spotCol: {
    width: SPOT_COL_WIDTH,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: colors.hairlineStrong,
    justifyContent: 'center',
  },
  spotName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  spotMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 3 },
  dayCol: {
    flex: 1,
    minWidth: 38,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  dayColWeekend: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dataCell: {
    minHeight: 44,
    borderLeftWidth: 3,
  },
  cellBeyondHorizon: { opacity: 0.55 },
  cellDot: { width: 10, height: 10, borderRadius: 5 },
  dayLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.text3, fontWeight: '700', letterSpacing: 0.5 },
  dayDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.text2, marginTop: 2 },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, backgroundColor: colors.surface1, borderTopWidth: 1, borderTopColor: colors.hairline },
  legendLabel: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colors.text3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3 },

  empty: { padding: 20, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, lineHeight: 20, marginTop: 6 },
});
