/**
 * Currents layer — PacIOOS ROMS Hawaii regional ocean model.
 *
 * Real gridded surface-current field at ~4 km resolution covering the
 * Main Hawaiian Islands. Renders as colored vector arrows (Windy-
 * style) so users can read both speed AND direction at a glance.
 *
 * Service details:
 *   - WMS 1.3.0, EPSG:3857, CORS open
 *   - Variable: `sea_water_velocity` — composite u/v magnitude+direction
 *   - Style: `vector/rdylbu` — direction arrows colored by magnitude
 *     (blue = calm, red = strong)
 *   - Daily forecast, 7-day horizon, 3-hourly time steps
 *
 * The same WMS server also exposes `u` and `v` components individually
 * for custom rendering; we use the composite `sea_water_velocity`
 * because ncWMS already renders it as vector arrows.
 */

import type mapboxgl from 'mapbox-gl';

export const CURRENTS_SOURCE_ID = 'kc-currents-src';
export const CURRENTS_LAYER_ID = 'kc-currents-lyr';

const WMS_BASE =
  'https://pae-paha.pacioos.hawaii.edu/thredds/wms/roms_hiig/ROMS_Hawaii_Regional_Ocean_Model_best.ncd';

// 2× pixel density per tile so vector arrows render sharper at all
// zooms (especially Retina). Each tile is still one logical 256×256
// map tile; ncWMS just rasterizes its arrow field into twice as many
// pixels, which the GPU downsamples cleanly.
const TILE_URL =
  `${WMS_BASE}` +
  '?REQUEST=GetMap' +
  '&SERVICE=WMS' +
  '&VERSION=1.3.0' +
  '&LAYERS=sea_water_velocity' +
  '&CRS=EPSG:3857' +
  '&BBOX={bbox-epsg-3857}' +
  '&WIDTH=512' +
  '&HEIGHT=512' +
  '&FORMAT=image/png' +
  '&TRANSPARENT=TRUE' +
  '&STYLES=vector/rdylbu';

export function addCurrents(map: mapboxgl.Map): void {
  if (map.getSource(CURRENTS_SOURCE_ID)) return;
  if (!map.getStyle()) return;

  map.addSource(CURRENTS_SOURCE_ID, {
    type: 'raster',
    tiles: [TILE_URL],
    // 512px tile so the hi-res WMS rasterization stays crisp without
    // Mapbox having to downsample. Matches the WIDTH/HEIGHT bump above.
    tileSize: 512,
    // ROMS native res is still ~4 km; bumping maxzoom from 11 → 14 means
    // Mapbox keeps requesting fresh tiles instead of stretching the z11
    // image, so as you zoom into a single island you get tighter bboxes
    // and arrows positioned with finer granularity (one arrow per 4 km
    // ocean grid cell instead of one per ~10 stretched pixels).
    maxzoom: 14,
    // Restrict to the Main Hawaiian Islands bbox so Mapbox doesn't
    // hammer the WMS with global tile requests at low zoom.
    bounds: [-161, 18, -154, 23],
    minzoom: 4,
    attribution:
      '© <a href="https://www.pacioos.hawaii.edu/" target="_blank" rel="noopener">PacIOOS</a> · ROMS',
  });

  // Vector arrows are most useful when they sit ABOVE other overlays
  // (you want to see the arrows on top of swell/wind raster, not
  // hidden underneath). Render last so it stacks on top of other
  // active layers in the data tier.
  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;
  map.addLayer(
    {
      id: CURRENTS_LAYER_ID,
      type: 'raster',
      source: CURRENTS_SOURCE_ID,
      paint: {
        // Higher opacity — vector arrows need to read clearly.
        'raster-opacity': 0.9,
        'raster-fade-duration': 200,
      },
    },
    anchor,
  );
}

export function removeCurrents(map: mapboxgl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(CURRENTS_LAYER_ID)) map.removeLayer(CURRENTS_LAYER_ID);
  if (map.getSource(CURRENTS_SOURCE_ID)) map.removeSource(CURRENTS_SOURCE_ID);
}
