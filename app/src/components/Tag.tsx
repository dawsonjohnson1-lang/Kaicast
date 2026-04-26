import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type TagVariant =
  | 'excellent'
  | 'good'
  | 'warn'
  | 'hazard'
  | 'scuba'
  | 'freedive'
  | 'spear'
  | 'snorkel'
  | 'live'
  | 'neutral';

const palette: Record<TagVariant, { bg: string; fg: string; label?: string }> = {
  excellent: { bg: colors.excellentSoft, fg: colors.excellent, label: 'Excellent' },
  good: { bg: colors.excellentSoft, fg: colors.good, label: 'Good' },
  warn: { bg: colors.warnSoft, fg: colors.warn, label: 'Caution' },
  hazard: { bg: colors.hazardSoft, fg: colors.hazard, label: 'Hazard' },
  scuba: { bg: colors.scubaSoft, fg: colors.scuba, label: 'Scuba' },
  freedive: { bg: colors.freediveSoft, fg: colors.freedive, label: 'Freediving' },
  spear: { bg: colors.spearSoft, fg: colors.spear, label: 'Spearfishing' },
  snorkel: { bg: colors.snorkelSoft, fg: colors.snorkel, label: 'Snorkel' },
  live: { bg: colors.excellentSoft, fg: colors.excellent, label: 'Live' },
  neutral: { bg: colors.bgElevated, fg: colors.textSecondary },
};

type Props = {
  variant: TagVariant;
  label?: string;
  style?: ViewStyle;
  dot?: boolean;
};

export function Tag({ variant, label, style, dot }: Props) {
  const p = palette[variant];
  return (
    <View style={[styles.tag, { backgroundColor: p.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: p.fg }]} />}
      <Text style={[styles.text, { color: p.fg }]}>{label ?? p.label ?? ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  text: {
    ...typography.tag,
  },
});
