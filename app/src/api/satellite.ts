// Single source for every static satellite image rendered in the app
// (spot heroes, saved/featured/explore cards, Wind/Current compass
// backgrounds). Mapbox stays reserved for the live interactive map
// on the Explore tab — its static tiles ship with a "© Maxar / © Mapbox"
// watermark which we don't want on cards or thumbnails.
//
// Provider: Google Maps Static API.
//   - maptype=satellite gives raw imagery
//   - style=feature:all|element:labels|visibility:off suppresses
//     road / city / POI labels so the crop is pure satellite
//   - scale=2 returns retina pixels; we scale dimensions appropriately
//
// Reads the key from EXPO_PUBLIC_GOOGLE_MAPS_KEY (preferred, matches
// spec). Falls back to EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for back-compat
// with .env files that already set the longer name. When no key is
// configured, returns `null` and the consumer renders a fallback.

const GOOGLE_KEY =
  (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim() ||
  (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();

const cache = new Map<string, string>();

/**
 * Build a Google Static Maps URL centered on the given lat/lon.
 *
 * The same `(lat, lon, width, height, zoom)` always returns the literal
 * same string, so callers get a stable URL and React's <Image> doesn't
 * re-fetch on every render.
 */
export function satelliteUrl(
  lat: number,
  lon: number,
  width: number,
  height: number,
  zoom = 16,
): string | null {
  if (!GOOGLE_KEY) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = `${lat.toFixed(5)}_${lon.toFixed(5)}_${width}x${height}_z${zoom}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    center: `${lat},${lon}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    maptype: 'satellite',
    style: 'feature:all|element:labels|visibility:off',
    key: GOOGLE_KEY,
  });
  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  cache.set(key, url);
  return url;
}
