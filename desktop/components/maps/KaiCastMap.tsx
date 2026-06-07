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
  /** Marker family. 'spot' (default) is a condition-colored dot;
   *  'boat' is an accent anchor pin used for vessel home berths on the
   *  Charter operating-area map — deliberately a different shape + a
   *  fixed accent treatment so vessels never read as a condition dot.
   *  `tier` is ignored for boats. */
  kind?: 'spot' | 'boat';
}

// White anchor glyph for boat pins. Inlined (no icon font / asset
// pipeline on the map canvas) and stroked white so it reads on the
// accent fill.
const ANCHOR_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="5" r="2.2"/><line x1="12" y1="7.2" x2="12" y2="21"/>' +
  '<path d="M5 12.5a7 7 0 0 0 14 0"/><line x1="3" y1="12.5" x2="5" y2="12.5"/>' +
  '<line x1="19" y1="12.5" x2="21" y2="12.5"/></svg>';

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
  /** Frame the map to fit every marker's coordinate instead of honoring
   *  `center`/`zoom`. Used by the Charter operating-area map so the
   *  viewport always contains both the saved spots AND the vessel home
   *  berths. When true, `center`/`zoom` are used only as the initial
   *  mount position before the fit runs. */
  fitToMarkers?: boolean;
  /** Pixel padding around the fitted bounds. Defaults to 56. */
  fitPadding?: number;
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
  // Coastline — a faint stroke on the water polygon edge traces every
  // island so shapes stay readable when land/water contrast is low.
  // dark-v11 has no dedicated coastline line layer, so we outline the
  // water fill instead. Low-opacity + theme-aware so it defines edges
  // without competing with the condition pins.
  const coast = theme === 'light' ? 'rgba(12,16,21,0.10)' : 'rgba(255,255,255,0.06)';
  // Labels — muted blue-grey in dark so KaiCast pins stay the focal
  // point; theme-aware so light mode keeps its readable token tones.
  const label = theme === 'light' ? c.text3 : '#4A5A6A';
  // NOTE: layer IDs below are verified against the live dark-v11 /
  // light-v11 style specs (Styles API). `landuse` (NOT `landcover`)
  // and `road-simple` (NOT `road-primary`/`road-street`/…) are the
  // real IDs — the old names silently no-op'd. Unknown layers are
  // skipped in the apply loop, so a future style rev won't break.
  return [
    // Land — the `land` layer is dark-v11's background-type layer, so it
    // doubles as the map base AND the island fill. `landColor` collapses
    // the surface tiers into one tone so islands read as a single shape.
    { layer: 'land',                     prop: 'background-color', value: land0 },
    { layer: 'landuse',                  prop: 'fill-color',       value: land0 },
    { layer: 'land-structure-polygon',   prop: 'fill-color',       value: land1 },
    // Water — dark ocean blue. Per-instance `waterColor` overrides the
    // theme default; the Spots map passes a deep navy to read as ocean.
    { layer: 'water',                    prop: 'fill-color',       value: waterColor ?? c.bg },
    { layer: 'water',                    prop: 'fill-outline-color', value: coast },
    // Roads — muted to the land tone; this map is about ocean
    // conditions, not driving. `road-simple` is the real road fill
    // layer in dark-v11 (the old `road-primary`/… IDs don't exist).
    { layer: 'road-simple',              prop: 'line-color',       value: land1 },
    // Labels — muted; markers stay the visual focal point.
    { layer: 'country-label',            prop: 'text-color',       value: label },
    { layer: 'state-label',              prop: 'text-color',       value: label },
    { layer: 'settlement-major-label',   prop: 'text-color',       value: label },
    { layer: 'settlement-minor-label',   prop: 'text-color',       value: label },
    { layer: 'settlement-subdivision-label', prop: 'text-color',   value: label },
    { layer: 'water-point-label',        prop: 'text-color',       value: label },
    { layer: 'water-line-label',         prop: 'text-color',       value: label },
    // POIs (businesses, parks, etc.) don't belong on an ocean-
    // conditions map — hide them outright. City/settlement labels
    // (Lihue, Wailuku, …) are kept but muted above as faint context.
    { layer: 'poi-label',                prop: 'visibility',       value: 'none' },
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
  fitToMarkers = false,
  fitPadding = 56,
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
      console.log('[KCDEBUG] style.load fired; layers=', map.getStyle().layers.length, 'hasWater=', !!map.getStyle().layers.find((l:any)=>l.id==='water'));
      // Read the current theme from the ref so the handler always uses
      // whichever palette is active at the moment style.load fires —
      // setStyle below triggers this same handler asynchronously.
      const overrides = buildStyleOverrides(themeRef.current, waterColorRef.current, landColorRef.current);
      for (const { layer, prop, value } of overrides) {
        try {
          if (prop === 'visibility') {
            // Layout property, not paint — toggles a layer on/off.
            map.setLayoutProperty(layer, 'visibility' as any, value);
          } else if (prop === 'background-color') {
            map.setPaintProperty(layer, 'background-color' as any, value);
          } else if (prop.startsWith('fill-')) {
            map.setPaintProperty(layer, prop as any, value);
          } else if (prop.startsWith('line-')) {
            map.setPaintProperty(layer, prop as any, value);
          } else if (prop.startsWith('text-')) {
            map.setPaintProperty(layer, prop as any, value);
          }
          if (layer === 'water') console.log('[KCDEBUG] set water', prop, '->', value, '| reads', JSON.stringify(map.getPaintProperty('water', prop as any)));
        } catch (e) {
          console.error('[KCDEBUG] FAILED', layer, prop, value, '::', (e as Error).message);
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
    (window as any).__kcmap = map;
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
  // Skipped entirely in fitToMarkers mode — there the fit effect below
  // owns the viewport and a competing easeTo would fight it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitToMarkers) return;
    map.easeTo({ center, zoom, duration: 600 });
  }, [center, zoom, fitToMarkers]);

  // Frame the viewport to all markers (Charter operating-area map).
  // Runs whenever the marker set changes so adding a spot or a vessel
  // berth re-frames to include it. A single marker can't form bounds,
  // so we just center on it at a harbor-scale zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitToMarkers) return;
    const pts = markers.filter((m) => Number.isFinite(m.lng) && Number.isFinite(m.lat));
    if (pts.length === 0) return;
    const run = () => {
      if (pts.length === 1) {
        map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 11, duration: 600 });
        return;
      }
      const bounds = new mapboxgl.LngLatBounds();
      for (const p of pts) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: fitPadding, maxZoom: 12, duration: 600 });
    };
    // fitBounds needs a sized, loaded map — defer to 'load' if the
    // style hasn't settled yet (first mount race).
    if (map.isStyleLoaded()) run();
    else map.once('load', run);
  }, [markers, fitToMarkers, fitPadding]);

  // Theme change → swap the Mapbox style. setStyle fires another
  // style.load, which our handler above uses to reapply overrides
  // with the new palette. Custom data layers added by useMapLayers
  // (visibility heatmap, swell, etc.) are wiped by setStyle and re-
  // added by useMapLayers's own style.load listener.
  //
  // CRITICAL: skip the initial mount run. The map is already
  // constructed with baseStyleFor(theme) in the init effect, so a
  // mount-time setStyle just re-loads the *same* style — and in
  // mapbox-gl v3 that redundant reload races the initial style.load
  // and silently wipes the paint overrides we just applied (water/
  // land snap back to dark-v11 defaults: grey #1F1F1F / #292929).
  // Only react to an actual theme *change*. `diff: false` forces a
  // full reload so style.load reliably re-fires and re-applies.
  const themeMounted = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!themeMounted.current) { themeMounted.current = true; return; }
    map.setStyle(baseStyleFor(theme), { diff: false });
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
    try { map.setPaintProperty('landuse',                'fill-color'       as any, land0); } catch {}
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
  // Native hover tooltip — gives every marker a label on hover without
  // a Mapbox Popup (vessel name on boats, spot name on dots).
  if (m.label) {
    el.setAttribute('aria-label', m.label);
    el.title = m.label;
  }
  el.style.cursor = 'pointer';
  el.style.transition = 'width 120ms ease, height 120ms ease, box-shadow 200ms ease';

  // Boats — accent anchor pin. A rounded tile (not a circle) + the
  // anchor glyph reads as a distinct *kind* of thing from condition
  // dots. Fixed accent fill; never the green/yellow/orange/red tier
  // spectrum.
  if (m.kind === 'boat') {
    const size = selected ? 30 : hovered ? 28 : 24;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '7px';
    el.style.background = colors.accent;
    el.style.border = '2px solid #ffffff';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.boxShadow = selected
      ? `0 0 0 6px color-mix(in srgb, ${colors.accent} 30%, transparent), 0 2px 9px rgba(0,0,0,0.6)`
      : '0 2px 7px rgba(0,0,0,0.55)';
    // Inject the glyph once; hover/select only resizes the tile, so we
    // must not wipe the SVG on every restyle.
    if (el.dataset.kind !== 'boat') {
      el.innerHTML = ANCHOR_SVG;
      el.dataset.kind = 'boat';
    }
    return;
  }

  // Spots — condition-colored dot (default).
  const base = m.tier ? TIER_COLORS[m.tier] : colors.text3;
  const size = selected ? 18 : hovered ? 16 : 13;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '999px';
  el.style.background = base;
  el.style.border = '2px solid #ffffff';
  // color-mix handles CSS variables natively, so this works whether
  // `base` is "#FFD321" or "var(--c-good)". hexToRgba below cannot.
  el.style.boxShadow = selected
    ? `0 0 0 6px color-mix(in srgb, ${base} 28%, transparent), 0 2px 8px rgba(0,0,0,0.55)`
    : '0 2px 6px rgba(0,0,0,0.5)';
}
