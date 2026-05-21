import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, TIER_COLORS, TIER_LABELS, type ConditionTier } from '../tokens';

/**
 * Small pill rendering a condition tier with a colored dot.
 * Used in the spot list, hourly table, forecast strip, and community reports.
 *
 * Two sizes:
 *  - sm: ~15px tall, 11px text — for inline use in dense tables
 *  - md: ~20px tall, 12px text — for cards and headers (default)
 */

export interface ConditionPillProps {
  tier: ConditionTier;
  size?: 'sm' | 'md';
  /** Override the auto-generated label (e.g. 'LIVE EXCELLENT'). */
  label?: string;
}

export function ConditionPill({ tier, size = 'md', label }: ConditionPillProps) {
  const tint = TIER_COLORS[tier];
  const text = label ?? TIER_LABELS[tier];
  const sized = size === 'sm' ? styles.sm : styles.md;

  return (
    <View
      style={[
        styles.root,
        sized,
        { borderColor: hexWithAlpha(tint, 0.35), backgroundColor: hexWithAlpha(tint, 0.10) },
      ]}
    >
      <View style={[styles.dot, size === 'sm' && styles.dotSm, { backgroundColor: tint }]} />
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: tint }]}>
        {text}
      </Text>
    </View>
  );
}

/** Convert a #RRGGBB hex to an rgba string with the given alpha. */
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  md: {
    height: 20,
    paddingHorizontal: 10,
    borderRadius: 4,
    gap: 8,
  },
  sm: {
    height: 15,
    paddingHorizontal: 7,
    borderRadius: 3,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    // Suppress underline default on RN-Web Text inside flex parents.
    color: colors.text1,
  },
  labelSm: {
    fontSize: 9,
    letterSpacing: 0.9,
  },
});
