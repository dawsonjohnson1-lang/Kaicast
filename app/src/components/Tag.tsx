import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

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

const palette: Record<TagVariant, { bg: string; fg: string; ring: string; label?: string }> = {
  excellent: { bg: colors.excellentSoft,    fg: colors.excellent,     ring: 'rgba(34,211,107,0.5)',  label: 'EXCELLENT' },
  good:      { bg: colors.goodSoft,         fg: colors.good,          ring: 'rgba(123,209,106,0.5)', label: 'GOOD' },
  warn:      { bg: colors.warnSoft,         fg: colors.warn,          ring: 'rgba(245,176,65,0.5)',  label: 'CAUTION' },
  hazard:    { bg: colors.hazardSoft,       fg: colors.hazard,        ring: 'rgba(232,90,60,0.55)',  label: 'HAZARD' },
  scuba:     { bg: colors.scubaSoft,        fg: colors.scuba,         ring: 'rgba(161,106,217,0.55)', label: 'SCUBA' },
  freedive:  { bg: colors.freediveSoft,     fg: colors.freedive,      ring: 'rgba(26,184,255,0.55)',  label: 'FREEDIVING' },
  spear:     { bg: colors.spearSoft,        fg: colors.spear,         ring: 'rgba(34,211,238,0.55)',  label: 'SPEARFISHING' },
  snorkel:   { bg: colors.snorkelSoft,      fg: colors.snorkel,       ring: 'rgba(52,211,153,0.55)',  label: 'SNORKEL' },
  live:      { bg: 'rgba(34,211,107,0.18)', fg: colors.excellent,     ring: 'rgba(34,211,107,0.5)',   label: 'LIVE' },
  neutral:   { bg: colors.bgElevated,       fg: colors.textSecondary, ring: colors.border },
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
  return (
    <View
      style={[
        styles.tag,
        outline
          ? { backgroundColor: 'transparent', borderColor: p.fg }
          : { backgroundColor: p.bg, borderColor: p.ring },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: p.fg }]} />}
      <Text style={[styles.text, { color: p.fg }]}>{(label ?? p.label ?? '').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 999 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});
