import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { Tag } from './Tag';
import { Icon } from './Icon';
import type { Spot } from '@/types';

type Props = {
  spot: Spot;
  onPress?: () => void;
  width?: number;
};

export function SpotMiniCard({ spot, onPress, width }: Props) {
  const ratingTag =
    spot.rating === 'excellent' ? 'excellent' : spot.rating === 'good' ? 'good' : spot.rating === 'caution' ? 'warn' : 'hazard';
  const ratingLabel = spot.rating === 'excellent' ? 'GREAT' : spot.rating === 'good' ? 'GOOD' : spot.rating === 'caution' ? 'CAUTION' : 'HAZARD';
  const photo = spot.imageSource ?? (spot.imageUrl ? { uri: spot.imageUrl } : undefined);
  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : null]}>
      <View style={styles.cover}>
        <LinearGradient
          colors={[spot.coverColor ?? '#0c4a5c', '#04111e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {photo && <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="contain" />}
        <View style={styles.iconBubble}>
          <Icon name="compass-arrow" size={16} color={colors.textPrimary} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.tagWrap}>
          <Tag variant={ratingTag} label={ratingLabel} dot />
        </View>
        <Text style={[typography.h3, { marginTop: spacing.sm }]} numberOfLines={1}>
          {spot.name}
        </Text>
        <Text style={styles.region}>{spot.region}</Text>
        <Text style={styles.vis}>{spot.visibilityFt ?? '–'} ft vis</Text>
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
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagWrap: { alignSelf: 'flex-start' },
  body: { padding: spacing.md },
  region: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  vis: { ...typography.bodySm, color: colors.accent, marginTop: 6, fontWeight: '600' },
});
