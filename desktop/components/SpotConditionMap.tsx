import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, TIER_COLORS, TIER_LABELS, type ConditionTier } from '../tokens';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from './maps/KaiCastMap';
import { SPOTS } from '../data/spots';
import { useSpotRatings } from '../data/getReport';
import type { NavigateFn } from '../router';

/**
 * Compact Hawaii map showing every spot dot-colored by today's condition
 * tier. Drop-in replacement for the year-in-review heatmap that used to
 * live on Profile + Dashboard. Reuses the existing KaiCastMap surface,
 * so map style + interaction is consistent with Spots & Maps.
 *
 * Clicking a spot dot navigates to its detail page. Hover halo grows the
 * pin so it's clear the dots are interactive.
 */

export interface SpotConditionMapProps {
  /** Bound height of the map surface. Width fills the parent. */
  height?: number;
  /** Optional title shown above the map; omit to render bare. */
  title?: string;
  /** Optional subtitle (e.g. "Live · updated every hour"). */
  subtitle?: string;
  onNavigate?: NavigateFn;
}

export function SpotConditionMap({
  height = 320,
  title,
  subtitle,
  onNavigate,
}: SpotConditionMapProps) {
  const spotIds = React.useMemo(() => SPOTS.map((s) => s.id), []);
  const ratings = useSpotRatings(spotIds);

  const [hoveredId, setHoveredId] = React.useState<string | undefined>(undefined);

  const markers: MapMarker[] = React.useMemo(
    () =>
      SPOTS.map((s) => ({
        id: s.id,
        lng: s.lon,
        lat: s.lat,
        tier: ratings.get(s.id),
        label: s.name,
      })),
    [ratings],
  );

  // Tier counts — fuel the legend strip below the map so the user can
  // read "5 excellent, 12 great…" without squinting at the dots.
  const counts = React.useMemo(() => {
    const c: Record<ConditionTier, number> = {
      excellent: 0, great: 0, good: 0, fair: 0, 'no-go': 0,
    };
    for (const m of markers) if (m.tier) c[m.tier]++;
    return c;
  }, [markers]);

  return (
    <View style={styles.root}>
      {title || subtitle ? (
        <View style={styles.head}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}

      <View style={[styles.mapWrap, { height }]}>
        <KaiCastMap
          markers={markers}
          center={HAWAII_CENTER}
          zoom={HAWAII_ZOOM}
          hoveredId={hoveredId}
          onMarkerClick={(id) => onNavigate?.('spot-detail', { spotId: id })}
          showZoomControls={false}
          interactive
          style={{ width: '100%', height: '100%', borderRadius: radius.md }}
        />
      </View>

      <View style={styles.legend}>
        {(['excellent', 'great', 'good', 'fair', 'no-go'] as ConditionTier[]).map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: TIER_COLORS[t] }]} />
            <Text style={styles.legendCount}>{counts[t]}</Text>
            <Text style={styles.legendLabel}>{TIER_LABELS[t]}</Text>
          </View>
        ))}
        <View style={styles.legendSpacer} />
        <Text style={styles.legendHint}>Click a spot to open its forecast</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  head: { gap: 4 },
  title: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  mapWrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text2,
    fontWeight: '600',
  },
  legendLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    letterSpacing: 0.6,
  },
  legendSpacer: { flex: 1 },
  legendHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text4,
  },
});
