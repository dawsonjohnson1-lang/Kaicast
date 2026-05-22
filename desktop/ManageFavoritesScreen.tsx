/**
 * Manage Favorites — desktop screen.
 *
 * Lists every spot the user has favorited (via the shared useFavorites
 * hook), sorted closest-first using browser geolocation. Each row
 * shows the spot's name, region + distance, current condition tier
 * (from getReport), and inline buttons to either jump to the spot's
 * detail page or remove it from favorites.
 *
 * Empty state surfaces a clear "no favorites yet" pitch with a CTA
 * to the spots map so the user can pick some.
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
  TIER_COLORS,
  type ConditionTier,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { ConditionPill } from './components/ConditionPill';
import { useFavorites } from './hooks/useFavorites';
import { useUserLocation, distanceMiles } from './hooks/useUserLocation';
import { useSpotRatings } from './data/getReport';
import { findSpot as findCanonicalSpot } from './data/spots';
import type { NavigateFn } from './router';

export interface ManageFavoritesScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function ManageFavoritesScreen({
  activeNav = 'dashboard',
  onNavigate,
}: ManageFavoritesScreenProps) {
  const favs = useFavorites();
  const loc = useUserLocation();

  // Pull live tier per spot in one bulk call — useSpotRatings is
  // already cached per-spotId so it doesn't refire on re-render.
  const allIds = React.useMemo(() => [...favs.ids], [favs.ids]);
  const ratings = useSpotRatings(allIds);

  // Project to display rows + sort by distance (closest first).
  type Row = {
    id: string;
    name: string;
    region: string;
    rating: ConditionTier;
    dist: number;
  };
  const rows: Row[] = React.useMemo(() => {
    const list: Row[] = allIds
      .map((id) => {
        const spot = findCanonicalSpot(id);
        if (!spot) return null;
        return {
          id,
          name: spot.name,
          region: spot.region,
          rating: ratings.get(id) ?? ('good' as ConditionTier),
          dist: distanceMiles(loc.lat, loc.lon, spot.lat, spot.lon),
        } satisfies Row;
      })
      .filter((r): r is Row => r !== null);
    list.sort((a, b) => a.dist - b.dist);
    return list;
  }, [allIds, ratings, loc.lat, loc.lon]);

  const empty = rows.length === 0;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Favorites</Text>
            <Text style={styles.subtitle}>
              {empty
                ? 'You haven’t favorited any spots yet.'
                : `${rows.length} ${rows.length === 1 ? 'spot' : 'spots'} · ${
                    loc.isFallback
                      ? 'closest first (using Honolulu as default)'
                      : 'closest first'
                  }`}
            </Text>
          </View>
          <Pressable
            style={styles.findBtn}
            onPress={() => onNavigate?.('spots-map')}
          >
            <Text style={styles.findBtnText}>+ Add favorites</Text>
          </Pressable>
        </View>

        {empty ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Save your favorite dive spots</Text>
            <Text style={styles.emptyBody}>
              Tap the heart on any spot to pin it here. Favorited spots show up on your
              dashboard sorted by distance, and you’ll get conditions updates pushed
              to your home view first.
            </Text>
            <Pressable
              style={styles.emptyCta}
              onPress={() => onNavigate?.('spots-map')}
            >
              <Text style={styles.emptyCtaText}>Browse spots →</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.rowsWrap}>
            {rows.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[r.rating] }]} />
                <Pressable
                  style={styles.rowMain}
                  onPress={() => onNavigate?.('spot-detail', { spotId: r.id })}
                >
                  <Text style={styles.rowName}>{r.name}</Text>
                  <Text style={styles.rowMeta}>
                    {r.region} · {Math.round(r.dist)} mi
                    {loc.isFallback ? ' (approx)' : ''}
                  </Text>
                </Pressable>
                <ConditionPill tier={r.rating} size="md" />
                <Pressable
                  style={styles.openBtn}
                  onPress={() => onNavigate?.('spot-detail', { spotId: r.id })}
                >
                  <Text style={styles.openBtnText}>Open</Text>
                </Pressable>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => favs.remove(r.id)}
                  accessibilityLabel={`Remove ${r.name} from favorites`}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 24,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    marginTop: 4,
  },
  findBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  findBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: '#04070d',
  },

  rowsWrap: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface0,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  openBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  openBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
  },
  removeBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text2,
    lineHeight: 16,
  },

  emptyBox: {
    padding: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface0,
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 19,
    maxWidth: 520,
  },
  emptyCta: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  emptyCtaText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: '#04070d',
  },
});
