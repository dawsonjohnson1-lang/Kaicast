/**
 * Wind layer — NWS NDFD Hawaii wind barbs.
 *
 * Switched from OWM raster (flat color gradient, looked uniform over
 * Hawaii's tradewind belt) to NDFD's grid-barb style. Wind barbs are
 * the standard marine/aviation glyph — they encode BOTH direction
 * (line orientation) and speed (number of flags), so the user can
 * actually read what the wind is doing instead of staring at one
 * color across the whole archipelago.
 *
 * Layer variable: `ndfd.hawaii.windspd.gridbarbs.english`
 *   - gridbarbs = barb at every grid point (vs. sparse windbarbs)
 *   - english   = mph/kt-friendly internal calc (display is unit-less
 *                 glyphs either way)
 *
 * Service quirks:
 *   - WMS 1.1.1 (SRS not CRS)
 *   - `vtit` dimension required; 3-hour UTC slots
 *   - bounded to Hawaii bbox so non-HI tile requests don't surface
 *     "Invalid TMS Request" PNGs from the service
 */

import type * as mapboxgl from 'mapbox-gl';

export const WIND_SOURCE_ID = 'kc-wind-src';
export const WIND_LAYER_ID = 'kc-wind-lyr';

const WMS_BASE = 'https://digital.weather.gov/ndfd.hawaii/wms';

// NDFD slots are every 3h UTC. Bias 1.5h forward so we pick the slot
// the user is currently in (rather than rounding down to the past slot
// when they happen to load mid-period).
function currentVtit(): string {
  const d = new Date(Date.now() + 1.5 * 3600 * 1000);
  d.setUTCHours(Math.floor(d.getUTCHours() / 3) * 3, 0, 0, 0);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:00`;
}

function buildTileUrl(vtit: string): string {
  return (
    `${WMS_BASE}` +
    `?REQUEST=GetMap` +
    `&SERVICE=WMS` +
    `&VERSION=1.1.1` +
    `&LAYERS=ndfd.hawaii.windspd.gridbarbs.english` +
    `&SRS=EPSG:3857` +
    `&BBOX={bbox-epsg-3857}` +
    `&WIDTH=256` +
    `&HEIGHT=256` +
    `&FORMAT=image/png` +
    `&TRANSPARENT=TRUE` +
    `&STYLES=` +
    `&vtit=${vtit}`
  );
}

export function addWind(map: mapboxgl.Map): void {
  if (map.getSource(WIND_SOURCE_ID)) return;
  if (!map.getStyle()) return;

  map.addSource(WIND_SOURCE_ID, {
    type: 'raster',
    tiles: [buildTileUrl(currentVtit())],
    tileSize: 256,
    maxzoom: 12,
    // Restrict to Hawaii so out-of-coverage tile requests don't fire.
    // NDFD returns "Invalid TMS Request" error PNGs for bboxes outside
    // its service area, which Mapbox would otherwise render as visible
    // error overlays.
    bounds: [-161, 18, -154, 23],
    minzoom: 4,
    attribution:
      '© <a href="https://digital.weather.gov/" target="_blank" rel="noopener">NWS NDFD</a>',
  });

  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;
  map.addLayer(
    {
      id: WIND_LAYER_ID,
      type: 'raster',
      source: WIND_SOURCE_ID,
      paint: {
        // Barbs are thin black glyphs on transparent — high opacity
        // so they're actually visible on the dark basemap.
        'raster-opacity': 1.0,
        'raster-fade-duration': 200,
      },
    },
    anchor,
  );
}

export function removeWind(map: mapboxgl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(WIND_LAYER_ID)) map.removeLayer(WIND_LAYER_ID);
  if (map.getSource(WIND_SOURCE_ID)) map.removeSource(WIND_SOURCE_ID);
}
