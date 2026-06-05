/**
 * KaiCastMap — shared Mapbox GL JS wrapper for the desktop web app.
 *
 * Rendering: Mapbox needs a real DOM <div> for its canvas. We render
 * one via React.createElement('div', …) so the ref attaches cleanly
 * (unstable_createElement from rn-web had inconsistent ref forwarding
 * after the Vite bundle). The div is absolutely positioned to fill its
 * parent — the parent in every callsite is a sized View, so this
 * guarantees the div has real dimensions even when the flex layout's
 * width:'100%'/height:'100%' resolution is squishy.
 *
 * Style: dark-v11 or light-v11 depending on the active KaiCast theme.
 * Land/water/road/label colors are overridden at runtime via
 * setPaintProperty so the map blends with the KaiCast surface
 * palette. Keeping the overrides in code (rather than a hosted
 * custom style) means tokens.ts edits propagate to the map
 * automatically. Theme flips trigger setStyle and re-apply.
 *
 * Pins: colored by 5-tier condition (excellent/great/good/fair/no-go)
 * via TIER_COLORS, or neutral text3 when no tier is provided. Selected
 * pin grows + gets a halo; hovered pin grows subtly.
 */

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { colors, TIER_COLORS, RAW_COLORS_DARK, RAW_COLORS_LIGHT, type ConditionTier } from '../../tokens';
import { MapLayerControl, INITIAL_LAYER_STATE, type LayerState } from './MapLayerControl';
import { useMapLayers } from './useMapLayers';
import { useTheme, type ThemeName } from '../../hooks/useTheme';

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
  /** Mount the floating top-right layer toggle panel. */
  showLayerControl?: boolean;
  /** Expand the layer panel on mount. Pair with `showLayerControl`. */
  layerControlOpenByDefault?: boolean;
  /** Per-instance override for the water-fill color (raw hex). When
   *  set, replaces the theme-default water tint without touching land,
   *  roads, or labels. Persists across theme flips. */
  waterColor?: string;
  /** Per-instance override for the land color (raw hex). Applied to
   *  the land background, landcover fills, and building polygons so
   *  the islands read as a single tone above the water. */
  landColor?: string;
  style?: React.CSSProperties;
}

const DARK_STYLE  = 'mapbox://styles/mapbox/dark-v11';
const LIGHT_STYLE = 'mapbox://styles/mapbox/light-v11';
const baseStyleFor = (theme: ThemeName) => (theme === 'light' ? LIGHT_STYLE : DARK_STYLE);

// Mapbox setPaintProperty values must be raw hex (WebGL — does not
// read DOM CSS variables), so each theme has its own override list.
// Layer IDs are from the dark-v11 / light-v11 style specs; missing
// layers are silently skipped so a future Mapbox style version won't
// break the map.
type StyleOverride = { layer: string; prop: string; value: string };
const buildStyleOverrides = (theme: ThemeName, waterColor?: string, landColor?: string): StyleOverride[] => {
  const c = theme === 'light' ? RAW_COLORS_LIGHT : RAW_COLORS_DARK;
  const land0 = landColor ?? c.surface0;
  const land1 = landColor ?? c.surface1;
  return [
    // Land — blend into KaiCast surface so the map doesn't feel like a
    // foreign element pasted onto the page. `landColor` collapses both
    // surface tiers into one tone so islands read as a single shape.
    { layer: 'land',                     prop: 'background-color', value: land0 },
    { layer: 'landcover',                prop: 'fill-color',       value: land0 },
    { layer: 'land-structure-polygon',   prop: 'fill-color',       value: land1 },
    // Water — slightly tinted so islands read as raised against the sea.
    // Per-instance `waterColor` prop overrides the theme default; used
    // on the Spots map to match the surrounding panel background.
    { layer: 'water',                    prop: 'fill-color',       value: waterColor ?? c.bg },
    // Roads — muted; this map is about ocean conditions, not driving.
    { layer: 'road-primary',             prop: 'line-color',       value: c.surface2 },
    { layer: 'road-secondary-tertiary',  prop: 'line-color',       value: c.surface2 },
    { layer: 'road-street',              prop: 'line-color',       value: c.surface2 },
    { layer: 'road-minor',               prop: 'line-color',       value: c.surface2 },
    // Labels — text3/text4 so KaiCast pins stay the visual focal point.
    { layer: 'country-label',            prop: 'text-color',       value: c.text3 },
    { layer: 'settlement-major-label',   prop: 'text-color',       value: c.text3 },
    { layer: 'settlement-minor-label',   prop: 'text-color',       value: c.text4 },
    { layer: 'water-point-label',        prop: 'text-color',       value: c.text4 },
    { layer: 'water-line-label',         prop: 'text-color',       value: c.text4 },
  ];
};

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
  showLayerControl = false,
  layerControlOpenByDefault = false,
  waterColor,
  landColor,
  style,
}: KaiCastMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  // Layer toggle state lives here so KaiCastMap can drive the layer
  // controller via useMapLayers (which adds/removes Mapbox sources).
  const [layerState, setLayerState] = React.useState<LayerState>(INITIAL_LAYER_STATE);
  // Bumped when the map instance finishes initializing — forces a
  // re-render so useMapLayers sees the non-null mapRef.current.
  const [, setMapVersion] = React.useState(0);
  // Live theme — drives basemap style (dark-v11 ↔ light-v11) and the
  // STYLE_OVERRIDES variant we reapply on every style.load.
  const { theme } = useTheme();
  const themeRef = useRef<ThemeName>(theme);
  themeRef.current = theme;
  // Mirror waterColor + landColor into refs so the style.load handler
  // (which fires again after every theme flip via setStyle) picks up
  // the latest values without depending on stale closure state.
  const waterColorRef = useRef<string | undefined>(waterColor);
  waterColorRef.current = waterColor;
  const landColorRef = useRef<string | undefined>(landColor);
  landColorRef.current = landColor;
  useMapLayers(mapRef.current, layerState);

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
      style: baseStyleFor(themeRef.current),
      center,
      zoom,
      interactive,
      attributionControl: false,
      cooperativeGestures: false,
    });

    if (showZoomControls) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
    }

    // Compact attribution: Mapbox + OSM by default; data layers
    // (RainViewer, OWM, etc.) append their attribution via the source
    // config and Mapbox merges them in.
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left',
    );

    map.on('style.load', () => {
      // Read the current theme from the ref so the handler always uses
      // whichever palette is active at the moment style.load fires —
      // setStyle below triggers this same handler asynchronously.
      const overrides = buildStyleOverrides(themeRef.current, waterColorRef.current, landColorRef.current);
      for (const { layer, prop, value } of overrides) {
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

    // Suppress tile-fetch errors from third-party raster overlays
    // (NDFD, OWM, PacIOOS) — when a tile bbox falls outside coverage
    // those servers return an error PNG or text body that Mapbox
    // surfaces as a noisy "Error: ..." event. We log a single warning
    // so dev still sees them, but stop them from bubbling to the page.
    map.on('error', (e) => {
      const msg = (e as { error?: Error }).error?.message ?? '';
      if (
        msg.toLowerCase().includes('invalid tms') ||
        msg.toLowerCase().includes('tile') ||
        msg.includes('AbortError')
      ) {
        // expected — out-of-coverage / canceled tile fetch
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[kaicast-map]', msg || e);
    });

    mapRef.current = map;
    // Bump mapVersion so dependents (useMapLayers) re-evaluate now
    // that mapRef.current is non-null. Without this the ref mutation
    // alone won't trigger a re-render.
    setMapVersion((v) => v + 1);

    // Resize observer: Mapbox needs an explicit map.resize() whenever
    // its container's dimensions change. Without it the canvas stays
    // at its initial size — sidebar collapse, alert dismiss, window
    // resize, devtools toggle, etc. all leave the canvas stale.
    // ResizeObserver fires synchronously on a separate task, so we
    // don't need to dedupe — Mapbox's own resize is cheap.
    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObs = new ResizeObserver(() => {
        // Guard: the map may have been removed by the time the
        // observer fires (component unmount race).
        if (mapRef.current) mapRef.current.resize();
      });
      resizeObs.observe(containerRef.current);
    }

    return () => {
      if (resizeObs) resizeObs.disconnect();
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

  // Theme change → swap the Mapbox style. setStyle fires another
  // style.load, which our handler above uses to reapply overrides
  // with the new palette. Custom data layers added by useMapLayers
  // (visibility heatmap, swell, etc.) are wiped by setStyle and re-
  // added by useMapLayers's own style.load listener.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(baseStyleFor(theme));
  }, [theme]);

  // Re-apply water + land fills when the per-instance overrides change
  // at runtime without remounting. setStyle wipes overrides on theme
  // change, but a plain color swap doesn't, so these targeted calls
  // are safe + cheap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const c = themeRef.current === 'light' ? RAW_COLORS_LIGHT : RAW_COLORS_DARK;
    try { map.setPaintProperty('water', 'fill-color' as any, waterColor ?? c.bg); } catch {}
  }, [waterColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const c = themeRef.current === 'light' ? RAW_COLORS_LIGHT : RAW_COLORS_DARK;
    const land0 = landColor ?? c.surface0;
    const land1 = landColor ?? c.surface1;
    try { map.setPaintProperty('land',                   'background-color' as any, land0); } catch {}
    try { map.setPaintProperty('landcover',              'fill-color'       as any, land0); } catch {}
    try { map.setPaintProperty('land-structure-polygon', 'fill-color'       as any, land1); } catch {}
  }, [landColor]);

  // Wrapper div hosts the absolutely-positioned map canvas + any
  // overlays (layer control, etc.). The wrapper itself fills the
  // parent View via inset:0; both wrapper and inner canvas are
  // absolutely positioned, which makes the wrapper the containing
  // block for any further absolute overlays we add later.
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: colors.surface0,
        ...style,
      },
    },
    React.createElement('div', {
      key: 'canvas',
      ref: containerRef,
      style: { position: 'absolute', inset: 0 },
    }),
    showLayerControl
      ? React.createElement(MapLayerControl, {
          key: 'layers',
          state: layerState,
          onChange: setLayerState,
          defaultOpen: layerControlOpenByDefault,
        })
      : null,
  );
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
  // color-mix handles CSS variables natively, so this works whether
  // `base` is "#FFD321" or "var(--c-good)". hexToRgba below cannot.
  el.style.boxShadow = selected
    ? `0 0 0 6px color-mix(in srgb, ${base} 28%, transparent), 0 2px 8px rgba(0,0,0,0.55)`
    : '0 2px 6px rgba(0,0,0,0.5)';
  if (m.label) el.setAttribute('aria-label', m.label);
}
