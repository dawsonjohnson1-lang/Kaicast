import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { Tag } from './Tag';
import type { Spot } from '@/types';

type Props = {
  spot: Spot;
  onPress?: () => void;
  width?: number;
};

export function SpotMiniCard({ spot, onPress, width }: Props) {
  const ratingTag = spot.rating === 'excellent' ? 'excellent' : spot.rating === 'good' ? 'good' : spot.rating === 'caution' ? 'warn' : 'hazard';
  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : null]}>
      <LinearGradient
        colors={[spot.coverColor ?? '#0c4a5c', '#04111e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cover}
      >
        <View style={styles.tagWrap}>
          <Tag variant={ratingTag} dot />
        </View>
      </LinearGradient>
      <View style={styles.body}>
        <Text style={typography.h3} numberOfLines={1}>{spot.name}</Text>
        <Text style={styles.region}>{spot.region}</Text>
        <Text style={styles.vis}>{spot.visibilityFt ?? '–'} FT VIS</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cover: {
    height: 110,
    padding: spacing.md,
    justifyContent: 'flex-start',
  },
  tagWrap: { alignSelf: 'flex-start' },
  body: { padding: spacing.md },
  region: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  vis: { ...typography.caption, color: colors.textPrimary, marginTop: 6 },
});
