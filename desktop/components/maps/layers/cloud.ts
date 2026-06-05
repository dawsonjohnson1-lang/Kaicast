/**
 * Cloud cover layer — NASA GIBS GOES-West satellite (GeoColor).
 *
 * Real satellite imagery from GOES-18 / GOES-West, refreshed every
 * ~10 min. True visible/near-IR cloud structure over the entire
 * Pacific including Hawaii. Replaces the prior OpenWeatherMap raster
 * which was too coarse to show meaningful cloud variation over the
 * tradewind belt.
 *
 * Endpoint: NASA GIBS KVP WMTS. The REST path returns 404 for time-
 * dimensioned layers; KVP works. We use `TIME=default` so GIBS picks
 * the latest published frame — production ingest is irregular and
 * not every 10-min slot exists, so trying to construct timestamps
 * client-side ends in 404s on the gaps.
 *
 * Tile matrix set is `GoogleMapsCompatible_Level7`, so the source
 * supports zoom 0–7 natively; Mapbox oversamples beyond that.
 */

import type * as mapboxgl from 'mapbox-gl';

// Two stacked sources for the cloud layer:
//   - GIBS GOES-West GeoColor (top, archipelago zoom only): real
//     satellite imagery at Level7 native max. Shown only at z ≤ 7
//     where it looks sharp.
//   - OWM `clouds_new` (bottom, all zooms): smoother gradient that
//     fills in detail at island zoom (z 8+) where GIBS would
//     pixelate from oversampling.
export const CLOUD_GIBS_SOURCE_ID = 'kc-cloud-gibs-src';
export const CLOUD_GIBS_LAYER_ID = 'kc-cloud-gibs-lyr';
export const CLOUD_OWM_SOURCE_ID = 'kc-cloud-owm-src';
export const CLOUD_OWM_LAYER_ID = 'kc-cloud-owm-lyr';

const OWM_KEY = (import.meta as any).env?.VITE_OPENWEATHER_TOKEN as string | undefined;

const GIBS_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi' +
  '?TIME=default' +
  '&layer=GOES-West_ABI_GeoColor' +
  '&style=default' +
  '&tilematrixset=GoogleMapsCompatible_Level7' +
  '&Service=WMTS' +
  '&Request=GetTile' +
  '&Version=1.0.0' +
  '&Format=image/png' +
  '&TileMatrix={z}' +
  '&TileCol={x}' +
  '&TileRow={y}';

export function addCloud(map: mapboxgl.Map): void {
  if (map.getSource(CLOUD_GIBS_SOURCE_ID)) return;
  if (!map.getStyle()) return;

  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;

  // Bottom: OWM cloud_new (full zoom range, smooth gradient).
  if (OWM_KEY) {
    map.addSource(CLOUD_OWM_SOURCE_ID, {
      type: 'raster',
      tiles: [`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`],
      tileSize: 256,
      maxzoom: 9,
      attribution:
        '© <a href="https://openweathermap.org/" target="_blank" rel="noopener">OpenWeather</a>',
    });
    map.addLayer(
      {
        id: CLOUD_OWM_LAYER_ID,
        type: 'raster',
        source: CLOUD_OWM_SOURCE_ID,
        paint: { 'raster-opacity': 0.5, 'raster-fade-duration': 200 },
      },
      anchor,
    );
  }

  // Top: GIBS GOES-West (only at archipelago zoom, where native res
  // looks sharp). Layer-level maxzoom hides it above z7 so we don't
  // see oversampled blur at island zoom.
  map.addSource(CLOUD_GIBS_SOURCE_ID, {
    type: 'raster',
    tiles: [GIBS_URL],
    tileSize: 256,
    maxzoom: 7,
    attribution:
      '© <a href="https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noopener">NASA GIBS</a> · GOES-West',
  });
  map.addLayer(
    {
      id: CLOUD_GIBS_LAYER_ID,
      type: 'raster',
      source: CLOUD_GIBS_SOURCE_ID,
      // Hide GIBS at island zoom so OWM owns the visual there.
      maxzoom: 7.5,
      paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 200 },
    },
    anchor,
  );
}

export function removeCloud(map: mapboxgl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(CLOUD_GIBS_LAYER_ID)) map.removeLayer(CLOUD_GIBS_LAYER_ID);
  if (map.getSource(CLOUD_GIBS_SOURCE_ID)) map.removeSource(CLOUD_GIBS_SOURCE_ID);
  if (map.getLayer(CLOUD_OWM_LAYER_ID)) map.removeLayer(CLOUD_OWM_LAYER_ID);
  if (map.getSource(CLOUD_OWM_SOURCE_ID)) map.removeSource(CLOUD_OWM_SOURCE_ID);
}
