/**
 * KaiCastMap — shared Mapbox GL JS wrapper for the desktop web app.
 *
 * Rendering: Mapbox needs a real DOM <div> for its canvas. React Native's
 * <View> doesn't expose a stable DOM ref, so we use react-native-web's
 * unstable_createElement to mount a div directly. This component is web-
 * only — importing it in a native build will throw.
 *
 * Style: starts from `mapbox://styles/mapbox/dark-v11` and overrides
 * land/water/road/label colors at runtime via setPaintProperty so the
 * map blends with the KaiCast surface palette. Keeping the overrides
 * in code (rather than a hosted custom style) means tokens.ts edits
 * propagate to the map automatically.
 *
 * Pins: colored by 5-tier condition (excellent/great/good/fair/no-go)
 * via TIER_COLORS, or neutral text3 when no tier is provided. Selected
 * pin grows + gets a halo; hovered pin grows subtly.
 */

import React, { useEffect, useRef } from 'react';
// react-native-web exposes unstable_createElement as a top-level export,
// not via the public RN type surface — hence the require dance.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { unstable_createElement } = require('react-native-web');
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { colors, radius, TIER_COLORS, type ConditionTier } from '../../tokens';

// Vite injects this at build time. If absent, the map renders an empty
// surface + logs a warning — see desktop/.env.example for setup.
const TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN as string | undefined;

// Hawaiian archipelago — center between O'ahu and Maui, zoom shows all
// main islands at 1440px container width.
export const HAWAII_CENTER: [number, number] = [-157.5, 20.5];
export const HAWAII_ZOOM = 6.8;

export interface MapMarker {
  id: string;
  lng: number;
  lat: number;
  /** Color by 5-tier condition. Omit for neutral pin. */
  tier?: ConditionTier;
  label?: string;
}

export interface KaiCastMapProps {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
  /** Selected marker id — grows pin + adds halo. */
  selectedId?: string;
  /** Hovered marker id — subtle grow. */
  hoveredId?: string;
  onMarkerClick?: (id: string) => void;
  /** Fires for clicks on empty map (not on a marker). */
  onMapClick?: (lng: number, lat: number) => void;
  /** Show Mapbox's built-in +/- zoom buttons in the top-right. */
  showZoomControls?: boolean;
  /** Disable pan/zoom/rotate. Use for glance-only surfaces (Dashboard). */
  interactive?: boolean;
  style?: React.CSSProperties;
}

const BASE_STYLE = 'mapbox://styles/mapbox/dark-v11';

// Layer-color overrides applied on every style load. Layer IDs are from
// the dark-v11 style spec; missing layers are silently skipped so a
// future Mapbox style version won't break the map.
const STYLE_OVERRIDES: Array<{ layer: string; prop: string; value: string }> = [
  // Land — blend into KaiCast surface so the map doesn't feel like a
  // foreign element pasted onto the page.
  { layer: 'land',                     prop: 'background-color', value: colors.surface0 },
  { layer: 'landcover',                prop: 'fill-color',       value: colors.surface0 },
  { layer: 'land-structure-polygon',   prop: 'fill-color',       value: colors.surface1 },
  // Water — slightly darker so islands read as raised against the sea.
  { layer: 'water',                    prop: 'fill-color',       value: colors.bg },
  // Roads — muted; this map is about ocean conditions, not driving.
  { layer: 'road-primary',             prop: 'line-color',       value: colors.surface2 },
  { layer: 'road-secondary-tertiary',  prop: 'line-color',       value: colors.surface2 },
  { layer: 'road-street',              prop: 'line-color',       value: colors.surface2 },
  { layer: 'road-minor',               prop: 'line-color',       value: colors.surface2 },
  // Labels — text3/text4 so KaiCast pins stay the visual focal point.
  { layer: 'country-label',            prop: 'text-color',       value: colors.text3 },
  { layer: 'settlement-major-label',   prop: 'text-color',       value: colors.text3 },
  { layer: 'settlement-minor-label',   prop: 'text-color',       value: colors.text4 },
  { layer: 'water-point-label',        prop: 'text-color',       value: colors.text4 },
  { layer: 'water-line-label',         prop: 'text-color',       value: colors.text4 },
];

export function KaiCastMap({
  markers = [],
  center = HAWAII_CENTER,
  zoom = HAWAII_ZOOM,
  selectedId,
  hoveredId,
  onMarkerClick,
  onMapClick,
  showZoomControls = true,
  interactive = true,
  style,
}: KaiCastMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

  // Init once. Subsequent prop changes are handled by the targeted
  // effects below — re-running this effect would tear down the map.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) {
      // eslint-disable-next-line no-console
      console.warn('[KaiCastMap] VITE_MAPBOX_TOKEN missing — copy desktop/.env.example to desktop/.env');
      return;
    }
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center,
      zoom,
      interactive,
      attributionControl: false,
      cooperativeGestures: false,
    });

    if (showZoomControls) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
    }

    map.on('style.load', () => {
      for (const { layer, prop, value } of STYLE_OVERRIDES) {
        try {
          if (prop === 'background-color') {
            map.setPaintProperty(layer, 'background-color' as any, value);
          } else if (prop.startsWith('fill-')) {
            map.setPaintProperty(layer, prop as any, value);
          } else if (prop.startsWith('line-')) {
            map.setPaintProperty(layer, prop as any, value);
          } else if (prop.startsWith('text-')) {
            map.setPaintProperty(layer, prop as any, value);
          }
        } catch {
          // Layer missing from current style — skip without noise.
        }
      }
    });

    map.on('click', (e) => {
      const target = e.originalEvent.target as HTMLElement | null;
      if (target?.closest('.kaicast-marker')) return;
      onMapClick?.(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers — add new, remove stale, restyle existing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = new Set(markers.map((m) => m.id));
    for (const id of Object.keys(markersRef.current)) {
      if (!incoming.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }

    for (const m of markers) {
      const existing = markersRef.current[m.id];
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
        applyMarkerStyle(existing.getElement() as HTMLDivElement, m, selectedId === m.id, hoveredId === m.id);
      } else {
        const el = document.createElement('div');
        el.className = 'kaicast-marker';
        applyMarkerStyle(el, m, selectedId === m.id, hoveredId === m.id);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerClick?.(m.id);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        markersRef.current[m.id] = marker;
      }
    }
  }, [markers, selectedId, hoveredId, onMarkerClick]);

  // Sync center/zoom when they change externally (e.g. focus on cluster).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center, zoom, duration: 600 });
  }, [center, zoom]);

  return unstable_createElement('div', {
    ref: containerRef,
    style: {
      width: '100%',
      height: '100%',
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.surface0,
      ...style,
    },
  });
}

function applyMarkerStyle(
  el: HTMLDivElement,
  m: MapMarker,
  selected: boolean,
  hovered: boolean,
) {
  const base = m.tier ? TIER_COLORS[m.tier] : colors.text3;
  const size = selected ? 18 : hovered ? 16 : 13;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '999px';
  el.style.background = base;
  el.style.border = '2px solid #ffffff';
  el.style.cursor = 'pointer';
  el.style.transition = 'width 120ms ease, height 120ms ease, box-shadow 200ms ease';
  el.style.boxShadow = selected
    ? `0 0 0 6px ${hexToRgba(base, 0.28)}, 0 2px 8px rgba(0,0,0,0.55)`
    : '0 2px 6px rgba(0,0,0,0.5)';
  if (m.label) el.setAttribute('aria-label', m.label);
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
