import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, TIER_COLORS, type ConditionTier } from '../tokens';

/**
 * Dive-log row used in Dashboard "Recent dives" and Profile dive log.
 *
 * Compact horizontal row: date + spot + activity + depth + duration +
 * rating pill. Falls back gracefully when fields are absent.
 */

export interface DiveRowProps {
  date: string;            // 'APR 14'
  spot: string;            // 'Electric Beach'
  activity?: string;       // 'Freediving' | 'Scuba'
  depthFt?: number;
  durationMin?: number;
  rating?: ConditionTier;
}

export function DiveRow({ date, spot, activity, depthFt, durationMin, rating }: DiveRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.date}>{date}</Text>
      <View style={styles.middle}>
        <Text style={styles.spot}>{spot}</Text>
        {activity ? <Text style={styles.activity}>{activity}</Text> : null}
      </View>
      {depthFt != null ? (
        <Text style={styles.metric}>{depthFt}<Text style={styles.metricUnit}>ft</Text></Text>
      ) : null}
      {durationMin != null ? (
        <Text style={styles.metric}>{durationMin}<Text style={styles.metricUnit}>m</Text></Text>
      ) : null}
      {rating ? <View style={[styles.ratingDot, { backgroundColor: TIER_COLORS[rating] }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
    width: 56,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  spot: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text1,
  },
  activity: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  metric: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
    minWidth: 36,
    textAlign: 'right',
  },
  metricUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '400',
  },
  ratingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
