// Canonical map styling — kept in lockstep with desktop's KaiCastMap
// so the two clients render the Hawaiian archipelago identically.
//
// Source of truth: /Users/dawsonjohnson/Kaicast/desktop/components/maps/
// KaiCastMap.tsx (BASE_STYLE) and /Users/dawsonjohnson/Kaicast/desktop/
// tokens.ts. When either side moves, mirror the change here.

import { RATING_COLORS, type RatingTier } from './ratingColors';

// Mapbox stock dark style — matches desktop. Both clients start from
// dark-v11 and then recolor a fixed set of layers to the KaiCast
// surface palette. Desktop does it via `map.setPaintProperty(...)`
// in KaiCastMap.tsx; mobile does it via `<FillLayer existing>` /
// `<LineLayer existing>` / `<SymbolLayer existing>` / `<BackgroundLayer existing>`
// children of MapView, listed in MAP_LAYER_OVERRIDES below.
//
// If desktop ever moves to a custom Mapbox Studio style, point both
// clients at that style URL here and drop the override list.
export const KAICAST_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

// Map-only surface scale — mirrors desktop's `surface0/surface1/surface2`
// from tokens.ts. NOT general mobile theme tokens (the mobile theme
// uses `bg` + rgba inset surfaces); these only exist so the map matches
// desktop's recolored look exactly.
export const MAP_SURFACE_0 = '#111518';
export const MAP_SURFACE_1 = '#181D22';
export const MAP_SURFACE_2 = '#1E252C';

// Map-only label colors — mirrors desktop's `text3/text4`.
export const MAP_TEXT_3 = 'rgba(248,248,248,0.44)';
export const MAP_TEXT_4 = 'rgba(248,248,248,0.26)';

// Layer-color overrides applied to dark-v11. Mirrors desktop's
// STYLE_OVERRIDES in components/maps/KaiCastMap.tsx — keep in sync.
// `kind` tells the renderer which rnmapbox layer component to mount
// (FillLayer / LineLayer / SymbolLayer / BackgroundLayer).
export type MapLayerOverride =
  | { kind: 'fill';       id: string; color: string }
  | { kind: 'line';       id: string; color: string }
  | { kind: 'symbol';     id: string; color: string }
  | { kind: 'background'; id: string; color: string };

export const MAP_LAYER_OVERRIDES: MapLayerOverride[] = [
  // Land — blend into KaiCast surface so the map doesn't feel like a
  // foreign element pasted onto the page. `land` itself is a Mapbox
  // background-type layer in dark-v11, so it needs BackgroundLayer
  // rather than FillLayer.
  { kind: 'background', id: 'land',                   color: MAP_SURFACE_0 },
  { kind: 'fill',       id: 'landcover',              color: MAP_SURFACE_0 },
  { kind: 'fill',       id: 'land-structure-polygon', color: MAP_SURFACE_1 },
  // Roads — muted; this map is about ocean conditions, not driving.
  { kind: 'line',       id: 'road-primary',            color: MAP_SURFACE_2 },
  { kind: 'line',       id: 'road-secondary-tertiary', color: MAP_SURFACE_2 },
  { kind: 'line',       id: 'road-street',             color: MAP_SURFACE_2 },
  { kind: 'line',       id: 'road-minor',              color: MAP_SURFACE_2 },
  // Labels — text3/text4 so KaiCast pins stay the visual focal point.
  { kind: 'symbol',     id: 'country-label',           color: MAP_TEXT_3 },
  { kind: 'symbol',     id: 'settlement-major-label',  color: MAP_TEXT_3 },
  { kind: 'symbol',     id: 'settlement-minor-label',  color: MAP_TEXT_4 },
  { kind: 'symbol',     id: 'water-point-label',       color: MAP_TEXT_4 },
  { kind: 'symbol',     id: 'water-line-label',        color: MAP_TEXT_4 },
];

// Hawaiian archipelago center + zoom — same numbers desktop ships
// (HAWAII_CENTER / HAWAII_ZOOM in KaiCastMap.tsx).
export const HAWAII_CENTER: [number, number] = [-157.5, 20.5];
export const HAWAII_ZOOM = 6.8;

// Single-spot focus zoom — used after tapping a marker. Same value
// desktop uses in SpotsMapScreen.tsx (MapColumn) so the post-tap
// framing matches.
export const SPOT_FOCUS_ZOOM = 9.5;

// Marker sizing — mirrors desktop's applyMarkerStyle. Desktop uses
// 13/16/18 px for unselected/hovered/selected; mobile has no hover so
// we collapse to unselected/selected and shrink slightly because
// CircleLayer takes a radius rather than a diameter.
export const MARKER_RADIUS_UNSELECTED = 6;   // 12 px diameter
export const MARKER_RADIUS_SELECTED = 8;     // 16 px diameter
export const MARKER_STROKE_WIDTH = 2;
export const MARKER_STROKE_COLOR = '#FFFFFF';

// Selected-spot halo: 4 px outer ring at 40% opacity, same color as
// the marker. Implemented as a second CircleLayer rendered beneath
// the marker circles via belowLayerID.
export const HALO_RADIUS = 12;
export const HALO_OPACITY = 0.4;

export type SpotMarkerFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    color: string;
    tier: RatingTier | 'unknown';
  };
};

// Build a GeoJSON FeatureCollection from a list of spots — fed into
// <ShapeSource> on the mobile map. Spots with no rating fall back to
// a muted color so unrated markers stay visible.
export function spotsToGeoJSON(
  spots: Array<{ id: string; lat: number; lon: number; rating?: RatingTier }>,
  unratedColor = 'rgba(248,248,248,0.44)',
): { type: 'FeatureCollection'; features: SpotMarkerFeature[] } {
  return {
    type: 'FeatureCollection',
    features: spots.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        id: s.id,
        color: s.rating ? RATING_COLORS[s.rating] : unratedColor,
        tier: s.rating ?? 'unknown',
      },
    })),
  };
}
