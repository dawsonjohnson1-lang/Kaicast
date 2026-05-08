import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, RATING_COLORS, RATING_LABELS } from '@/theme';
import { SpotCover } from './SpotCover';
import { Icon } from './Icon';
import type { Spot } from '@/types';

type Props = {
  spot: Spot;
  onPress?: () => void;
  width?: number;
};

export function SpotMiniCard({ spot, onPress, width }: Props) {
  const rating = spot.rating ?? 'good';
  const ratingColor = RATING_COLORS[rating];
  const ratingLabel = RATING_LABELS[rating];
  const photo = spot.imageSource ?? (spot.imageUrl ? { uri: spot.imageUrl } : undefined);

  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : null]}>
      <SpotCover
        seed={spot.id}
        imageSource={photo}
        rounded={radius.md}
        style={styles.cover}
      >
        <View style={styles.coverFab}>
          <Icon name="arrow-right" size={14} color="#fff" strokeWidth={2.5} />
        </View>
      </SpotCover>
      <View style={styles.body}>
        <View style={styles.ratingRow}>
          <View style={[styles.ratingDot, { backgroundColor: ratingColor }]} />
          <Text style={[styles.ratingLabel, { color: ratingColor }]}>{ratingLabel}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{spot.name}</Text>
        <Text style={styles.region} numberOfLines={1}>{spot.region}</Text>
        <Text style={styles.vis}>{spot.visibilityFt ?? '–'} ft vis</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cover: {
    height: 110,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  coverFab: {
    margin: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingDot: { width: 6, height: 6, borderRadius: 999 },
  ratingLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  name: { ...typography.h3, marginTop: 2 },
  region: { ...typography.bodySm, color: colors.textSecondary },
  vis: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
});
