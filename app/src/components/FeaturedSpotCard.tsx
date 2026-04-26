import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { Tag } from './Tag';
import { Icon } from './Icon';
import type { Spot } from '@/types';

type Props = {
  spot: Spot & { airTempF?: number; visibilityFt?: number; windMph?: number; current?: string };
  onPress?: () => void;
};

export function FeaturedSpotCard({ spot, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <LinearGradient
        colors={[spot.coverColor ?? '#0c4a5c', '#04111e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <Tag variant="excellent" label="BEST CONDITIONS NOW" dot />
        <Text style={styles.tempInline}>{spot.airTempF ?? 79}°F</Text>
      </View>
      <Text style={typography.h1}>{spot.name}</Text>
      <Text style={styles.region}>{spot.region}</Text>

      <View style={styles.statsRow}>
        <Stat label="VISIBILITY" value={`${spot.visibilityFt ?? 56} FT`} />
        <Stat label="WIND" value={`${spot.windMph ?? 1} MPH`} />
        <Stat label="CURRENT" value={spot.current ?? 'STRONG'} />
      </View>

      <View style={styles.bar}>
        <LinearGradient
          colors={[colors.excellent, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: '82%' }]}
        />
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.live}>EXCELLENT · LIVE</Text>
        <View style={styles.fab}>
          <Icon name="arrow-right" size={18} color={colors.textPrimary} />
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={typography.caption}>{label}</Text>
      <Text style={[typography.metricSm, { marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.xl,
    minHeight: 240,
    justifyContent: 'flex-end',
  },
  topRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tempInline: {
    ...typography.h2,
  },
  region: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  bar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  live: {
    ...typography.caption,
    color: colors.excellent,
  },
  fab: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
