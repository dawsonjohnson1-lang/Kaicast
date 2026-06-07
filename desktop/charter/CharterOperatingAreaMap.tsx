// CharterOperatingAreaMap — the org-scoped operating-area map for the
// Charter dashboard. Two marker layers on one shared KaiCastMap:
//
//   1. Saved spots (the org's private spot library) → condition-colored
//      dots, tier pulled from the linked public spot's live forecast.
//   2. Vessel home berths → accent anchor pins, sourced from the org's
//      harbors (role 'home'/'both') and labeled with the vessel names
//      that berth there. These read as a clearly different *kind* of
//      thing from the condition dots (see KaiCastMap's boat marker).
//
// Everything is scoped to the active org: spots via useCharterSpots,
// fleet + harbors via useCharterAccount. The map frames both layers
// together (fitToMarkers), so the viewport always contains the spots
// AND the berths.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius, TIER_COLORS, TIER_LABELS, type ConditionTier } from '../tokens';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from '../components/maps/KaiCastMap';
import { useSpotRatings } from '../data/getReport';
import { useCharterSpots, useCharterAccount } from './useCharterData';
import type { NavigateFn } from '../router';

const BOAT_PREFIX = 'boat:';

/** A point is "real" when it has finite, non-(0,0) coordinates. Skips
 *  un-geocoded spots / harbors so they don't drop a pin in the Gulf of
 *  Guinea or crash the bounds fit. */
function hasRealCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

export interface CharterOperatingAreaMapProps {
  orgId: string | null | undefined;
  /** Bound height of the map surface. Width fills the parent. */
  height?: number;
  onNavigate?: NavigateFn;
}

export function CharterOperatingAreaMap({
  orgId,
  height = 360,
  onNavigate,
}: CharterOperatingAreaMapProps) {
  const { spots } = useCharterSpots(orgId);
  const { account } = useCharterAccount(orgId);

  // Tier coloring: only spots linked to a public KaiCast spot have a
  // live forecast. Gather those ids and read their ratings; unlinked
  // private spots fall back to a neutral dot.
  const linkedIds = React.useMemo(
    () => spots.map((s) => s.linkedPublicSpotId).filter((id): id is string => !!id),
    [spots],
  );
  const ratings = useSpotRatings(linkedIds);

  const spotMarkers: MapMarker[] = React.useMemo(
    () =>
      spots
        .filter((s) => hasRealCoords(s.lat, s.lng))
        .map((s) => ({
          id: s.id,
          lng: s.lng,
          lat: s.lat,
          tier: s.linkedPublicSpotId ? ratings.get(s.linkedPublicSpotId) : undefined,
          label: s.name,
          kind: 'spot' as const,
        })),
    [spots, ratings],
  );

  // Boat berths: org harbors where the boat is stored ('home'/'both'),
  // labeled with the vessel name(s) that operate from there. A harbor
  // with no usable coords is skipped entirely (no crash, no 0,0 pin).
  const boatMarkers: MapMarker[] = React.useMemo(() => {
    const fleet = account?.fleet ?? [];
    const harbors = account?.harbors ?? [];
    return harbors
      .filter((h) => (h.role === 'home' || h.role === 'both') && hasRealCoords(h.lat, h.lng))
      .map((h) => {
        const names = h.vesselIds
          .map((vid) => fleet.find((v) => v.vesselId === vid)?.name)
          .filter((n): n is string => !!n);
        const vesselLabel = names.length > 0 ? names.join(', ') : 'Vessel';
        return {
          id: `${BOAT_PREFIX}${h.harborId}`,
          lng: h.lng,
          lat: h.lat,
          label: `${vesselLabel} · ${h.name}`,
          kind: 'boat' as const,
        };
      });
  }, [account]);

  const markers = React.useMemo(
    () => [...spotMarkers, ...boatMarkers],
    [spotMarkers, boatMarkers],
  );

  // Selection drives the caption strip below the map. Clicking a boat
  // pin shows its vessel + harbor; clicking a linked spot opens its
  // public forecast (unlinked spots just select).
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);

  const handleMarkerClick = React.useCallback(
    (id: string) => {
      if (id.startsWith(BOAT_PREFIX)) {
        setSelectedId((cur) => (cur === id ? undefined : id));
        return;
      }
      const spot = spots.find((s) => s.id === id);
      if (spot?.linkedPublicSpotId) {
        onNavigate?.('spot-detail', { spotId: spot.linkedPublicSpotId });
        return;
      }
      setSelectedId((cur) => (cur === id ? undefined : id));
    },
    [spots, onNavigate],
  );

  const selectedCaption = React.useMemo(() => {
    if (!selectedId) return null;
    return markers.find((m) => m.id === selectedId)?.label ?? null;
  }, [selectedId, markers]);

  // Tier counts for the legend strip (only spots carry a tier).
  const counts = React.useMemo(() => {
    const c: Record<ConditionTier, number> = {
      excellent: 0, great: 0, good: 0, fair: 0, 'no-go': 0,
    };
    for (const m of spotMarkers) if (m.tier) c[m.tier]++;
    return c;
  }, [spotMarkers]);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>Operating area</Text>
        <Text style={styles.subtitle}>
          Your saved spots, colored by today's conditions, plus where the fleet is berthed.
        </Text>
      </View>

      <View style={[styles.mapWrap, { height }]}>
        <KaiCastMap
          markers={markers}
          center={HAWAII_CENTER}
          zoom={HAWAII_ZOOM}
          fitToMarkers
          selectedId={selectedId}
          onMarkerClick={handleMarkerClick}
          showZoomControls={false}
          interactive
          style={{ width: '100%', height: '100%', borderRadius: radius.md }}
        />
      </View>

      {/* Legend: boat pin first (the new layer), then condition tiers. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendBoat}>
            <Text style={styles.legendBoatGlyph}>⚓</Text>
          </View>
          <Text style={styles.legendLabel}>Home berth</Text>
        </View>
        <View style={styles.legendDivider} />
        {(['excellent', 'great', 'good', 'fair', 'no-go'] as ConditionTier[]).map((t) => (
          <View key={t} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: TIER_COLORS[t] }]} />
            <Text style={styles.legendCount}>{counts[t]}</Text>
            <Text style={styles.legendLabel}>{TIER_LABELS[t]}</Text>
          </View>
        ))}
        <View style={styles.legendSpacer} />
        <Text style={styles.legendHint}>
          {selectedCaption ?? 'Click a boat for its berth · a spot for its forecast'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  head: { gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.text1 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },
  mapWrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDivider: { width: 1, height: 14, backgroundColor: colors.hairlineStrong },
  legendDot: { width: 8, height: 8, borderRadius: 999 },
  legendBoat: {
    width: 16,
    height: 16,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBoatGlyph: { fontSize: 9, color: '#ffffff', lineHeight: 12 },
  legendCount: { fontFamily: fonts.mono, fontSize: 11, color: colors.text2, fontWeight: '600' },
  legendLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, letterSpacing: 0.6 },
  legendSpacer: { flex: 1 },
  legendHint: { fontFamily: fonts.body, fontSize: 11, color: colors.text4 },
});
