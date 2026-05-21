/**
 * Wind layer — NWS NDFD Hawaii wind speed WMS.
 *
 * Real 2.5 km National Digital Forecast Database wind speed grid for
 * Hawaii. Replaces the prior OpenWeatherMap raster, which was too
 * coarse to distinguish wind variation across the islands.
 *
 * Service quirks:
 *   - WMS 1.1.1 syntax (uses SRS, not CRS)
 *   - Required `vtit` dimension — "Valid Time / Issuance Time", 3-hour
 *     slots (UTC). Pick the slot nearest current time.
 *   - Service is cascaded → tile generation can take a beat on the
 *     first request after a deploy; subsequent requests are cached.
 *   - No CORS headers from the service. Mapbox renders raster tiles
 *     via <img> tags so basic display works, but WebGL upload may
 *     warn. If browser blocks it entirely, we'll need a Cloud
 *     Functions tile proxy (separate work).
 *
 * Mapbox raster sources substitute {bbox-epsg-3857} per tile request
 * automatically — that's all the magic glue needed to bridge a WMS
 * server into Mapbox's XYZ tile request model.
 */

import type mapboxgl from 'mapbox-gl';

export const WIND_SOURCE_ID = 'kc-wind-src';
export const WIND_LAYER_ID = 'kc-wind-lyr';

const WMS_BASE = 'https://digital.weather.gov/ndfd.hawaii/wms';

// NDFD valid-time slots are every 3 hours UTC starting at 00:00.
// Bias 1.5 h forward so we land on "the slot the user is currently
// in" rather than the past slot when we're between two stamps.
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
  // {bbox-epsg-3857} is a Mapbox raster-source template variable —
  // Mapbox computes the actual bbox per requested tile and substitutes.
  return (
    `${WMS_BASE}` +
    `?REQUEST=GetMap` +
    `&SERVICE=WMS` +
    `&VERSION=1.1.1` +
    `&LAYERS=ndfd.hawaii.windspd` +
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

  const tileUrl = buildTileUrl(currentVtit());

  map.addSource(WIND_SOURCE_ID, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
    // NDFD resolution is 2.5 km — past z12 the WMS just upsamples its
    // own grid, so capping here avoids wasted requests for no extra
    // detail.
    maxzoom: 12,
    // Restrict requests to the Hawaii archipelago bbox. Without this,
    // Mapbox at low zoom asks NDFD for tiles covering the whole
    // Pacific; the Hawaii WMS returns tiny error PNGs for those
    // requests, which Mapbox surfaces as tile errors in the console.
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
        // NDFD wind speed renders as a colored gradient. Opacity high
        // enough to read variation, low enough that the basemap stays
        // legible for orientation.
        'raster-opacity': 0.7,
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
