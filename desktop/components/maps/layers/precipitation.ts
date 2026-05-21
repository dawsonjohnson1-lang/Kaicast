/**
 * Precipitation layer — OpenWeatherMap model rainfall.
 *
 * Note: tried stacking real NEXRAD radar (PHKI, Iowa Mesonet) on top
 * but their `tile.py` endpoint isn't a real XYZ tile service — it
 * returns the same "Invalid TMS Request" error PNG for every coordinate.
 * Dropped entirely. If real radar matters later, we'd need either a
 * server-side ingest pipeline or a paid Hawaii NEXRAD tile provider.
 *
 * RainViewer also dropped earlier (no Hawaii radar network coverage).
 *
 * What's left: OWM precipitation_new — model-derived rainfall forecast,
 * full Hawaii coverage, refreshes every ~3 hours.
 */

import type mapboxgl from 'mapbox-gl';

export const PRECIPITATION_SOURCE_ID = 'kc-precipitation-src';
export const PRECIPITATION_LAYER_ID = 'kc-precipitation-lyr';

const OWM_KEY = (import.meta as any).env?.VITE_OPENWEATHER_TOKEN as string | undefined;

export function addPrecipitation(map: mapboxgl.Map): void {
  if (map.getSource(PRECIPITATION_SOURCE_ID)) return;
  if (!map.getStyle()) return;
  if (!OWM_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[precipitation] VITE_OPENWEATHER_TOKEN missing');
    return;
  }

  const tileUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`;

  map.addSource(PRECIPITATION_SOURCE_ID, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
    maxzoom: 9, // OWM free tier ceiling
    attribution:
      '© <a href="https://openweathermap.org/" target="_blank" rel="noopener">OpenWeather</a>',
  });

  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;
  map.addLayer(
    {
      id: PRECIPITATION_LAYER_ID,
      type: 'raster',
      source: PRECIPITATION_SOURCE_ID,
      paint: {
        'raster-opacity': 0.65,
        'raster-fade-duration': 200,
      },
    },
    anchor,
  );
}

export function removePrecipitation(map: mapboxgl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(PRECIPITATION_LAYER_ID)) map.removeLayer(PRECIPITATION_LAYER_ID);
  if (map.getSource(PRECIPITATION_SOURCE_ID)) map.removeSource(PRECIPITATION_SOURCE_ID);
}
