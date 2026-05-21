/**
 * Wind layer — OpenWeatherMap `wind_new` raster.
 *
 * Switched off the NDFD Hawaii WMS to OWM because:
 *   - NDFD wind speed renders extremely subtly (light blue gradient on
 *     transparent background) — users reported "wind isn't showing
 *     anything". OWM's wind raster uses a saturated rainbow gradient
 *     that's clearly visible even at low zoom.
 *   - NDFD's WMS occasionally returns "Invalid TMS Request" text on
 *     out-of-bounds tiles which Mapbox surfaces as console errors.
 *   - We already pay for OWM (precipitation uses the same token), so
 *     no extra credentials.
 *
 * Global coverage, no bbox restriction needed. Free-tier cap is z=9.
 */

import type mapboxgl from 'mapbox-gl';

export const WIND_SOURCE_ID = 'kc-wind-src';
export const WIND_LAYER_ID = 'kc-wind-lyr';

const OWM_KEY = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_OPENWEATHER_TOKEN;

export function addWind(map: mapboxgl.Map): void {
  if (map.getSource(WIND_SOURCE_ID)) return;
  if (!map.getStyle()) return;
  if (!OWM_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[wind] VITE_OPENWEATHER_TOKEN missing — wind overlay disabled');
    return;
  }

  const tileUrl = `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`;

  map.addSource(WIND_SOURCE_ID, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
    maxzoom: 9, // OWM free-tier ceiling
    attribution:
      '© <a href="https://openweathermap.org/" target="_blank" rel="noopener">OpenWeather</a>',
  });

  const anchor = map.getLayer('country-label') ? 'country-label' : undefined;
  map.addLayer(
    {
      id: WIND_LAYER_ID,
      type: 'raster',
      source: WIND_SOURCE_ID,
      paint: {
        // Strong enough to read the rainbow gradient over the dark
        // basemap; low enough the islands stay legible.
        'raster-opacity': 0.65,
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
