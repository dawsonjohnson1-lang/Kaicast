/**
 * useMapLayers — applies LayerState to a Mapbox GL JS instance by
 * adding/removing sources + layers as the user toggles things on the
 * MapLayerControl.
 *
 * Layer modules (./layers/*.ts) own the add/remove logic per layer
 * type. This hook just diffs the desired state against the previous
 * state and dispatches.
 *
 * Style readiness: layer ops must wait for `map.isStyleLoaded()`. If
 * the user toggles a layer before the style finishes loading, we queue
 * once on the next `style.load` event.
 */

import { useEffect, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { LayerState, WeatherLayerId } from './MapLayerControl';
import { addPrecipitation, removePrecipitation } from './layers/precipitation';
import { addWind, removeWind } from './layers/wind';
import { addCloud, removeCloud } from './layers/cloud';
import { addVisibility, removeVisibility } from './layers/visibility';
import { addSwell, removeSwell } from './layers/swell';
import { addCurrents, removeCurrents } from './layers/currents';

export function useMapLayers(map: mapboxgl.Map | null, state: LayerState): void {
  const prevWeather = useRef<WeatherLayerId | null>(null);
  const prevVisibility = useRef<boolean>(false);
  const prevSwell = useRef<boolean>(false);
  const prevCurrents = useRef<boolean>(false);

  useEffect(() => {
    if (!map) return;

    const apply = () => {
      // Weather (mutex): tear down the previous weather layer when it
      // changes, then add the new one (or leave it null = no overlay).
      const prev = prevWeather.current;
      const next = state.weather;
      if (prev !== next) {
        if (prev) removeWeather(map, prev);
        if (next) addWeather(map, next);
        prevWeather.current = next;
      }
      // Data layers (multi-select).
      if (state.visibility !== prevVisibility.current) {
        if (state.visibility) {
          void addVisibility(map);
        } else {
          removeVisibility(map);
        }
        prevVisibility.current = state.visibility;
      }
      if (state.swell !== prevSwell.current) {
        if (state.swell) {
          addSwell(map);
        } else {
          removeSwell(map);
        }
        prevSwell.current = state.swell;
      }
      if (state.currents !== prevCurrents.current) {
        if (state.currents) {
          addCurrents(map);
        } else {
          removeCurrents(map);
        }
        prevCurrents.current = state.currents;
      }
    };

    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [map, state.weather, state.visibility, state.swell, state.currents]);
}

function addWeather(map: mapboxgl.Map, id: WeatherLayerId): void {
  switch (id) {
    case 'precipitation':
      // Fire-and-forget; the layer module handles its own async fetch.
      void addPrecipitation(map);
      return;
    case 'wind':
      addWind(map);
      return;
    case 'cloud':
      addCloud(map);
      return;
  }
}

function removeWeather(map: mapboxgl.Map, id: WeatherLayerId): void {
  switch (id) {
    case 'precipitation':
      removePrecipitation(map);
      return;
    case 'wind':
      removeWind(map);
      return;
    case 'cloud':
      removeCloud(map);
      return;
  }
}
