// Single source for every static satellite image rendered in the app
// (spot heroes, saved/featured/explore cards, Wind/Current compass
// backgrounds). Mapbox stays reserved for the live interactive map
// on the Explore tab.
//
// Provider: ESRI World Imagery via the ArcGIS Online export endpoint.
//   - High-resolution Maxar imagery (same upstream provider as Google)
//   - No per-image watermark — attribution is required somewhere in
//     app credits / Legal as "Source: Esri, Maxar, Earthstar
//     Geographics" (one-liner, NOT on every image)
//   - No API key required
//   - Public service is for limited non-commercial use; at production
//     scale move to a paid ArcGIS subscription or self-hosted tiles.
//   - Server-side rendering — first-fetch latency is higher than
//     Google's pyramid tiles (~200-500ms vs 50-100ms). React Native
//     <Image> caches subsequent loads.
//
// To swap back to Google Maps Static, replace the body of
// `satelliteUrl` with the prior Google implementation — function
// signature is stable so no consumers need to change.

const ESRI_EXPORT =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export';

// WGS84 / Web-Mercator constants for the bbox math.
const EARTH_R = 6378137; // semi-major axis, meters
const WORLD_CIRC_M = 2 * Math.PI * EARTH_R; // ~40,075,016.7 m

const cache = new Map<string, string>();

// Web Mercator forward projection — converts lat/lon (degrees) into
// EPSG:3857 meters that the ESRI export endpoint understands when we
// pass `bboxSR=3857&imageSR=3857`.
function lonToMercatorX(lon: number): number {
  return EARTH_R * (lon * Math.PI) / 180;
}

function latToMercatorY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const phi = (clamped * Math.PI) / 180;
  return EARTH_R * Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

// Equator pixel resolution at the given zoom (256-px tile pyramid —
// matches Google/Mapbox/ESRI tile zoom semantics, so a tile at z=16
// from any of these providers shows the same ground area).
function metersPerPixel(zoom: number): number {
  return WORLD_CIRC_M / (256 * Math.pow(2, zoom));
}

function mercatorYToLat(y: number): number {
  const rad = Math.PI / 2 - 2 * Math.atan(Math.exp(-y / EARTH_R));
  return (rad * 180) / Math.PI;
}

function mercatorXToLon(x: number): number {
  return (x / EARTH_R) * (180 / Math.PI);
}

/**
 * Project a lat/lon into pixel offsets within an image rendered by
 * `satelliteUrl(centerLat, centerLon, width, height, zoom)`. Returns
 * { x, y } where (0,0) is the image's top-left corner. Used to place
 * overlay markers on top of the satellite tile.
 */
export function projectLatLonToImage(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  zoom: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const mpp = metersPerPixel(zoom);
  const dx = (lonToMercatorX(lon) - lonToMercatorX(centerLon)) / mpp;
  const dy = -(latToMercatorY(lat) - latToMercatorY(centerLat)) / mpp;
  return { x: width / 2 + dx, y: height / 2 + dy };
}

/**
 * Pick a center+zoom for `satelliteUrl` so the given points land
 * inside the visible portion of the rendered image.
 *
 *   - The image fills (viewW × viewH).
 *   - `sheetCoverFrac` (0–1) is the fraction of viewH covered by an
 *     overlay (e.g. a bottom sheet) — the visible region is the top
 *     (1 - sheetCoverFrac) portion. The chosen center is shifted
 *     south so the visible region's center lands on the point centroid.
 *   - `padding` (0–1) leaves breathing room around the bounding box
 *     inside the visible region.
 *   - When `points` is empty or has zero geographic extent, falls back
 *     to a Hawaii-chain overview at zoom 6.2.
 */
export function fitPointsToViewport(
  points: { lat: number; lon: number }[],
  viewW: number,
  viewH: number,
  sheetCoverFrac = 0,
  padding = 0.15,
  fallbackCenter = { lat: 20.9, lon: -157.85 },
  fallbackZoom = 6.2,
  maxZoom = 12,
): { centerLat: number; centerLon: number; zoom: number } {
  if (points.length === 0 || viewW <= 0 || viewH <= 0) {
    return { centerLat: fallbackCenter.lat, centerLon: fallbackCenter.lon, zoom: fallbackZoom };
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const minMercX = lonToMercatorX(minLon);
  const maxMercX = lonToMercatorX(maxLon);
  const minMercY = latToMercatorY(minLat);
  const maxMercY = latToMercatorY(maxLat);

  const visibleH = viewH * (1 - sheetCoverFrac);
  const fitW = Math.max(viewW * (1 - padding), 1);
  const fitH = Math.max(visibleH * (1 - padding), 1);

  // Guard against single-point inputs: give them a minimum bbox so we
  // don't pick infinite zoom.
  const spanX = Math.max(maxMercX - minMercX, 1);
  const spanY = Math.max(maxMercY - minMercY, 1);
  const requiredMpp = Math.max(spanX / fitW, spanY / fitH);
  const rawZoom = Math.log2(WORLD_CIRC_M / (256 * requiredMpp));
  const zoom = Math.min(Math.max(rawZoom, 1), maxZoom);

  const mpp = metersPerPixel(zoom);
  const centroidMercX = (minMercX + maxMercX) / 2;
  const centroidMercY = (minMercY + maxMercY) / 2;

  // Shift image center south of the visible centroid by the pixel
  // distance between the image's geometric center and the visible
  // region's center, so the centroid lands in the visible part.
  const visibleOffsetPx = viewH / 2 - visibleH / 2;
  const imageMercY = centroidMercY - visibleOffsetPx * mpp;

  return {
    centerLat: mercatorYToLat(imageMercY),
    centerLon: mercatorXToLon(centroidMercX),
    zoom,
  };
}

/**
 * Build a dark-themed map raster URL via Mapbox's Static Images API.
 * Uses the same Web Mercator tile pyramid as `satelliteUrl`, so the
 * same `projectLatLonToImage` math overlays pins correctly.
 *
 * Returns null when the public Mapbox token isn't configured, so
 * callers can fall back to ESRI satellite (or a local SVG).
 *
 * Style: mapbox/dark-v11 (the deep-navy treatment shipped on the
 * native Mapbox path). 2x device pixel ratio so labels stay crisp
 * on Retina screens.
 */
export function darkMapUrl(
  lat: number,
  lon: number,
  width: number,
  height: number,
  zoom: number,
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const token = (typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_MAPBOX_TOKEN : '') || '';
  if (!token || token.length < 30 || token.includes('REPLACE_ME')) return null;

  // Mapbox caps Static Images API at 1280×1280 logical px (with @2x
  // returning 2560×2560 physical). Clamp to be safe.
  const w = Math.max(1, Math.min(1280, Math.round(width)));
  const h = Math.max(1, Math.min(1280, Math.round(height)));
  const z = Math.max(0, Math.min(20, Number(zoom.toFixed(2))));

  return (
    `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/` +
    `${lon.toFixed(5)},${lat.toFixed(5)},${z},0/` +
    `${w}x${h}@2x?logo=false&attribution=false&access_token=${token}`
  );
}

/**
 * Build a satellite tile URL centered on the given lat/lon. Same
 * (lat, lon, width, height, zoom) always returns the literal same
 * string, so callers get a stable URL and React's <Image> doesn't
 * re-fetch on every render.
 */
export function satelliteUrl(
  lat: number,
  lon: number,
  width: number,
  height: number,
  zoom = 16,
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const key = `${lat.toFixed(5)}_${lon.toFixed(5)}_${width}x${height}_z${zoom}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const cx = lonToMercatorX(lon);
  const cy = latToMercatorY(lat);
  const mpp = metersPerPixel(zoom);
  const halfW = (width / 2) * mpp;
  const halfH = (height / 2) * mpp;

  const params = new URLSearchParams({
    bbox: `${cx - halfW},${cy - halfH},${cx + halfW},${cy + halfH}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${Math.round(width)},${Math.round(height)}`,
    format: 'png',
    transparent: 'false',
    f: 'image',
  });
  const url = `${ESRI_EXPORT}?${params.toString()}`;
  cache.set(key, url);
  return url;
}
