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

const palette: Record<TagVariant, { bg: string; fg: string; label?: string; outline?: boolean }> = {
  excellent: { bg: colors.excellentSoft, fg: colors.excellent, label: 'EXCELLENT' },
  good: { bg: colors.goodSoft, fg: colors.good, label: 'GOOD' },
  warn: { bg: colors.warnSoft, fg: colors.warn, label: 'CAUTION' },
  hazard: { bg: colors.hazardSoft, fg: colors.hazard, label: 'HAZARD' },
  scuba: { bg: colors.scubaSoft, fg: colors.scuba, label: 'SCUBA', outline: true },
  freedive: { bg: 'transparent', fg: colors.freedive, label: 'FREEDIVING', outline: true },
  spear: { bg: colors.spearSoft, fg: colors.spear, label: 'SPEARFISHING' },
  snorkel: { bg: colors.snorkelSoft, fg: colors.snorkel, label: 'SNORKEL' },
  live: { bg: colors.excellentSoft, fg: colors.excellent, label: 'LIVE' },
  neutral: { bg: colors.bgElevated, fg: colors.textSecondary },
};

type Props = {
  variant: TagVariant;
  label?: string;
  style?: ViewStyle;
  dot?: boolean;
  outline?: boolean;
};

export function Tag({ variant, label, style, dot, outline }: Props) {
  const p = palette[variant];
  const useOutline = outline ?? p.outline ?? false;
  return (
    <View
      style={[
        styles.tag,
        useOutline
          ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: p.fg }
          : { backgroundColor: p.bg },
        style,
      ]}
    >
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
