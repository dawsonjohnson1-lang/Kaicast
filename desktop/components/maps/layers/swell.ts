/**
 * Swell layer — PacIOOS WaveWatch III Hawaii regional wave model.
 *
 * Real gridded wave-height field (~5 km native resolution) covering
 * the Hawaiian archipelago. Updates daily with 5-day forecast horizon.
 *
 * Replaces the previous per-spot circle pins, which were honest about
 * the data we stored (per-spot scalars) but didn't read as a "live"
 * raster overlay. The new layer is what you actually want — a smooth
 * gradient that varies across the map like a wind or precipitation
 * overlay.
 *
 * Service details:
 *   - WMS 1.3.0 GetMap with EPSG:3857 — Mapbox-compatible
 *   - Layer variable: `Thgt` (sea_surface_wave_significant_height)
 *   - Endpoint: PacIOOS THREDDS at pae-paha.pacioos.hawaii.edu
 *   - CORS: open (Access-Control-Allow-Origin: *)
 *   - Default ncWMS color stops — we don't override; KaiCast tier
 *     palette could be wired later via custom PALETTE param.
 */

import type mapboxgl from 'mapbox-gl';

export const SWELL_SOURCE_ID = 'kc-swell-src';
export const SWELL_LAYER_ID = 'kc-swell-lyr';

const WMS_BASE =
  'https://pae-paha.pacioos.hawaii.edu/thredds/wms/ww3_hawaii/WaveWatch_III_Hawaii_Regional_Wave_Model_best.ncd';

const TILE_URL =
  `${WMS_BASE}` +
  '?REQUEST=GetMap' +
  '&SERVICE=WMS' +
  '&VERSION=1.3.0' +
  '&LAYERS=Thgt' +
  '&CRS=EPSG:3857' +
  '&BBOX={bbox-epsg-3857}' +
  '&WIDTH=256' +
  '&HEIGHT=256' +
  '&FORMAT=image/png' +
  '&TRANSPARENT=TRUE' +
  '&STYLES=';

export function addSwell(map: mapboxgl.Map): void {
  if (map.getSource(SWELL_SOURCE_ID)) return;
  if (!map.getStyle()) return;

  map.addSource(SWELL_SOURCE_ID, {
    type: 'raster',
    tiles: [TILE_URL],
    tileSize: 256,
    // Wave model native res is ~5 km — past z11 we'd just be
    // requesting upsampled garbage from the WMS.
    maxzoom: 11,
    // Confine requests to the Hawaiian archipelago bbox. The WMS
    // covers only that area; without bounds Mapbox would hammer it
    // for global tiles at low zoom.
    bounds: [-161, 18, -154, 23],
    minzoom: 4,
    attribution:
      '© <a href="https://www.pacioos.hawaii.edu/" target="_blank" rel="noopener">PacIOOS</a> · WaveWatch III',
  });

  // Anchor above water but below labels so place names stay readable.
  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;
  map.addLayer(
    {
      id: SWELL_LAYER_ID,
      type: 'raster',
      source: SWELL_SOURCE_ID,
      paint: {
        'raster-opacity': 0.7,
        'raster-fade-duration': 200,
      },
    },
    anchor,
  );
}

export function removeSwell(map: mapboxgl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(SWELL_LAYER_ID)) map.removeLayer(SWELL_LAYER_ID);
  if (map.getSource(SWELL_SOURCE_ID)) map.removeSource(SWELL_SOURCE_ID);
}
