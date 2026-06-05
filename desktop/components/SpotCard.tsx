import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, TIER_COLORS, type ConditionTier } from '../tokens';
import { ConditionPill } from './ConditionPill';
import { MetricTile } from './MetricTile';

/**
 * Spot card — used in Conditions "Firing now" strip and Dashboard
 * favorite spots row. Top accent stripe in the tier color, condition
 * pill, spot name + region, 3-metric row (vis / water / swell), and a
 * best-window readout.
 *
 * Layout: 370×171 in Figma; flex-fitted here so 3 cards fit a 1136px row.
 */

export interface SpotCardProps {
  name: string;
  region: string;
  rating: ConditionTier;
  visibilityFt: number;
  waterTempF: number;
  swellFt: number;
  bestWindow: string;
}

export function SpotCard({
  name,
  region,
  rating,
  visibilityFt,
  waterTempF,
  swellFt,
  bestWindow,
}: SpotCardProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.accent, { backgroundColor: TIER_COLORS[rating] }]} />

      <ConditionPill tier={rating} size="md" />

      <Text style={styles.name}>{name}</Text>
      <Text style={styles.region}>{region}</Text>

      <View style={styles.metricsAndWindowRow}>
        <View style={styles.metricsRow}>
          <MetricTile value={visibilityFt} unit="ft" label="Visibility" />
          <MetricTile value={waterTempF}   unit="°F" label="Water" />
          <MetricTile value={swellFt}      unit="ft" label="Swell" />
        </View>
        <View style={styles.windowWrap}>
          <Text style={styles.windowLabel}>Best window</Text>
          <Text style={styles.windowValue}>{bestWindow}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: 23,
    paddingVertical: 21,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  accent: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 3,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  region: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  metricsAndWindowRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  metricsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
  },
  windowWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  windowLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  windowValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text1,
  },
});
