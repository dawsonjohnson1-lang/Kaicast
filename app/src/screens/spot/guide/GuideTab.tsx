import React from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet, Alert } from 'react-native';

import { Card } from '@/components/Card';
import { Tag } from '@/components/Tag';
import { colors, radius, spacing, typography } from '@/theme';
import type { Spot } from '@/types';

type Props = {
  spot: Spot;
};

const FALLBACK_DESCRIPTION =
  'Spot details coming soon. Conditions, entry points, and marine life will appear here once we publish the spot guide.';
const FALLBACK_ENTRY_EXIT =
  'Entry and exit details for this spot have not been published yet.';

const MAPS_API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
const HAS_MAPS_KEY = MAPS_API_KEY.length > 0;

function staticMapUrl(lat: number, lon: number): string {
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lon}` +
    `&zoom=16` +
    `&size=600x300` +
    `&scale=2` +
    `&maptype=satellite` +
    `&key=${MAPS_API_KEY}`
  );
}

function googleMapsDeepLink(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

export function GuideTab({ spot }: Props) {
  const description = spot.description ?? FALLBACK_DESCRIPTION;
  const entryExit = spot.entryExit ?? FALLBACK_ENTRY_EXIT;
  const marineLife = spot.marineLife ?? [];

  const openInMaps = async () => {
    const url = googleMapsDeepLink(spot.lat, spot.lon);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Cannot open Maps', url);
    } catch {
      Alert.alert('Cannot open Maps', url);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      {/* 1. Spot description */}
      <Card>
        <Text style={typography.caption}>SPOT GUIDE</Text>
        <Text style={[typography.h3, { marginTop: spacing.sm }]}>{spot.name}</Text>
        <Text style={styles.bodyText}>{description}</Text>
      </Card>

      {/* 2. Entry & exit */}
      <Card>
        <Text style={typography.caption}>ENTRY & EXIT</Text>
        <Text style={styles.bodyText}>{entryExit}</Text>
      </Card>

      {/* 3. Marine life */}
      <Card>
        <Text style={typography.caption}>MARINE LIFE</Text>
        <View style={styles.tagRow}>
          {marineLife.length === 0 ? (
            <Text style={[styles.bodyText, { marginTop: 0 }]}>No species recorded yet.</Text>
          ) : (
            marineLife.map((m) => <Tag key={m} variant="freedive" label={m} />)
          )}
        </View>
      </Card>

      {/* 4. Satellite map */}
      <Pressable onPress={openInMaps} style={styles.mapCard}>
        {HAS_MAPS_KEY ? (
          <Image
            source={{ uri: staticMapUrl(spot.lat, spot.lon) }}
            style={styles.mapImg}
            resizeMode="cover"
            accessibilityLabel={`Satellite map of ${spot.name}`}
          />
        ) : (
          <View style={[styles.mapImg, styles.mapPlaceholder]}>
            <Text style={styles.mapPlaceholderTitle}>Satellite preview unavailable</Text>
            <Text style={styles.mapPlaceholderSub}>
              Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in app/.env to enable the Google Maps tile.
            </Text>
          </View>
        )}
        <View style={styles.mapFooter}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>{spot.name}</Text>
            <Text style={styles.mapCoords}>
              {spot.lat.toFixed(4)}°, {spot.lon.toFixed(4)}°
            </Text>
          </View>
          <Text style={styles.openInMaps}>Open in Maps ↗</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mapCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  mapImg: {
    width: '100%',
    aspectRatio: 2,
    backgroundColor: colors.cardAlt,
  },
  mapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  mapPlaceholderTitle: { ...typography.h3, color: colors.textPrimary },
  mapPlaceholderSub: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  mapTitle: { ...typography.h3 },
  mapCoords: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  openInMaps: {
    ...typography.bodySm,
    color: colors.accent,
    fontWeight: '700',
  },
});
