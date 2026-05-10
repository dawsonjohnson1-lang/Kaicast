import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { Icon } from '@/components/Icon';
import { SpotMap } from '@/components/Map';
import { satelliteUrl } from '@/api/satellite';
import { colors, radius, spacing, typography, RATING_COLORS, RATING_LABELS } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSpots } from '@/hooks/useSpots';
import type { RootNav } from '@/navigation/types';
import type { Spot } from '@/types';

type Filter = 'Dive Spots' | 'Favorite Spots';
const FILTERS: Filter[] = ['Dive Spots', 'Favorite Spots'];
const SNAP_POINTS = ['10%', '55%'];

// Haversine great-circle distance between two lat/lon points in miles.
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type ExploreSpot = Spot & { distMi?: number };

export function ExploreScreen() {
  const nav = useNavigation<RootNav>();
  const { user } = useAuth();
  const { spots: allSpots } = useSpots();
  const [filter, setFilter] = useState<Filter>('Dive Spots');
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  // When the user taps a cluster badge, focus the map on just those
  // spot ids — re-fits the viewport to that subset so they spread
  // apart visually. Null means "show every spot".
  const [focusedIds, setFocusedIds] = useState<string[] | null>(null);
  const sheetRef = useRef<BottomSheet>(null);
  // Sheet's top-edge Y position (px from screen top). Tracks the sheet
  // through drag gestures and snap animations so the FAB above it can
  // ride along instead of staying pinned to a static % of viewport.
  const sheetTopY = useSharedValue(0);
  const fabAnimStyle = useAnimatedStyle(() => ({
    // FAB sits 16 px above the sheet's top edge; translateY targets
    // the FAB's top so the bottom lands sheetTopY - 16.
    transform: [{ translateY: sheetTopY.value - 60 }],
  }));
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch {
        // Permission denied or location unavailable — list stays unsorted, no distance shown.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sortedSpots: ExploreSpot[] = useMemo(() => {
    if (!origin) return allSpots;
    return [...allSpots]
      .map((s) => ({ ...s, distMi: distanceMiles(origin.lat, origin.lon, s.lat, s.lon) }))
      .sort((a, b) => (a.distMi ?? 0) - (b.distMi ?? 0));
  }, [origin, allSpots]);

  // Spots actually drawn on the map — full set or the focused subset.
  const mapSpots = useMemo(() => {
    if (!focusedIds) return allSpots;
    const ids = new Set(focusedIds);
    return allSpots.filter((s) => ids.has(s.id));
  }, [allSpots, focusedIds]);

  // FAB actions: focus on closest 5 spots to the user, reset, expand list.
  const onLocateMe = () => {
    if (!origin) return;
    const NEAR_COUNT = 5;
    const ids = [...allSpots]
      .map((s) => ({ id: s.id, d: distanceMiles(origin.lat, origin.lon, s.lat, s.lon) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEAR_COUNT)
      .map((x) => x.id);
    if (ids.length) setFocusedIds(ids);
  };
  const onShowAll = () => setFocusedIds(null);

  return (
    <Screen scroll={false} padding={0}>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#04111e', '#062138', '#04111e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SpotMap
          spots={mapSpots}
          onSpotPress={(spot) => nav.navigate('SpotDetail', { spotId: spot.id })}
          onClusterPress={(clusterSpots) => setFocusedIds(clusterSpots.map((s) => s.id))}
        />
        <View style={styles.appBarPad} pointerEvents="box-none">
          <AppBar userName={(user?.name ?? 'Diver').toUpperCase()} initials={initials} />
        </View>
        <Animated.View style={[styles.locateFabWrap, fabAnimStyle]} pointerEvents="box-none">
          <Pressable
            style={styles.fab}
            onPress={onLocateMe}
            disabled={!origin}
            accessibilityLabel="Show spots nearest to me"
          >
            <Icon name="compass-arrow" size={18} color={origin ? colors.accent : colors.textMuted} />
          </Pressable>
        </Animated.View>
        {focusedIds && (
          <Pressable style={styles.allSpotsPill} onPress={() => setFocusedIds(null)}>
            <Icon name="chevron-left" size={14} color="#fff" />
            <Text style={styles.allSpotsText}>All spots</Text>
          </Pressable>
        )}
      </View>

      <BottomSheet
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        index={1}
        animatedPosition={sheetTopY}
        backgroundStyle={{ backgroundColor: colors.bgElevated }}
        handleIndicatorStyle={{ backgroundColor: colors.border, width: 48, height: 4 }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
        >
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterPill, filter === f && styles.filterPillActive]}>
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>Move map to find dive spots, buoys, and conditions near you.</Text>
          {sortedSpots.map((s) => {
            const rating = s.rating ?? 'good';
            const ratingColor = RATING_COLORS[rating];
            const ratingLabel = RATING_LABELS[rating];
            const distLabel = s.distMi != null ? `${s.distMi.toFixed(1)} mi` : null;
            const tileUri = satelliteUrl(s.lat, s.lon, 96, 96, 16);
            return (
              <Pressable key={s.id} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} style={styles.row}>
                <Image
                  source={tileUri ? { uri: tileUri } : undefined}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{s.name}</Text>
                  {distLabel && <Text style={styles.dist}>{distLabel}</Text>}
                  <Text style={styles.region}>{s.region} · {s.visibilityFt} ft vis</Text>
                </View>
                <View style={[styles.ratingPill, { borderColor: ratingColor }]}>
                  <View style={[styles.ratingPillDot, { backgroundColor: ratingColor }]} />
                  <Text style={[styles.ratingPillText, { color: ratingColor }]}>{ratingLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  appBarPad: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  fabs: { position: 'absolute', right: spacing.xl, bottom: '60%', gap: spacing.sm },
  locateFabWrap: {
    position: 'absolute',
    top: 0,
    right: spacing.xl,
  },
  allSpotsPill: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 24, 36, 0.92)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  allSpotsText: { ...typography.bodySm, color: '#fff', fontWeight: '700' },
  fab: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: colors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, paddingTop: spacing.sm },
  filterPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'transparent' },
  filterPillActive: { backgroundColor: colors.accentSoft },
  filterText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.accent },
  helper: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
  },
  region: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  dist: { ...typography.bodySm, color: colors.accent, fontWeight: '600', marginTop: 2 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  ratingPillDot: { width: 6, height: 6, borderRadius: 999 },
  ratingPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});
