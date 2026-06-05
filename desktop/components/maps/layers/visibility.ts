/**
 * Visibility heatmap layer.
 *
 * Data flow:
 *   1. Query `community_overlays` for `avg_observed_visibility_ft` per spot
 *   2. Join with `spots` to get lat/lon (overlays are keyed by spotId but
 *      don't carry coordinates — coordinates live on the spots collection)
 *   3. Render as a Mapbox heatmap with 5-tier KaiCast color stops:
 *      transparent → no-go red → fair orange → good yellow → great green
 *      → excellent blue, modulated by per-point visibility weight.
 *
 * Fallback: when Firebase isn't configured OR either collection is
 * empty, render hardcoded mock data so the layer is visually testable
 * pre-launch. The mock is clearly labeled in code; remove once the
 * collections have real data.
 *
 * Cache: 5 min in-memory. Data refreshes are cheap (one read of each
 * collection), but the visibility readings only change when a new dive
 * log lands.
 */

import type * as mapboxgl from 'mapbox-gl';
import { collection, getDocs } from 'firebase/firestore';

import { RAW_TIER_HEX } from '../../../tokens';
import { db, firebaseConfigured } from '../../../firebase';

export const VISIBILITY_SOURCE_ID = 'kc-visibility-src';
export const VISIBILITY_LAYER_ID = 'kc-visibility-lyr';

interface VisibilityPoint {
  spotId: string;
  lng: number;
  lat: number;
  visibilityFt: number;
}

// Mock visibility readings used when Firestore is unavailable or the
// community_overlays collection is empty. Coordinates pulled from
// functions/index.js SPOTS registry. Remove this once the production
// collection has real data.
const MOCK_VISIBILITY: VisibilityPoint[] = [
  { spotId: 'electric-beach',   lng: -158.1220, lat: 21.3550, visibilityFt: 56 },
  { spotId: 'sharks-cove',      lng: -158.0617, lat: 21.6417, visibilityFt: 48 },
  { spotId: 'magic-island',     lng: -157.8458, lat: 21.2840, visibilityFt: 38 },
  { spotId: 'hanauma-bay',      lng: -157.6939, lat: 21.2694, visibilityFt: 30 },
  { spotId: 'turtle-canyon',    lng: -158.1500, lat: 21.4000, visibilityFt: 18 },
  { spotId: 'molokini-crater',  lng: -156.4950, lat: 20.6330, visibilityFt: 75 },
  { spotId: 'honolua-bay',      lng: -156.6398, lat: 21.0123, visibilityFt: 50 },
  { spotId: 'ulua-beach',       lng: -156.4427, lat: 20.6843, visibilityFt: 40 },
  { spotId: 'black-rock',       lng: -156.6920, lat: 20.9333, visibilityFt: 52 },
  { spotId: 'kealakekua-bay',   lng: -155.9197, lat: 19.4791, visibilityFt: 70 },
  { spotId: 'kahaluu-beach',    lng: -155.9683, lat: 19.5757, visibilityFt: 44 },
  { spotId: 'two-step',         lng: -155.9099, lat: 19.4187, visibilityFt: 60 },
  { spotId: 'richardson-beach', lng: -155.0167, lat: 19.7367, visibilityFt: 36 },
  { spotId: 'tunnels-beach',    lng: -159.5705, lat: 22.2233, visibilityFt: 45 },
  { spotId: 'poipu-beach',      lng: -159.4537, lat: 21.8736, visibilityFt: 40 },
];

interface CacheEntry {
  points: VisibilityPoint[];
  source: 'firestore' | 'mock';
  fetchedAt: number;
}

let cached: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getVisibilityData(): Promise<CacheEntry> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  if (!firebaseConfigured || !db) {
    cached = { points: MOCK_VISIBILITY, source: 'mock', fetchedAt: Date.now() };
    return cached;
  }

  try {
    const [overlaysSnap, spotsSnap] = await Promise.all([
      getDocs(collection(db, 'community_overlays')),
      getDocs(collection(db, 'spots')),
    ]);

    // Index spots by id for the coordinate join.
    const spotsById = new Map<string, { lat: number; lon: number }>();
    spotsSnap.forEach((doc) => {
      const data = doc.data() as { lat?: unknown; lon?: unknown };
      if (typeof data.lat === 'number' && typeof data.lon === 'number') {
        spotsById.set(doc.id, { lat: data.lat, lon: data.lon });
      }
    });

    const points: VisibilityPoint[] = [];
    overlaysSnap.forEach((doc) => {
      const overlay = doc.data() as { avg_observed_visibility_ft?: unknown };
      const visFt = overlay.avg_observed_visibility_ft;
      if (typeof visFt !== 'number') return;
      const coords = spotsById.get(doc.id);
      if (!coords) return;
      points.push({
        spotId: doc.id,
        lng: coords.lon,
        lat: coords.lat,
        visibilityFt: visFt,
      });
    });

    if (points.length === 0) {
      // Both collections may exist but the join produces nothing
      // (pre-launch state — no dive logs yet). Fall back to mock.
      // eslint-disable-next-line no-console
      console.info('[visibility layer] no Firestore data yet, using mock');
      cached = { points: MOCK_VISIBILITY, source: 'mock', fetchedAt: Date.now() };
      return cached;
    }

    cached = { points, source: 'firestore', fetchedAt: Date.now() };
    return cached;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[visibility layer] Firestore query failed, using mock', err);
    cached = { points: MOCK_VISIBILITY, source: 'mock', fetchedAt: Date.now() };
    return cached;
  }
}

function toFeatureCollection(points: VisibilityPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        spotId: p.spotId,
        visibilityFt: p.visibilityFt,
      },
    })),
  };
}

export async function addVisibility(map: mapboxgl.Map): Promise<void> {
  if (map.getSource(VISIBILITY_SOURCE_ID)) return;
  const { points } = await getVisibilityData();
  if (!map.getStyle()) return; // map torn down during fetch

  map.addSource(VISIBILITY_SOURCE_ID, {
    type: 'geojson',
    data: toFeatureCollection(points),
  });

  // Sit above water but below labels so place names stay readable.
  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;

  map.addLayer(
    {
      id: VISIBILITY_LAYER_ID,
      type: 'heatmap',
      source: VISIBILITY_SOURCE_ID,
      paint: {
        // Per-point contribution: visibility 0 → 0.2 baseline so bad
        // spots still register; 60 ft+ → 1.0 saturated. The baseline
        // is what makes low-vis spots show as warm/red zones rather
        // than disappearing entirely.
        'heatmap-weight': [
          'interpolate', ['linear'], ['get', 'visibility_ft'],
          0,  0.2,
          15, 0.3,
          30, 0.55,
          45, 0.8,
          60, 1.0,
        ],
        // Density → 5-tier KaiCast gradient. Lowest density = transparent
        // (so non-data areas don't tint), then red → orange → yellow →
        // green → blue as density (i.e. how many good-vis spots overlap)
        // increases.
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(0,0,0,0)',
          0.1,  hexToRgba(RAW_TIER_HEX['no-go'],    0.55),
          0.3,  hexToRgba(RAW_TIER_HEX['fair'],     0.65),
          0.5,  hexToRgba(RAW_TIER_HEX['good'],     0.7),
          0.75, hexToRgba(RAW_TIER_HEX['great'],    0.75),
          1.0,  hexToRgba(RAW_TIER_HEX['excellent'], 0.8),
        ],
        // Scale point influence radius with zoom — at archipelago view
        // (z6-7) we want big blobs so spots merge into per-island
        // patches; zoomed into one island (z10+) we want them tighter
        // so per-spot variation reads.
        'heatmap-radius': [
          'interpolate', ['linear'], ['zoom'],
          5,  35,
          7,  60,
          9,  90,
          12, 140,
        ],
        // Slight zoom amplification — when zoomed in, less overlap so
        // boost intensity so each point still reads.
        'heatmap-intensity': [
          'interpolate', ['linear'], ['zoom'],
          5,  1,
          12, 2.2,
        ],
        'heatmap-opacity': 0.75,
      },
    },
    anchor,
  );
}

export function removeVisibility(map: mapboxgl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(VISIBILITY_LAYER_ID)) map.removeLayer(VISIBILITY_LAYER_ID);
  if (map.getSource(VISIBILITY_SOURCE_ID)) map.removeSource(VISIBILITY_SOURCE_ID);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
