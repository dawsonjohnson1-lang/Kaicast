import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '@/theme';
import { SpotCover } from './SpotCover';
import { Icon } from './Icon';
import type { Spot } from '@/types';

type Props = {
  spot: Spot & {
    airTempF?: number;
    visibilityFt?: number;
    windMph?: number;
    current?: string;
    progress?: number;
  };
  onPress?: () => void;
};

export function FeaturedSpotCard({ spot, onPress }: Props) {
  const progress = Math.max(0, Math.min(1, spot.progress ?? 0.7));
  return (
    <Pressable onPress={onPress} style={styles.outer}>
      <SpotCover
        seed={spot.id}
        imageSource={spot.imageSource}
        imageUri={spot.imageUrl}
        rounded={radius.xl}
        style={styles.cover}
      >
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={styles.bestPill}>
              <View style={styles.bestDot} />
              <Text style={styles.bestText}>BEST CONDITIONS NOW</Text>
            </View>
            <Text style={styles.temp}>{spot.airTempF ?? 79}°F</Text>
          </View>

          <Text style={styles.title}>{spot.name}</Text>
          <Text style={styles.region}>{spot.region}</Text>

          <View style={styles.statsRow}>
            <Stat label="VISIBILITY" value={`${spot.visibilityFt ?? 56} FT`} />
            <Stat label="WIND" value={`${spot.windMph ?? 1} MPH`} />
            <Stat label="CURRENT" value={spot.current ?? 'STRONG'} />
          </View>

          <View style={styles.barTrack}>
            <LinearGradient
              colors={[colors.progressStart, colors.progressEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.barFill, { width: `${progress * 100}%` }]}
            />
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.live}>GREAT · LIVE</Text>
            <View style={styles.fab}>
              <Icon name="arrow-right" size={18} color="#04070d" strokeWidth={2.5} />
            </View>
          </View>
        </View>
      </SpotCover>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radius.xl },
  cover: { minHeight: 260 },
  body: {
    padding: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bestDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.excellent },
  bestText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.excellent,
    letterSpacing: 0.6,
  },
  temp: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 48,
    letterSpacing: -1,
    marginTop: spacing.sm,
  },
  region: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.1,
    fontWeight: '600',
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.4,
  },
  barTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: { height: '100%', borderRadius: 999 },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  live: {
    color: colors.excellent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
