// CharterMap — the map on the charter ops page. Plots the org's
// operating spots + a single harbor marker, centered on the home
// harbor (falls back to a Hawaii overview when none is set).
//
// Hovering the harbor marker opens a popup listing the vessels docked
// there (tap on touch). Data is read live from charter_accounts/{orgId}
// (fleet + harbors) and its spots subcollection — nothing hardcoded.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from '../components/maps/KaiCastMap';
import { useCharterAccount, useCharterSpots } from './useCharterData';
import type { CharterAccount, OrgHarbor } from './types';

// Dark base per the charter spec (#161616 land / #0A0A0A water); pins
// use the KaiCast accent. Harbor pin is amber so it reads apart from
// the accent-blue operating-spot pins.
const LAND_COLOR = '#161616';
const WATER_COLOR = '#0A0A0A';
const SPOT_COLOR = colors.accent; // #09A1FB
const HARBOR_COLOR = '#FFB020';
const HARBOR_ZOOM = 11.5;

/** Home/both harbor first, else first harbor, else legacy homeHarbor. */
function pickHarbor(account: CharterAccount | null): OrgHarbor | null {
  if (!account) return null;
  const valid = account.harbors.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
  const home = valid.find((h) => h.role === 'home' || h.role === 'both');
  if (home) return home;
  if (valid.length > 0) return valid[0];
  const hh = account.homeHarbor;
  if (hh && Number.isFinite(hh.lat) && Number.isFinite(hh.lng) && (hh.lat !== 0 || hh.lng !== 0)) {
    return { harborId: 'home', name: hh.name, lat: hh.lat, lng: hh.lng, role: 'home', vesselIds: [], notes: null };
  }
  return null;
}

/** Bounding box `[[swLng, swLat], [neLng, neLat]]` enclosing every marker.
 *  Returns undefined when there's fewer than two distinct points to frame
 *  (a single point can't define a box — the caller centers instead). */
function boundsOf(markers: MapMarker[]): [[number, number], [number, number]] | undefined {
  const pts = markers.filter((m) => Number.isFinite(m.lng) && Number.isFinite(m.lat));
  if (pts.length < 2) return undefined;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const p of pts) {
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
  }
  // All points coincident → no box.
  if (minLng === maxLng && minLat === maxLat) return undefined;
  return [[minLng, minLat], [maxLng, maxLat]];
}

function vesselNamesFor(account: CharterAccount | null, harbor: OrgHarbor | null): string[] {
  if (!account || !harbor) return [];
  if (harbor.vesselIds.length === 0) return account.fleet.map((v) => v.name);
  const byId = new Map(account.fleet.map((v) => [v.vesselId, v.name]));
  return harbor.vesselIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
}

export function CharterMap({ orgId, height = 360 }: { orgId: string | null | undefined; height?: number }) {
  const { account } = useCharterAccount(orgId);
  const { spots } = useCharterSpots(orgId);

  const harbor = useMemo(() => pickHarbor(account), [account]);
  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = spots
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ id: `spot_${s.id}`, lng: s.lng, lat: s.lat, color: SPOT_COLOR, label: s.name }));
    if (harbor) {
      const vessels = vesselNamesFor(account, harbor);
      out.push({
        id: 'harbor',
        lng: harbor.lng,
        lat: harbor.lat,
        color: HARBOR_COLOR,
        label: harbor.name,
        popupTitle: harbor.name,
        popupLines: vessels.length > 0 ? vessels : ['No vessels recorded'],
      });
    }
    return out;
  }, [spots, harbor, account]);

  // Fit the viewport to the whole operating area (spots + harbor) when
  // there are at least two distinct points to frame; otherwise center on
  // the harbor, falling back to the Hawaii overview. The company doc has
  // no operating-area polygon, so per the spec we derive bounds from the
  // spots themselves.
  const bounds = useMemo(() => boundsOf(markers), [markers]);
  const center: [number, number] = harbor ? [harbor.lng, harbor.lat] : HAWAII_CENTER;
  const zoom = harbor ? HARBOR_ZOOM : HAWAII_ZOOM;

  return (
    <View style={[styles.wrap, { height }]}>
      <KaiCastMap
        markers={markers}
        center={center}
        zoom={zoom}
        bounds={bounds}
        landColor={LAND_COLOR}
        waterColor={WATER_COLOR}
        showZoomControls
      />
      <View style={styles.legend} pointerEvents="none">
        <Legend color={SPOT_COLOR} label="Operating spots" />
        <Legend color={HARBOR_COLOR} label="Harbor" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    gap: 4,
    backgroundColor: 'rgba(10,10,10,0.6)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 999, borderWidth: 1, borderColor: '#fff' },
  legendText: { fontFamily: fonts.mono, fontSize: 10, color: '#F8F8F8', letterSpacing: 0.5 },
});
