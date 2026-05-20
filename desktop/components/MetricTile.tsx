import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../tokens';

/**
 * Big-number metric block. Three layouts:
 *  - default: large number, unit beside, label below (used in SpotCard
 *    metric row and Dashboard stat cards).
 *  - stacked: label above, number below (used in tide events / inline facts).
 *  - inline:  number + unit on one line, no label (used in compact tables).
 */

export interface MetricTileProps {
  value: string | number;
  unit?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Color override for the value text (used to tint by condition). */
  tone?: string;
}

export function MetricTile({ value, unit, label, size = 'md', tone }: MetricTileProps) {
  const sizeStyles =
    size === 'sm' ? smStyles :
    size === 'lg' ? lgStyles :
    mdStyles;

  return (
    <View style={styles.root}>
      <View style={styles.valueRow}>
        <Text style={[sizeStyles.value, tone ? { color: tone } : null]}>{value}</Text>
        {unit ? <Text style={sizeStyles.unit}>{unit}</Text> : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
    textTransform: 'uppercase',
  },
});

const smStyles = StyleSheet.create({
  value: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text1,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
});

const mdStyles = StyleSheet.create({
  value: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '600',
    color: colors.text1,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
});

const lgStyles = StyleSheet.create({
  value: {
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text3,
  },
});
