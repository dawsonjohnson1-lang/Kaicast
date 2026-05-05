import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  /** Top-right icon, e.g. a small SVG glyph for the metric type. */
  icon?: React.ReactNode;
};

export function MetricCard({ label, value, unit, sub, style, children, icon }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={typography.caption}>{label}</Text>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      </View>
      <View style={styles.row}>
        <Text style={typography.metric}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flex: 1,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconWrap: { marginLeft: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.sm },
  unit: {
    ...typography.h3,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
