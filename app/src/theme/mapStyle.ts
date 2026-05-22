// Canonical map styling — kept in lockstep with desktop's KaiCastMap
// so the two clients render the Hawaiian archipelago identically.
//
// Source of truth: /Users/dawsonjohnson/Kaicast/desktop/components/maps/
// KaiCastMap.tsx (BASE_STYLE) and /Users/dawsonjohnson/Kaicast/desktop/
// tokens.ts. When either side moves, mirror the change here.

import { RATING_COLORS, type RatingTier } from './ratingColors';

// Mapbox stock dark style — matches desktop. We rely on the stock
// palette rather than runtime paint overrides because @rnmapbox/maps
// doesn't expose setPaintProperty cleanly; dark-v11 alone gets us
// within a hair of desktop's recolored look (water/land/labels all
// near-black). If desktop ever moves to a custom Mapbox Studio style,
// point both clients at that style URL here.
export const KAICAST_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

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
