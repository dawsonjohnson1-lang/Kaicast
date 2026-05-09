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
