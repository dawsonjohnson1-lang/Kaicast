import React, { useMemo, useState } from 'react';
import { Platform, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing, typography } from '@/theme';
import { mapboxSatelliteUrl, satelliteUrl, projectLatLonToImage, fitPointsToViewport } from '@/api/satellite';
import {
  KAICAST_MAP_STYLE,
  HAWAII_CENTER,
  HAWAII_ZOOM,
  SPOT_FOCUS_ZOOM,
  MARKER_RADIUS_UNSELECTED,
  MARKER_RADIUS_SELECTED,
  MARKER_STROKE_WIDTH,
  MARKER_STROKE_COLOR,
  HALO_RADIUS,
  HALO_OPACITY,
  MAP_LAYER_OVERRIDES,
  spotsToGeoJSON,
} from '@/theme/mapStyle';
import type { Spot } from '@/types';

// Pixel-grid clustering radius. Pins whose projected screen positions
// fall in the same NxN cell merge into a single numbered cluster.
// 60px is roughly two-pin-widths apart at current pin sizing — close
// enough to feel clustered, far enough that genuinely-distinct spots
// stay separate.
const CLUSTER_GRID_PX = 60;

// Bottom sheet on Explore opens to 55% by default — the static map
// auto-fits spots into the top 45% so the cluster doesn't end up
// hidden behind the sheet.
const SHEET_COVER_FRAC = 0.55;

// Lazy require @rnmapbox/maps so a top-level import doesn't crash on
// bundle load in Expo Go (its native bridge throws "@rnmapbox/maps native
// code not available" the moment RNMBXModule.ts evaluates). The render-time
// `useMapbox` guard then routes to FauxMap.
let Mapbox: any = null;
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
    Mapbox = mod.default;
    MapView = mod.MapView;
    Camera = mod.Camera;
    // FillLayer / LineLayer / SymbolLayer / BackgroundLayer with
    // `existing` lets us repaint dark-v11's existing layers in place
    // (water, roads, labels, land). Desktop achieves the same via
    // `map.setPaintProperty(...)`; rnmapbox v10 doesn't expose that
    // cleanly, but `existing={true}` patches the loaded style's
    // matching layer. See MAP_LAYER_OVERRIDES in theme/mapStyle.ts
    // for the full list — mirrors desktop's STYLE_OVERRIDES.
    FillLayer = mod.FillLayer;
    LineLayer = mod.LineLayer;
    SymbolLayer = mod.SymbolLayer;
    BackgroundLayer = mod.BackgroundLayer;
    // ShapeSource + CircleLayer is the GeoJSON-driven rendering path —
    // way more reliable than PointAnnotation, which has known re-render
    // bugs when child styling (selected state) changes. Style expressions
    // also let selection + tier color flow from feature properties.
    ShapeSource = mod.ShapeSource;
    CircleLayer = mod.CircleLayer;
  }
} catch {
  // Native module not linked (Expo Go) — fall back to FauxMap.
}

// Inlined at bundle time from app/.env (gitignored). EXPO_PUBLIC_* vars
// are exposed to the JS bundle automatically — the token never goes into
// app.config.js or git history.
const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const hasValidToken = token.length > 30 && !token.includes('REPLACE_ME');
const useMapbox = Platform.OS !== 'web' && hasValidToken && MapView != null;

if (Mapbox && useMapbox) {
  try {
    Mapbox.setAccessToken(token);
  } catch {
    // Defensive: if setAccessToken itself throws, FauxMap still renders.
  }
}

type SpotMapProps = {
  spots: Spot[];
  /** Currently-selected spot id. Marker grows + gets a halo ring. */
  selectedSpotId?: string | null;
  /** Fires when a marker is tapped. Parent typically selects + centers. */
  onSpotPress?: (spot: Spot) => void;
  /** Fires when an empty area of the map is tapped — used to deselect. */
  onMapPress?: () => void;
  /**
   * Legacy cluster-tap handler from the old static-image FauxMap. The
   * live Mapbox surface doesn't cluster (it pans/zooms), so this only
   * fires on the FauxMap fallback path.
   */
  onClusterPress?: (spots: Spot[]) => void;
};

export function SpotMap({
  spots,
  selectedSpotId,
  onSpotPress,
  onMapPress,
  onClusterPress,
}: SpotMapProps) {
  if (!useMapbox) return <FauxMap spots={spots} onSpotPress={onSpotPress} onClusterPress={onClusterPress} />;

  // Camera follows the selected spot — pan/zoom to spot-focus when
  // selected, archipelago overview otherwise. Mirrors desktop's
  // MapColumn behavior in SpotsMapScreen.tsx.
  const selected = selectedSpotId ? spots.find((s) => s.id === selectedSpotId) : null;
  const center: [number, number] = selected ? [selected.lon, selected.lat] : HAWAII_CENTER;
  const zoom = selected ? SPOT_FOCUS_ZOOM : HAWAII_ZOOM;

  const geojson = useMemo(() => spotsToGeoJSON(spots), [spots]);
  const spotsById = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  // Selected-id passed into Mapbox layer style expressions. We coerce
  // null/undefined to an empty string so the `==` comparison in the
  // expression has a stable type (Mapbox expressions don't tolerate
  // null in equality cleanly).
  const selectedExprValue = selectedSpotId ?? '';

  const onShapePress = (e: any) => {
    const feature = e?.features?.[0];
    const id = feature?.properties?.id as string | undefined;
    if (!id) return;
    const spot = spotsById.get(id);
    if (spot && onSpotPress) onSpotPress(spot);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={KAICAST_MAP_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        // Mobile parity with desktop: pan + pinch-zoom only. No
        // rotate/pitch — diving conditions are a 2D problem and
        // pitch+rotate were giving people accidental 3D views.
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={() => onMapPress?.()}
      >
        <Camera
          centerCoordinate={center}
          zoomLevel={zoom}
          animationMode="easeTo"
          animationDuration={600}
        />

        {/* Dark-v11 layer recoloring — repaints land / roads / labels
            to the KaiCast surface palette so the map blends seamlessly
            into the surrounding UI. Mirrors desktop's STYLE_OVERRIDES
            applied in KaiCastMap.tsx via setPaintProperty. `existing`
            tells rnmapbox to patch the loaded style layer in place
            rather than creating a new one. Missing layers (Mapbox
            occasionally renames things between style versions) are
            silently no-ops, matching desktop's try/catch. */}
        {FillLayer ? (
          <FillLayer id="water" existing style={{ fillColor: colors.bg }} />
        ) : null}
        {MAP_LAYER_OVERRIDES.map((o) => {
          if (o.kind === 'background' && BackgroundLayer) {
            return (
              <BackgroundLayer
                key={o.id}
                id={o.id}
                existing
                style={{ backgroundColor: o.color }}
              />
            );
          }
          if (o.kind === 'fill' && FillLayer) {
            return (
              <FillLayer
                key={o.id}
                id={o.id}
                existing
                style={{ fillColor: o.color }}
              />
            );
          }
          if (o.kind === 'line' && LineLayer) {
            return (
              <LineLayer
                key={o.id}
                id={o.id}
                existing
                style={{ lineColor: o.color }}
              />
            );
          }
          if (o.kind === 'symbol' && SymbolLayer) {
            return (
              <SymbolLayer
                key={o.id}
                id={o.id}
                existing
                style={{ textColor: o.color }}
              />
            );
          }
          return null;
        })}

        <ShapeSource id="kaicast-spots" shape={geojson} onPress={onShapePress}>
          {/* Halo: rendered first so the marker circle sits on top.
              Mapbox renders sibling CircleLayers in document order,
              earlier = beneath. Opacity is 0 except for the selected
              feature, where it goes to HALO_OPACITY. */}
          <CircleLayer
            id="kaicast-spots-halo"
            style={{
              circleColor: ['get', 'color'],
              circleRadius: HALO_RADIUS,
              circleOpacity: [
                'case',
                ['==', ['get', 'id'], selectedExprValue],
                HALO_OPACITY,
                0,
              ],
              circlePitchAlignment: 'map',
            }}
          />
          <CircleLayer
            id="kaicast-spots-circles"
            style={{
              circleColor: ['get', 'color'],
              circleRadius: [
                'case',
                ['==', ['get', 'id'], selectedExprValue],
                MARKER_RADIUS_SELECTED,
                MARKER_RADIUS_UNSELECTED,
              ],
              circleStrokeColor: MARKER_STROKE_COLOR,
              circleStrokeWidth: MARKER_STROKE_WIDTH,
              circlePitchAlignment: 'map',
            }}
          />
        </ShapeSource>
      </MapView>
    </View>
  );
}

// Light vignette to tone the bright tropical greens / sand without
// burying the satellite imagery. Center is essentially clear so the
// island is plainly visible; edges get a soft navy fade.
function NightOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,12,24,0.15)' }]} />
      <LinearGradient
        colors={['rgba(2,8,18,0.25)', 'rgba(2,8,18,0.0)', 'rgba(2,8,18,0.25)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

type FauxMapProps = {
  spots?: Spot[];
  onSpotPress?: (spot: Spot) => void;
  onClusterPress?: (spots: Spot[]) => void;
};

// Static satellite via ESRI World Imagery with absolute-positioned
// pins. Not interactive (no pan/zoom) — Mapbox only loads in a custom
// dev client. The viewport is auto-fit to the spots so the cluster
// always lands in the top portion of the screen, above the bottom
// sheet that covers the lower half.
export function FauxMap({ spots = [], onSpotPress, onClusterPress }: FauxMapProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const viewport = size
    ? fitPointsToViewport(
        spots.map((s) => ({ lat: s.lat, lon: s.lon })),
        size.w,
        size.h,
        SHEET_COVER_FRAC,
      )
    : null;

  // Mapbox satellite imagery (Maxar) when the public token is set,
  // ESRI satellite as a fallback. The night-tint overlay below dims
  // both into the dark gradient look the design calls for.
  const tileUri =
    size && viewport
      ? mapboxSatelliteUrl(viewport.centerLat, viewport.centerLon, size.w, size.h, viewport.zoom) ??
        satelliteUrl(viewport.centerLat, viewport.centerLon, size.w, size.h, viewport.zoom)
      : null;

  return (
    <View
      style={mapStyles.wrap}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: Math.round(width), h: Math.round(height) });
      }}
    >
      {tileUri && viewport ? (
        <>
          <Image source={{ uri: tileUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <NightOverlay />
          {size && (
            <ClusteredPins
              spots={spots}
              size={size}
              viewport={viewport}
              onSpotPress={onSpotPress}
              onClusterPress={onClusterPress}
            />
          )}
        </>
      ) : (
        <SvgFallback />
      )}
    </View>
  );
}

// Project every spot to pixel space, bucket into a square pixel grid,
// and render each non-empty bucket as either a single pin (1 spot)
// or a numbered cluster badge (2+ spots). Tap behavior:
//   - 1 spot   → onSpotPress(spot)
//   - 2+ spots → onClusterPress(spots)  ← parent typically focuses
//                the map onto just those spots so they spread apart
//
// Pure, deterministic, O(n) — recomputes whenever viewport or spots
// change. Bucket centroid is the average of contained pin pixel
// coords so the cluster badge sits over the visual cluster.
function ClusteredPins({
  spots,
  size,
  viewport,
  onSpotPress,
  onClusterPress,
}: {
  spots: Spot[];
  size: { w: number; h: number };
  viewport: { centerLat: number; centerLon: number; zoom: number };
  onSpotPress?: (spot: Spot) => void;
  onClusterPress?: (spots: Spot[]) => void;
}) {
  const clusters = useMemo(() => {
    type Bucket = { sumX: number; sumY: number; spots: Spot[] };
    const buckets = new Map<string, Bucket>();
    for (const s of spots) {
      const { x, y } = projectLatLonToImage(
        s.lat, s.lon,
        viewport.centerLat, viewport.centerLon, viewport.zoom,
        size.w, size.h,
      );
      // Cull pins well outside the visible area so off-island stragglers
      // don't waste a cluster bucket.
      if (x < -40 || y < -40 || x > size.w + 40 || y > size.h + 40) continue;
      const key = `${Math.floor(x / CLUSTER_GRID_PX)}_${Math.floor(y / CLUSTER_GRID_PX)}`;
      let b = buckets.get(key);
      if (!b) { b = { sumX: 0, sumY: 0, spots: [] }; buckets.set(key, b); }
      b.sumX += x; b.sumY += y; b.spots.push(s);
    }
    return [...buckets.values()].map((b) => ({
      x: b.sumX / b.spots.length,
      y: b.sumY / b.spots.length,
      spots: b.spots,
    }));
  }, [spots, size.w, size.h, viewport.centerLat, viewport.centerLon, viewport.zoom]);

  return (
    <>
      {clusters.map((c, i) => {
        if (c.spots.length === 1) {
          const s = c.spots[0];
          return (
            <Pressable
              key={s.id}
              onPress={() => onSpotPress?.(s)}
              hitSlop={12}
              style={{ position: 'absolute', left: c.x - 12, top: c.y - 12 }}
            >
              <View style={pinStyles.halo}>
                <View style={pinStyles.outer}>
                  <View style={pinStyles.inner} />
                </View>
              </View>
            </Pressable>
          );
        }
        // 2+ spots — numbered cluster badge.
        return (
          <Pressable
            key={`cluster-${i}`}
            onPress={() => onClusterPress?.(c.spots)}
            hitSlop={10}
            style={{ position: 'absolute', left: c.x - 18, top: c.y - 18 }}
          >
            <View style={pinStyles.clusterHalo}>
              <View style={pinStyles.cluster}>
                <Text style={pinStyles.clusterText}>{c.spots.length}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

// Final fallback: rendered before `onLayout` fires (size still null) or
// if `satelliteUrl` ever returns null. Same SVG sketch as before.
function SvgFallback() {
  return (
    <>
      <Svg width="100%" height="100%" viewBox="0 0 400 380">
        {Array.from({ length: 8 }).map((_, i) => (
          <Path
            key={i}
            d={`M 0 ${30 + i * 45} L 400 ${30 + i * 45}`}
            stroke="#0e1a2c"
            strokeDasharray="2,4"
            strokeWidth={1}
          />
        ))}
        <Path d="M 80 230 q 10 -25 35 -20 q 25 5 30 20 q 10 25 -10 25 q -25 5 -55 -25 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Path d="M 175 245 q 15 -20 50 -10 q 35 5 30 25 q -10 20 -50 15 q -40 -5 -30 -30 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Path d="M 235 265 q 25 -10 65 -5 q 40 5 50 25 q 5 25 -45 30 q -50 0 -75 -25 q -10 -15 5 -25 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Circle cx="195" cy="245" r="14" fill={colors.accent} fillOpacity={0.18} />
        <Circle cx="195" cy="245" r="8" fill={colors.accent} />
        <Circle cx="195" cy="245" r="4" fill="#fff" />
      </Svg>
      <Text style={mapStyles.label1}>Tropic of Cancer</Text>
      <Text style={mapStyles.label2}>HAWAIIAN TROUGH</Text>
      <Text style={mapStyles.island1}>Ni'ihau</Text>
      <Text style={mapStyles.island2}>O'ahu</Text>
      <Text style={mapStyles.island3}>Moloka'i</Text>
      <Text style={mapStyles.island4}>Lana'i</Text>
      <Text style={mapStyles.island5}>Maui</Text>
      <Text style={mapStyles.maps}>Maps · Legal</Text>
    </>
  );
}

const pinStyles = StyleSheet.create({
  halo: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(9,161,251,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outer: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  inner: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  clusterHalo: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(9,161,251,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cluster: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: {
    ...typography.bodySm,
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 14,
  },
});

const mapStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label1: { position: 'absolute', top: 90, left: 60, color: colors.textDim, fontSize: 11, letterSpacing: 1 },
  label2: { position: 'absolute', top: 150, left: 110, color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  island1: { position: 'absolute', top: 230, left: 30, color: colors.textSecondary, fontSize: 10 },
  island2: { position: 'absolute', top: 268, left: 175, color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  island3: { position: 'absolute', top: 248, left: 270, color: colors.textSecondary, fontSize: 10 },
  island4: { position: 'absolute', top: 290, left: 270, color: colors.textSecondary, fontSize: 10 },
  island5: { position: 'absolute', top: 280, left: 330, color: colors.textSecondary, fontSize: 10 },
  maps: { position: 'absolute', bottom: 40, left: spacing.lg, color: colors.textDim, fontSize: 10 },
});
