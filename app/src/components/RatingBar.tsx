import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  value: number;
  max?: number;
  label?: string;
  caption?: string;
};

export function RatingBar({ value, max = 10, label, caption }: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View>
      {label ? <Text style={typography.caption}>{label}</Text> : null}
      <View style={styles.barWrap}>
        <LinearGradient
          colors={[colors.uv[0], colors.uv[1], colors.uv[2], colors.uv[3], colors.uv[4]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
        <View style={[styles.knob, { left: `${pct * 100}%` }]} />
      </View>
      <View style={styles.row}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : <View />}
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: spacing.sm,
    backgroundColor: colors.cardAlt,
  },
  gradient: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  knob: {
    position: 'absolute',
    top: -3,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#fff',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#0a1626',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  caption: { ...typography.caption, color: colors.textMuted },
  value: { ...typography.h3, color: colors.textPrimary },
});
