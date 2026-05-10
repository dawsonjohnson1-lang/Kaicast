import React, { useMemo, useState } from 'react';
import { Platform, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing, typography } from '@/theme';
import { darkMapUrl, satelliteUrl, projectLatLonToImage, fitPointsToViewport } from '@/api/satellite';
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
let PointAnnotation: any = null;
try {
  if (Platform.OS !== 'web') {
    const mod = require('@rnmapbox/maps');
    Mapbox = mod.default;
    MapView = mod.MapView;
    Camera = mod.Camera;
    PointAnnotation = mod.PointAnnotation;
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
  onSpotPress?: (spot: Spot) => void;
  /** Tap-handler when a cluster of 2+ spots is pressed. */
  onClusterPress?: (spots: Spot[]) => void;
};

export function SpotMap({ spots, onSpotPress, onClusterPress }: SpotMapProps) {
  if (!useMapbox) return <FauxMap spots={spots} onSpotPress={onSpotPress} onClusterPress={onClusterPress} />;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL="mapbox://styles/mapbox/dark-v11"
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera centerCoordinate={[-157.85, 20.9]} zoomLevel={6.2} animationMode="none" />
      {spots.map((spot) => (
        <PointAnnotation
          key={spot.id}
          id={spot.id}
          coordinate={[spot.lon, spot.lat]}
          onSelected={() => onSpotPress?.(spot)}
        >
          <View style={pinStyles.outer}>
            <View style={pinStyles.inner} />
          </View>
        </PointAnnotation>
      ))}
    </MapView>
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

  // Prefer the dark Mapbox style — matches the native interactive map
   // and reads better than satellite imagery for pin visibility. Falls
   // through to ESRI satellite only when Mapbox token isn't configured.
  const tileUri =
    size && viewport
      ? darkMapUrl(viewport.centerLat, viewport.centerLon, size.w, size.h, viewport.zoom) ??
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
