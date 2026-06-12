// CharterMap (mobile) — the map on the charter page. Plots the org's
// operating spots + a single harbor marker, centered on the harbor
// (falls back to a Hawaii overview when no harbor is set).
//
// Tapping the harbor marker opens a popup card listing the vessels
// docked there — the touch-equivalent of the desktop hover behavior.
// Tapping a spot shows its name. Tapping empty map closes the popup.
//
// Rendering mirrors components/Map.tsx: @rnmapbox/maps is lazy-required
// so Expo Go (no native bridge) degrades to a non-map fallback card
// that still surfaces the harbor + vessel list textually.

import React, { useMemo, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import {
  KAICAST_MAP_STYLE,
  HAWAII_CENTER,
  HAWAII_ZOOM,
  SPOT_FOCUS_ZOOM,
  MAP_LAYER_OVERRIDES,
} from '@/theme/mapStyle';
import {
  harborVesselNames,
  primaryHarbor,
  type CharterAccount,
  type CharterOrgSpot,
} from '@/hooks/useCharterAccount';

// Lazy require @rnmapbox/maps — see components/Map.tsx for why a
// top-level import crashes in Expo Go.
let MapView: any = null;
let Camera: any = null;
let ShapeSource: any = null;
let CircleLayer: any = null;
let FillLayer: any = null;
let LineLayer: any = null;
let SymbolLayer: any = null;
let BackgroundLayer: any = null;
try {
  if (Platform.OS !== 'web') {
    const mod = require('@rnmapbox/maps');
    MapView = mod.MapView;
    Camera = mod.Camera;
    ShapeSource = mod.ShapeSource;
    CircleLayer = mod.CircleLayer;
    FillLayer = mod.FillLayer;
    LineLayer = mod.LineLayer;
    SymbolLayer = mod.SymbolLayer;
    BackgroundLayer = mod.BackgroundLayer;
  }
} catch {
  // Native module not linked (Expo Go) — fall back to the text card.
}

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const hasValidToken = token.length > 30 && !token.includes('REPLACE_ME');
const useMapbox = Platform.OS !== 'web' && hasValidToken && MapView != null;

const SPOT_COLOR = colors.accent;     // operating locations
const HARBOR_COLOR = colors.excellent; // harbor stands out from spots

type SelectedFeature = { kind: 'harbor' | 'spot'; name: string; vessels: string[] };

export function CharterMap({
  account,
  spots,
  height = 320,
}: {
  account: CharterAccount | null;
  spots: CharterOrgSpot[];
  height?: number;
}) {
  const harbor = useMemo(() => primaryHarbor(account), [account]);
  const vesselNames = useMemo(() => harborVesselNames(account, harbor), [account, harbor]);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);

  const center: [number, number] = harbor ? [harbor.lng, harbor.lat] : HAWAII_CENTER;
  const zoom = harbor ? SPOT_FOCUS_ZOOM : HAWAII_ZOOM;

  // Frame the whole operating area (spots + harbor) when there are at
  // least two distinct points; otherwise fall back to centering. The
  // company doc carries no operating-area polygon, so — per the spec —
  // we derive the box from the spots themselves.
  const cameraBounds = useMemo(() => {
    const pts: Array<[number, number]> = spots
      .filter((s) => Number.isFinite(s.lng) && Number.isFinite(s.lat))
      .map((s) => [s.lng, s.lat]);
    if (harbor) pts.push([harbor.lng, harbor.lat]);
    if (pts.length < 2) return null;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
    if (minLng === maxLng && minLat === maxLat) return null;
    return { ne: [maxLng, maxLat] as [number, number], sw: [minLng, minLat] as [number, number] };
  }, [spots, harbor]);

  // One FeatureCollection holds spots + harbor; a per-feature `kind`
  // property drives color/size in the layer style expressions.
  const geojson = useMemo(() => {
    const features: any[] = spots.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { id: s.id, name: s.name, kind: 'spot' },
    }));
    if (harbor) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [harbor.lng, harbor.lat] },
        properties: { id: 'harbor', name: harbor.name, kind: 'harbor' },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [spots, harbor]);

  const onShapePress = (e: any) => {
    const f = e?.features?.[0];
    const kind = f?.properties?.kind as 'harbor' | 'spot' | undefined;
    const name = (f?.properties?.name as string) ?? '';
    if (!kind) return;
    setSelected({ kind, name, vessels: kind === 'harbor' ? vesselNames : [] });
  };

  if (!useMapbox) {
    return (
      <CharterMapFallback
        harbor={harbor ? { name: harbor.name } : null}
        vessels={vesselNames}
        spotCount={spots.length}
        height={height}
      />
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={KAICAST_MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={() => setSelected(null)}
      >
        <Camera
          {...(cameraBounds
            ? { bounds: { ...cameraBounds, paddingLeft: 48, paddingRight: 48, paddingTop: 48, paddingBottom: 48 } }
            : { centerCoordinate: center, zoomLevel: zoom })}
          animationMode="easeTo"
          animationDuration={600}
        />

        {/* Dark-v11 recolor — mirrors components/Map.tsx so the charter
            map blends with the app surface. */}
        {FillLayer ? <FillLayer id="water" existing style={{ fillColor: colors.bg }} /> : null}
        {MAP_LAYER_OVERRIDES.map((o) => {
          if (o.kind === 'background' && BackgroundLayer) {
            return <BackgroundLayer key={o.id} id={o.id} existing style={{ backgroundColor: o.color }} />;
          }
          if (o.kind === 'fill' && FillLayer) {
            return <FillLayer key={o.id} id={o.id} existing style={{ fillColor: o.color }} />;
          }
          if (o.kind === 'line' && LineLayer) {
            return <LineLayer key={o.id} id={o.id} existing style={{ lineColor: o.color }} />;
          }
          if (o.kind === 'symbol' && SymbolLayer) {
            return <SymbolLayer key={o.id} id={o.id} existing style={{ textColor: o.color }} />;
          }
          return null;
        })}

        <ShapeSource id="charter-features" shape={geojson} onPress={onShapePress}>
          <CircleLayer
            id="charter-features-circles"
            style={{
              circleColor: ['case', ['==', ['get', 'kind'], 'harbor'], HARBOR_COLOR, SPOT_COLOR],
              circleRadius: ['case', ['==', ['get', 'kind'], 'harbor'], 9, 6],
              circleStrokeColor: '#FFFFFF',
              circleStrokeWidth: 2,
              circlePitchAlignment: 'map',
            }}
          />
        </ShapeSource>
      </MapView>

      {selected ? (
        <View style={styles.popup} pointerEvents="box-none">
          <View style={styles.popupCard}>
            <Text style={styles.popupKind}>
              {selected.kind === 'harbor' ? 'HARBOR' : 'OPERATING SPOT'}
            </Text>
            <Text style={styles.popupName}>{selected.name}</Text>
            {selected.kind === 'harbor' ? (
              selected.vessels.length > 0 ? (
                <Text style={styles.popupBody}>
                  Vessels: {selected.vessels.join(', ')}
                </Text>
              ) : (
                <Text style={styles.popupBody}>No vessels recorded.</Text>
              )
            ) : null}
            <Pressable onPress={() => setSelected(null)} hitSlop={8} style={styles.popupClose}>
              <Text style={styles.popupCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Non-map fallback (Expo Go / no token) — still surfaces the harbor +
// vessels + spot count textually so the page isn't blank.
function CharterMapFallback({
  harbor,
  vessels,
  spotCount,
  height,
}: {
  harbor: { name: string } | null;
  vessels: string[];
  spotCount: number;
  height: number;
}) {
  return (
    <View style={[styles.wrap, styles.fallback, { height }]}>
      <Text style={styles.fallbackTitle}>{harbor?.name ?? 'No harbor set'}</Text>
      <Text style={styles.fallbackBody}>
        {vessels.length > 0 ? `Vessels: ${vessels.join(', ')}` : 'No vessels recorded'}
      </Text>
      <Text style={styles.fallbackBody}>
        {spotCount} operating {spotCount === 1 ? 'location' : 'locations'}
      </Text>
      <Text style={styles.fallbackHint}>Map preview unavailable on this build.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  popup: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  popupCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  popupKind: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '700',
    fontSize: 10,
  },
  popupName: { ...typography.h3, color: colors.textPrimary },
  popupBody: { ...typography.bodySm, color: colors.textSecondary },
  popupClose: { alignSelf: 'flex-start', marginTop: 4 },
  popupCloseText: { ...typography.bodySm, color: colors.accent, fontWeight: '600' },

  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: spacing.lg,
  },
  fallbackTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  fallbackBody: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
  fallbackHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
