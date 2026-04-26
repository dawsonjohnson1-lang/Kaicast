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
};

export function MetricCard({ label, value, unit, sub, style, children }: Props) {
  return (
    <View style={[styles.card, style]}>
      <Text style={typography.caption}>{label}</Text>
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
