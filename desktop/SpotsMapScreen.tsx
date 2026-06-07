import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH, TIER_COLORS, TIER_LABELS, type ConditionTier } from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { ConditionPill } from './components/ConditionPill';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from './components/maps/KaiCastMap';
import { useBreakpoint, pick } from './hooks/useBreakpoint';
import { useFavorites } from './hooks/useFavorites';
import { FavoriteButton } from './components/FavoriteButton';
import { SPOTS as CANONICAL_SPOTS } from './data/spots';
import { useSpotRatings, useSpotReport, tierFromRating, type BackendReport } from './data/getReport';
import { useSpotAlerts } from './data/spotAlerts';
import { SpotAlerts } from './components/SpotAlerts';
import type { NavigateFn } from './router';

/**
 * Spots & Maps — desktop screen (Figma 444:1787).
 *
 * Layout:
 *   - DesktopNav (Spots & Maps active)
 *   - Runoff alert banner (full width)
 *   - 3-col grid: 300px spot list | fluid map | 320px selected-spot panel
 *
 * The center map is a real Mapbox GL JS surface via KaiCastMap. Sidebar
 * rows and pin markers are bidirectionally synced — click in either
 * surface to select; hovering a sidebar row pulses the matching pin.
 */

// ─── Mock data ────────────────────────────────────────────────────────────

type SidebarSpot = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  rating?: ConditionTier;
  runoff?: boolean;
};

// Build the sidebar islands list straight from the canonical SPOTS
// list so map markers + satellite hero on Spot Detail can never
// disagree (they used to render in different places because each
// surface had its own hardcoded coord list). Ratings are filled in
// at runtime by useSpotRatings (per-spot live getReport calls).
function buildIslandsFromCanonical(): Array<{ name: string; count: number; spots: SidebarSpot[] }> {
  const groups = new Map<string, SidebarSpot[]>();
  for (const s of CANONICAL_SPOTS) {
    const arr = groups.get(s.region) ?? [];
    arr.push({
      id: s.id,
      name: s.name,
      region: `${s.region} · Shore`,
      lat: s.lat,
      lng: s.lon,
    });
    groups.set(s.region, arr);
  }
  // Stable display order: Oahu, Maui, Kauai, Big Island, then any others.
  const ORDER = ['Oahu', 'Maui', 'Kauai', 'Big Island'];
  const LABEL: Record<string, string> = { Oahu: "O'ahu", Maui: 'Maui', Kauai: "Kaua'i", 'Big Island': 'Big Island' };
  const list: Array<{ name: string; count: number; spots: SidebarSpot[] }> = [];
  for (const region of ORDER) {
    const spots = groups.get(region);
    if (!spots) continue;
    list.push({ name: LABEL[region] ?? region, count: spots.length, spots });
    groups.delete(region);
  }
  for (const [region, spots] of groups) {
    list.push({ name: region, count: spots.length, spots });
  }
  return list;
}
const ISLANDS = buildIslandsFromCanonical();

const SELECTED_SPOT = {
  name: 'Electric Beach',
  region: "O'AHU · 21.354°N, 158.118°W",
  distance: '· 4.2 MI AWAY',
  rating: 'excellent' as ConditionTier,
  metrics: [
    { label: 'Visibility',  value: '56',  unit: 'FT',  caption: 'Excellent clarity', captionTone: colors.great },
    { label: 'Water temp',  value: '79',  unit: '°F',  caption: '3mm wetsuit',       captionTone: colors.text3 },
    { label: 'Wave height', value: '3',   unit: 'FT',  caption: 'WNW · 9s swell',    captionTone: colors.text3 },
    { label: 'Wind',        value: '15',  unit: 'MPH', caption: 'NE · 20 gust',      captionTone: colors.text3 },
    { label: 'Current',     value: '1',   unit: 'KT',  caption: 'Non-existent',      captionTone: colors.text3 },
    { label: 'Tide',        value: '1.1', unit: 'FT',  caption: '↑ Rising',          captionTone: colors.great },
  ],
};

// 8 segments matching the Figma's best-window bar (red → azure peak → fade).
const BEST_WINDOW_BAR: ConditionTier[] = [
  'no-go', 'fair', 'good', 'great', 'excellent', 'excellent', 'great', 'good',
];

const FRIENDS = [
  { initials: 'KM', name: 'Kai M.',     activity: 'at Electric Beach · Freediving',   when: 'NOW' },
  { initials: 'LS', name: 'Leilani S.', activity: 'at Molokini · Scuba · 60ft',       when: '14M' },
  { initials: 'MH', name: 'Marcus H.',  activity: "at Shark's Cove · Spearfishing",   when: '32M' },
];

// Sidebar "Favorites" tab is now powered by the per-user useFavorites
// hook (localStorage-backed). The Sidebar component reads from it
// directly via favs.isFavorite(spot.id) in matchTab().

// "Nearby" cutoff for the Nearby tab. Distance is parsed out of the
// region string ("Leeward · 4.2 mi · ⚠ Runoff") since the data is flat
// strings, not structured fields.
const NEARBY_MAX_MI = 15;

function parseMiles(region: string): number | null {
  const m = region.match(/(\d+(?:\.\d+)?)\s*mi/i);
  return m ? Number(m[1]) : null;
}

const STATUS_BAR_TIERS: Array<{ tier: ConditionTier; count: number; label: string }> = [
  { tier: 'excellent', count: 5,  label: 'Excellent' },
  { tier: 'great',     count: 12, label: 'Great' },
  { tier: 'good',      count: 18, label: 'Good' },
  { tier: 'fair',      count: 9,  label: 'Fair' },
  { tier: 'no-go',     count: 3,  label: 'No-go' },
];

// ─── Screen ───────────────────────────────────────────────────────────────

export interface SpotsMapScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function SpotsMapScreen({ activeNav = 'spots', onNavigate }: SpotsMapScreenProps) {
  const bp = useBreakpoint();
  const sidebarW = pick(bp, 300, 260);
  const panelW = pick(bp, 320, 280);
  // Track viewport width so we can pick between viewport-locked layout
  // (≥1080px — sidebar + fixed-height map + right panel all on screen
  // at once) and a scrolling stacked layout (<1080px — map gets a
  // bounded fixed height; page scroll below it works normally).
  const { width: vpWidth } = useWindowDimensions();
  const wideLayout = vpWidth >= 1080;
  const [tab, setTab] = React.useState<'All' | 'Favorites' | 'Nearby'>('All');
  const [search, setSearch] = React.useState('');
  // Selection is keyed by spot name (the data has no stable id field).
  const [selectedName, setSelectedName] = React.useState<string>('Electric Beach');
  const [hoveredName, setHoveredName] = React.useState<string | undefined>(undefined);
  // Dismissal state for alerts is now per-alert and lives inside
  // AlertBanner — the whole banner hides when no alerts are active.

  // Wide layout only: clamp html AND body to a single viewport so the
  // 3-col grid can't push the document past it. The map column was
  // growing vertical because the sidebar's long spot list let the
  // document scroll, and the grid row was tracking the tallest column.
  // Locking body height kills that scroll entirely; locking overflow
  // hidden kills any residual scroll triggered by inner content.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!wideLayout) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlHeight: html.style.height,
      htmlOverflow: html.style.overflow,
      bodyHeight: body.style.height,
      bodyOverflow: body.style.overflow,
      bodyMargin: body.style.margin,
    };
    html.style.height = '100vh';
    html.style.overflow = 'hidden';
    body.style.height = '100vh';
    body.style.overflow = 'hidden';
    body.style.margin = '0';
    return () => {
      html.style.height = prev.htmlHeight;
      html.style.overflow = prev.htmlOverflow;
      body.style.height = prev.bodyHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.margin = prev.bodyMargin;
    };
  }, [wideLayout]);

  // Measure the chrome (nav + alert) so we can set bodyFixed's height
  // to calc(100vh - chromeHeight). Using a ref + onLayout means we
  // adapt automatically when the alert is dismissed (banner unmounts,
  // chrome shrinks, bodyFixed grows — the grid row follows).
  const [chromeHeight, setChromeHeight] = React.useState<number>(140);

  // Flat list of every spot — used by the map (always shows all pins,
  // sidebar filtering only affects the list panel).
  const baseSpots = React.useMemo(
    () => ISLANDS.flatMap((i) => i.spots),
    [],
  );

  // Live conditions tier per spot — one getReport call per id, cached.
  const allSpotIds = React.useMemo(() => baseSpots.map((s) => s.id), [baseSpots]);
  const liveRatings = useSpotRatings(allSpotIds);

  // Apply live ratings on top of the base sidebar spots.
  const allSpots = React.useMemo(
    () => baseSpots.map((s) => ({ ...s, rating: liveRatings.get(s.id) ?? s.rating })),
    [baseSpots, liveRatings],
  );

  const selectedSpot = React.useMemo(
    () => allSpots.find((s) => s.name === selectedName),
    [allSpots, selectedName],
  );

  const mapMarkers: MapMarker[] = React.useMemo(
    () =>
      allSpots.map((s) => ({
        id: s.name,
        lng: s.lng,
        lat: s.lat,
        tier: s.rating,
        label: s.name,
      })),
    [allSpots],
  );

  return (
    <View style={[styles.page, wideLayout && styles.pageFixed]}>
      {/* Nav + (dismissable) banner stack at the top. onLayout reports
          the combined height so bodyFixed can sit exactly underneath
          via calc(100vh - chromeHeight). */}
      <View
        style={styles.chromeStack}
        onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}
      >
        <DesktopNav active={activeNav} onNavigate={onNavigate} />
        <AlertBanner spotIds={allSpotIds} />
      </View>

      {/* Wide layout (≥1080px): real CSS Grid with three columns
          (sidebarW · 1fr · panelW). The grid wrapper takes the rest
          of the viewport (flex:1 inside pageFixed) and uses
          overflow:hidden so only the inner columns scroll, never
          the document. Each column gets its own scroll surface.
          Narrow: body laid out vertically with bounded map height +
          ScrollView — whole page scrolls naturally. */}
      <View
        style={
          wideLayout
            ? ([
                styles.bodyFixed,
                // Hard-pin to the viewport via position:fixed with an
                // explicit pixel height. This stops the grid row from
                // ever tracking the sidebar's content height (the root
                // cause of the "super-tall map" symptom — flex:1 +
                // overflow:hidden weren't enough because RN's default
                // flex-shrink:0 let the body row grow past pageFixed).
                //
                // gridTemplateRows: '1fr' makes the row fill exactly
                // the wrapper height — without it the row falls back
                // to content-sized auto and the map cell stretches.
                {
                  position: 'fixed',
                  top: chromeHeight,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'grid',
                  gridTemplateColumns: `${sidebarW}px 1fr ${panelW}px`,
                  gridTemplateRows: '1fr',
                } as unknown as object,
              ] as object)
            : styles.bodyNarrow
        }
      >
        <View style={wideLayout ? { height: '100%' } : { width: '100%' }}>
          <Sidebar
            tab={tab}
            onTab={setTab}
            search={search}
            onSearch={setSearch}
            selectedName={selectedName}
            onSelect={setSelectedName}
            onHover={setHoveredName}
            onNavigate={onNavigate}
            ratings={liveRatings}
          />
        </View>
        {wideLayout ? (
          <MapColumn
            markers={mapMarkers}
            selectedName={selectedName}
            hoveredName={hoveredName}
            onSelect={setSelectedName}
            sidebarW={sidebarW}
            panelW={panelW}
          />
        ) : (
          // Narrow viewport: render the map as a normal in-flow
          // block with a bounded height so it doesn't dominate the
          // page. The MapColumn variants that fit absolutely into
          // bodyFixed don't work here, so wrap KaiCastMap directly.
          <View style={styles.mapColumnNarrow}>
            <MapColumn
              markers={mapMarkers}
              selectedName={selectedName}
              hoveredName={hoveredName}
              onSelect={setSelectedName}
              sidebarW={0}
              panelW={0}
              narrow
            />
          </View>
        )}
        <View style={wideLayout ? { height: '100%' } : { width: '100%' }}>
          <ScrollView
            style={wideLayout ? styles.panelScroll : undefined}
            contentContainerStyle={wideLayout ? styles.panelScrollContent : undefined}
            showsVerticalScrollIndicator={false}
            scrollEnabled={wideLayout}
          >
            <SelectedSpotPanel spot={selectedSpot} onNavigate={onNavigate} />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────
//
// Reads live alerts from /spot_alerts for every spot in the user's
// island list. If zero active alerts, the banner hides entirely — no
// placeholder copy. Highest-priority alert (per spotAlerts.ts ranking)
// wins the slot. Dismissal is per-session and per-alert; reopens on
// next page load (intentional — tsunami/shark/box-jelly are too
// important to permanently silence with one click).

function AlertBanner({ spotIds }: { spotIds: string[] }) {
  const alerts = useSpotAlerts(spotIds);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const visible = alerts.filter((a) => !dismissed.has(a.alertId));
  if (visible.length === 0) return null;
  const top = visible[0];

  // Color tone per severity. Life-safety urgent uses the hazard red.
  const toneStyle = top.severity === 'urgent' ? styles.alertBannerUrgent
    : top.severity === 'warning' ? styles.alertBannerWarning
    : top.severity === 'advisory' ? styles.alertBannerAdvisory
    : styles.alertBanner;
  const dotColor = top.severity === 'urgent' ? colors.nogo
    : top.severity === 'warning' ? colors.fair
    : top.severity === 'advisory' ? colors.fair
    : colors.accent;

  // Show a "+N more" tail if multiple alerts are active.
  const more = visible.length > 1 ? ` · +${visible.length - 1} more` : '';

  return (
    <View style={toneStyle}>
      <View style={[styles.alertDot, { backgroundColor: dotColor }]} />
      <Text style={styles.alertText}>
        <Text style={{ color: colors.text1, fontWeight: '600' }}>{top.title}</Text>
        <Text>{' — '}{top.body}</Text>
        {top.sourceUrl ? <Text style={styles.alertLink}>{' Learn more'}</Text> : null}
        {more ? <Text style={styles.alertMeta}>{more}</Text> : null}
      </Text>
      <View style={styles.alertSpacer} />
      <Pressable onPress={() => setDismissed(new Set([...dismissed, top.alertId]))} hitSlop={6}>
        <Text style={styles.alertDismiss}>DISMISS ×</Text>
      </Pressable>
    </View>
  );
}

// ─── Left: sidebar ────────────────────────────────────────────────────────

function Sidebar({
  tab,
  onTab,
  search,
  onSearch,
  selectedName,
  onSelect,
  onHover,
  onNavigate,
  ratings,
}: {
  tab: 'All' | 'Favorites' | 'Nearby';
  onTab: (t: 'All' | 'Favorites' | 'Nearby') => void;
  search: string;
  onSearch: (s: string) => void;
  selectedName: string;
  onSelect: (name: string) => void;
  onHover: (name: string | undefined) => void;
  onNavigate?: NavigateFn;
  ratings: Map<string, ConditionTier>;
}) {
  const q = search.trim().toLowerCase();
  const favs = useFavorites();

  const matchTab = (spot: SidebarSpot): boolean => {
    if (tab === 'Favorites') return favs.isFavorite(spot.id);
    if (tab === 'Nearby') {
      const mi = parseMiles(spot.region);
      return mi !== null && mi <= NEARBY_MAX_MI;
    }
    return true;
  };

  const matchSearch = (spot: SidebarSpot): boolean => {
    if (q === '') return true;
    return (
      spot.name.toLowerCase().includes(q) ||
      spot.region.toLowerCase().includes(q)
    );
  };

  // Merge live ratings into each spot before filtering so the pills
  // in each sidebar row reflect the real `getReport` tier rather than
  // the static placeholder the data layer ships with.
  const filteredIslands = ISLANDS
    .map((island) => ({
      ...island,
      spots: island.spots
        .map((s) => ({ ...s, rating: ratings.get(s.id) ?? s.rating }))
        .filter((s) => matchTab(s) && matchSearch(s)),
    }))
    .filter((island) => island.spots.length > 0);

  const totalShown = filteredIslands.reduce((n, i) => n + i.spots.length, 0);

  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarSearch}>
        <Text style={styles.sidebarSearchIcon}>⌕</Text>
        <TextInput
          placeholder="Filter spots…"
          placeholderTextColor={colors.text4}
          style={[styles.sidebarSearchInput, { outlineStyle: 'none' } as object]}
          value={search}
          onChangeText={onSearch}
        />
        {search ? (
          <Pressable onPress={() => onSearch('')} hitSlop={6}>
            <Text style={styles.sidebarSearchClear}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sidebarTabs}>
        {(['All', 'Favorites', 'Nearby'] as const).map((t) => {
          const isActive = t === tab;
          return (
            <Pressable key={t} onPress={() => onTab(t)} style={styles.sidebarTab}>
              <Text style={[styles.sidebarTabText, isActive && styles.sidebarTabTextActive]}>{t}</Text>
              {isActive ? <View style={styles.sidebarTabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.sidebarList} contentContainerStyle={{ paddingBottom: 24 }}>
        {totalShown === 0 ? (
          <View style={styles.sidebarEmpty}>
            <Text style={styles.sidebarEmptyTitle}>No spots match</Text>
            <Text style={styles.sidebarEmptySub}>
              {q ? `Nothing matches "${search.trim()}"` : 'Try a different tab.'}
            </Text>
          </View>
        ) : (
          filteredIslands.map((island) => (
            <View key={island.name}>
              <View style={styles.islandHeader}>
                <Text style={styles.islandHeaderName}>{island.name}</Text>
                <Text style={styles.islandHeaderCount}>
                  {island.spots.length} of {island.count} spots
                </Text>
              </View>
              {island.spots.map((s) => (
                <SidebarSpotRow
                  key={s.name}
                  spot={s}
                  selected={s.name === selectedName}
                  onSelect={() => onSelect(s.name)}
                  onHoverIn={() => onHover(s.name)}
                  onHoverOut={() => onHover(undefined)}
                  onOpen={() => onNavigate?.('spot-detail', { spotId: slugify(s.name) })}
                  onNavigate={onNavigate}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function SidebarSpotRow({
  spot,
  selected,
  onSelect,
  onHoverIn,
  onHoverOut,
  onOpen,
  onNavigate,
}: {
  spot: SidebarSpot;
  selected: boolean;
  onSelect: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onOpen: () => void;
  onNavigate?: NavigateFn;
}) {
  // Single press selects (syncs map pin); double press / second tap on
  // already-selected row opens the spot detail page.
  const onPress = selected ? onOpen : onSelect;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={[styles.spotRow, selected && styles.spotRowSelected]}
    >
      {selected ? <View style={styles.spotRowSelectedBar} /> : null}
      <View
        style={[
          styles.spotRowDot,
          { backgroundColor: spot.rating ? TIER_COLORS[spot.rating] : colors.text4 },
        ]}
      />
      <View style={styles.spotRowText}>
        <Text style={styles.spotRowName}>{spot.name}</Text>
        <Text style={styles.spotRowRegion}>{spot.region}</Text>
      </View>
      {spot.rating ? (
        <ConditionPill tier={spot.rating} size="sm" label={shortTier(spot.rating)} />
      ) : null}
      {/* Favorite control moved to the SelectedSpotPanel header — one
          per panel rather than one per row. Keeps the list scannable
          and stops the favorite icon from competing with the
          condition pill on every line. */}
    </Pressable>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function shortTier(t: ConditionTier): string {
  switch (t) {
    case 'excellent': return 'EXC';
    case 'great':     return 'GREAT';
    case 'good':      return 'GOOD';
    case 'fair':      return 'FAIR';
    case 'no-go':     return 'NO-GO';
  }
}

// ─── Center: map ──────────────────────────────────────────────────────────

function MapColumn({
  markers,
  selectedName,
  hoveredName,
  onSelect,
  sidebarW,
  panelW,
  narrow = false,
}: {
  markers: MapMarker[];
  selectedName: string;
  hoveredName?: string;
  onSelect: (name: string) => void;
  sidebarW: number;
  panelW: number;
  /** Render in-flow with the narrow-viewport bounded-height style
   *  instead of the absolute-positioned viewport-locked variant. */
  narrow?: boolean;
}) {
  // When the user clicks a sidebar spot, re-center the map on it. We
  // intentionally keep zoom modest so the surrounding archipelago stays
  // visible — diving decisions are spatial, not pinpoint.
  const selectedMarker = markers.find((m) => m.id === selectedName);
  const center: [number, number] = selectedMarker
    ? [selectedMarker.lng, selectedMarker.lat]
    : HAWAII_CENTER;
  const zoom = selectedMarker ? 9.5 : HAWAII_ZOOM;

  return (
    <View style={narrow ? { flex: 1, position: 'relative' } : styles.mapColumn}>
      <KaiCastMap
        markers={markers}
        center={center}
        zoom={zoom}
        selectedId={selectedName}
        hoveredId={hoveredName}
        onMarkerClick={onSelect}
        showZoomControls
        showLayerControl
        layerControlOpenByDefault
        waterColor="#0B1015"
        landColor="#11202E"
        style={{ backgroundColor: '#0B1015' }}
      />

      {/* Bottom status bar — absolute overlay above the map canvas. */}
      <View style={styles.mapStatusBar}>
        {STATUS_BAR_TIERS.map((s, i) => (
          <React.Fragment key={s.tier}>
            <View style={styles.mapStatusChip}>
              <View style={[styles.mapStatusDot, { backgroundColor: TIER_COLORS[s.tier] }]} />
              <Text style={styles.mapStatusText}>{s.count} {s.label}</Text>
            </View>
            {i < STATUS_BAR_TIERS.length - 1 ? <View style={styles.mapStatusDivider} /> : null}
          </React.Fragment>
        ))}
        <View style={styles.mapStatusSpacer} />
        <Text style={styles.mapStatusUpdated}>Updated 2 min ago · Wed Apr 15 · 2:47 PM HST</Text>
      </View>
    </View>
  );
}

// ─── Right: selected spot panel ───────────────────────────────────────────

function SelectedSpotPanel({
  spot,
  onNavigate,
}: {
  spot?: SidebarSpot;
  onNavigate?: NavigateFn;
}) {
  // Use the spot's canonical id (matches Firestore `spots/`) — slugify
  // on the name loses fidelity for spots like "Shark's Cove" or
  // "Mokulua Islands (the Mokes)", which made the panel fall back to
  // the static SELECTED_SPOT placeholder for several rows.
  const spotId = spot?.id ?? 'electric-beach';
  // Live per-spot report from the deployed getReport function.
  const { data: report, loading } = useSpotReport(spotId);
  // Header reflects the selected spot. Rating uses the live report's
  // current rating when available, falling back to the sidebar's
  // placeholder tier so the chip never shows blank.
  const name = spot?.name ?? SELECTED_SPOT.name;
  const region = spot?.region ?? SELECTED_SPOT.region;
  const rating = report ? tierFromRating(report.now?.rating) : (spot?.rating ?? SELECTED_SPOT.rating);
  const metrics = report ? buildLiveMetrics(report) : SELECTED_SPOT.metrics;
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Pressable
          style={styles.panelHeaderTextWrap}
          onPress={() => onNavigate?.('spot-detail', { spotId })}
        >
          <Text style={styles.panelTitle}>{name}</Text>
          <Text style={styles.panelSub}>{region}</Text>
          {loading && !report ? (
            <Text style={[styles.panelSub, { color: colors.text4 }]}>Loading conditions…</Text>
          ) : null}
        </Pressable>
        <View style={styles.panelHeaderActions}>
          <ConditionPill tier={rating} size="md" />
          {/* Single favorite control per panel — top-right next to the
              condition pill. Toggling here syncs across every other
              surface that uses useFavorites (in-module pubsub). */}
          <FavoriteButton
            spotId={spotId}
            variant="hero"
            returnTo="spots-map"
            onNavigate={onNavigate}
          />
        </View>
      </View>

      <View style={styles.metricsGrid}>
        {metrics.map((m, i) => (
          <View
            key={m.label}
            style={[
              styles.metricCell,
              i % 2 === 0 && styles.metricCellRightBorder,
              i < 4 && styles.metricCellBottomBorder,
            ]}
          >
            <Text style={styles.metricLabel}>{m.label}</Text>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>{m.value}</Text>
              <Text style={styles.metricUnit}>{m.unit}</Text>
            </View>
            <Text style={[styles.metricCaption, { color: m.captionTone }]}>{m.caption}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.logDiveCta}
        onPress={() => onNavigate?.('log-dive', { spotId })}
      >
        <View style={styles.logDiveCtaIcon}>
          <Text style={styles.logDiveCtaPlus}>+</Text>
        </View>
        <View style={styles.logDiveCtaTextWrap}>
          <Text style={styles.logDiveCtaTitle}>Log a dive here</Text>
          <Text style={styles.logDiveCtaSub}>Conditions auto-filled · 2:47 PM</Text>
        </View>
      </Pressable>

      <BestWindow report={report} />

      {/* Live alerts from /spot_alerts. Hides itself when nothing's
          active — no placeholder copy. Replaces the static ALERTS
          stub. */}
      <SpotAlerts spotId={spotId} />

      <PanelSection title="Friends in the water">
        {FRIENDS.map((f, i) => (
          <View key={i} style={styles.friendRow}>
            <View style={styles.friendAvatar}>
              <Text style={styles.friendAvatarText}>{f.initials}</Text>
            </View>
            <View style={styles.friendTextWrap}>
              <Text style={styles.friendName}>{f.name}</Text>
              <Text style={styles.friendActivity}>{f.activity}</Text>
            </View>
            <Text style={styles.friendWhen}>{f.when}</Text>
          </View>
        ))}
      </PanelSection>
    </View>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panelSection}>
      <Text style={styles.panelSectionTitle}>{title}</Text>
      <View style={styles.panelSectionBody}>{children}</View>
    </View>
  );
}

function BestWindow({ report }: { report: BackendReport | null }) {
  // Derive bar tiers + peak window from the live windows[]. Each
  // window covers 3h; bars index left-to-right across 24h. Peak is
  // the highest-scoring window.
  const segments: ConditionTier[] = React.useMemo(() => {
    const wins = report?.windows ?? [];
    if (wins.length === 0) return BEST_WINDOW_BAR;
    return wins.slice(0, 8).map((w) => {
      const score = Number((w.rating as { score?: number } | undefined)?.score ?? 50);
      return score >= 80 ? 'excellent'
        : score >= 60 ? 'great'
        : score >= 40 ? 'good'
        : score >= 20 ? 'fair'
        : 'no-go';
    });
  }, [report]);

  // Peak window: highest-scoring 3h slot. Format as "2 PM – 5 PM".
  const peakLabel = React.useMemo(() => {
    const wins = report?.windows ?? [];
    if (wins.length === 0) return null;
    let best: typeof wins[number] | null = null;
    for (const w of wins) {
      const s = Number((w.rating as { score?: number } | undefined)?.score ?? 0);
      if (!best || s > Number((best.rating as { score?: number } | undefined)?.score ?? 0)) best = w;
    }
    if (!best?.startIso) return null;
    const start = new Date(best.startIso);
    if (!Number.isFinite(start.getTime())) return null;
    const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '');
    const end = new Date(start.getTime() + 3 * 3600 * 1000);
    return `${fmt(start)} – ${fmt(end)} TODAY`;
  }, [report]);

  // Mark the active peak segment in the time row.
  const peakIdx = React.useMemo(() => {
    if (segments.length === 0) return -1;
    const rank = (t: ConditionTier) => ({ excellent: 4, great: 3, good: 2, fair: 1, 'no-go': 0 }[t]);
    let bestIdx = 0;
    for (let i = 1; i < segments.length; i++) {
      if (rank(segments[i]) > rank(segments[bestIdx])) bestIdx = i;
    }
    return bestIdx;
  }, [segments]);

  return (
    <View style={styles.bestWindow}>
      <Text style={styles.panelSectionTitle}>Best window today</Text>
      <View style={styles.bestWindowBar}>
        {segments.map((tier, i) => (
          <View key={i} style={[styles.bestWindowSeg, { backgroundColor: TIER_COLORS[tier] }]} />
        ))}
      </View>
      <View style={styles.bestWindowTimeRow}>
        {['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p', '12a'].slice(0, segments.length + 1).map((t, i) => (
          <Text
            key={i}
            style={[styles.bestWindowTime, i === peakIdx && styles.bestWindowTimeActive]}
          >
            {t}
          </Text>
        ))}
      </View>
      {peakLabel ? (
        <Text style={styles.bestWindowCaption}>★ PEAK WINDOW: {peakLabel}</Text>
      ) : null}
    </View>
  );
}

// ─── Live-metric derivation ───────────────────────────────────────────────

// Compass cardinal/intercardinal from a degree value (0=N, 90=E, …).
function degToCompass(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

const C_TO_F = (c: number) => Math.round(c * 1.8 + 32);
const M_TO_FT = (m: number) => Math.round(m * 3.28084);
const KT_TO_MPH = (k: number) => Math.round(k * 1.15078);

type MetricCell = {
  label: string;
  value: string;
  unit: string;
  caption: string;
  captionTone: string;
};

function buildLiveMetrics(report: BackendReport): MetricCell[] {
  const m = report.now?.metrics ?? {};
  const v = report.now?.visibility ?? {};
  const tide = (report.now?.tide ?? {}) as Record<string, unknown>;

  // Backend now produces realistic 5-82ft visibility numbers via a
  // saturated KD490 curve (functions/abyss/kd490.js), so no display
  // clamp needed — distinct spots show distinct vis.
  const visFt = (v as { estimatedVisibilityFeet?: number }).estimatedVisibilityFeet;
  const visTone = visFt == null ? colors.text3
    : visFt >= 50 ? colors.great
    : visFt >= 30 ? colors.good
    : visFt >= 15 ? colors.fair
    : colors.nogo;
  const visCaption = visFt == null ? '—'
    : visFt >= 50 ? 'Excellent clarity'
    : visFt >= 35 ? 'Good clarity'
    : visFt >= 20 ? 'Moderate clarity'
    : 'Poor clarity';

  const waterC = m.waterTempC;
  const waterF = waterC == null ? null : C_TO_F(waterC);
  const waterCaption = waterF == null ? '—'
    : waterF >= 80 ? 'Skin or 1mm'
    : waterF >= 76 ? '3mm wetsuit'
    : waterF >= 72 ? '5mm wetsuit'
    : 'Thick suit + hood';

  const waveM = m.waveHeightM;
  const waveFt = waveM == null ? null : M_TO_FT(waveM);
  const waveDir = degToCompass(m.waveDirectionDegFrom);
  const wavePeriod = m.wavePeriodS;
  const waveCaption = waveDir && wavePeriod
    ? `${waveDir} · ${Math.round(wavePeriod)}s swell`
    : waveDir || (wavePeriod ? `${Math.round(wavePeriod)}s` : '—');

  const windKt = m.windSpeedKts;
  const windMph = windKt == null ? null : KT_TO_MPH(windKt);
  const windGustKt = m.windGustKts;
  const windGustMph = windGustKt == null ? null : KT_TO_MPH(windGustKt);
  const windDir = degToCompass(m.windDeg);
  const windCaption = windDir
    ? (windGustMph ? `${windDir} · ${windGustMph} gust` : windDir)
    : '—';

  // Wind-derived alongshore current proxy — backend doesn't ship an
  // explicit surface current scalar today, so use the standard
  // oceanographic rule-of-thumb: surface current ≈ 3% of wind speed.
  const currentKt = windKt == null ? null : Math.max(0.1, Math.round(windKt * 0.03 * 10) / 10);
  const currentCaption = currentKt == null ? '—'
    : currentKt < 0.5 ? 'Non-existent'
    : currentKt < 1.5 ? 'Light'
    : currentKt < 2.5 ? 'Moderate'
    : 'Strong';

  // Tide: interpolate between the last passed event and the next one.
  const tideEvents = collectTideEvents(tide);
  const tideNow = interpolateTide(tideEvents, Date.now());
  const tideTrend = tideNow ? (tideNow.rising ? '↑ Rising' : '↓ Falling') : '—';
  const tideTone = tideNow?.rising ? colors.great : colors.text3;

  return [
    {
      label: 'Visibility',
      value: visFt != null ? String(visFt) : '—',
      unit: visFt != null ? 'FT' : '',
      caption: visCaption,
      captionTone: visTone,
    },
    {
      label: 'Water temp',
      value: waterF != null ? String(waterF) : '—',
      unit: waterF != null ? '°F' : '',
      caption: waterCaption,
      captionTone: colors.text3,
    },
    {
      label: 'Wave height',
      value: waveFt != null ? String(waveFt) : '—',
      unit: waveFt != null ? 'FT' : '',
      caption: waveCaption,
      captionTone: colors.text3,
    },
    {
      label: 'Wind',
      value: windMph != null ? String(windMph) : '—',
      unit: windMph != null ? 'MPH' : '',
      caption: windCaption,
      captionTone: colors.text3,
    },
    {
      label: 'Current',
      value: currentKt != null ? String(currentKt) : '—',
      unit: currentKt != null ? 'KT' : '',
      caption: currentCaption,
      captionTone: colors.text3,
    },
    {
      label: 'Tide',
      value: tideNow ? tideNow.heightFt.toFixed(1) : '—',
      unit: tideNow ? 'FT' : '',
      caption: tideTrend,
      captionTone: tideTone,
    },
  ];
}

// Pull the named tide events out of the backend's tide object and
// sort them. The backend names them low/rising/high/falling per
// half-cycle; we just need (timeMs, heightFt) pairs in chronological
// order to interpolate against.
function collectTideEvents(tide: Record<string, unknown>): Array<{ t: number; h: number }> {
  const pairs: Array<[string, string]> = [
    ['lowTide1Time', 'lowTide1Height'],
    ['risingTideTime', 'risingTideHeight'],
    ['highTideTime', 'highTideHeight'],
    ['fallingTideTime', 'fallingTideHeight'],
    ['lowTide2Time', 'lowTide2Height'],
  ];
  const events: Array<{ t: number; h: number }> = [];
  for (const [tk, hk] of pairs) {
    const iso = tide[tk];
    const h = tide[hk];
    if (typeof iso === 'string' && typeof h === 'number') {
      const t = Date.parse(iso);
      if (Number.isFinite(t)) events.push({ t, h });
    }
  }
  return events.sort((a, b) => a.t - b.t);
}

function interpolateTide(
  events: Array<{ t: number; h: number }>,
  nowMs: number,
): { heightFt: number; rising: boolean } | null {
  if (events.length < 2) return null;
  // Find the bracket [a, b] where a.t <= nowMs <= b.t.
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    if (nowMs >= a.t && nowMs <= b.t) {
      const frac = (nowMs - a.t) / Math.max(1, b.t - a.t);
      const h = a.h + (b.h - a.h) * frac;
      return { heightFt: h, rising: b.h > a.h };
    }
  }
  // Beyond the last event — take last segment's direction.
  const a = events[events.length - 2];
  const b = events[events.length - 1];
  return { heightFt: b.h, rising: b.h > a.h };
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
  },

  // ── Alert banner ──
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: 'rgba(12,155,250,0.10)', // info — accent blue tint
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(12,155,250,0.30)',
  },
  alertBannerAdvisory: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: 'rgba(255,157,37,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,157,37,0.30)',
  },
  alertBannerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: 'rgba(255,90,40,0.14)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,90,40,0.40)',
  },
  alertBannerUrgent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'rgba(247,55,38,0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(247,55,38,0.55)',
  },
  alertMeta: {
    color: 'rgba(248,248,248,0.55)',
    fontFamily: 'inherit',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.fair,
  },
  alertText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 18,
  },
  alertLink: {
    color: colors.text1,
    textDecorationLine: 'underline',
  },
  alertSpacer: { width: 8 },
  alertDismiss: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },

  // ── Body grid ──
  body: {
    flexDirection: 'row',
    height: 1067,
  },
  // Narrow viewport (<1080px): stack sidebar → map → panel vertically.
  // The page scrolls normally; the map gets a bounded fixed height
  // (see mapColumnNarrow) so it doesn't dominate the screen.
  bodyNarrow: {
    flexDirection: 'column',
    width: '100%',
    gap: 12,
  },
  mapColumnNarrow: {
    width: '100%',
    height: 480,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  // Page wrapper that takes full viewport height so the body row can
  // flex: 1 inside it (replaces the old scrolling page approach).
  pageFixed: {
    height: '100vh' as unknown as number,
    overflow: 'hidden' as unknown as 'visible',
  },
  // Body row inside pageFixed — fills the remaining viewport so the
  // left + right columns scroll within their own bounds while the
  // map column stays fixed. justifyContent:space-between pins the
  // side columns to their edges now that the (fixed) map column is
  // out of flow.
  bodyFixed: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 0, // critical for flex children that scroll on web
    overflow: 'hidden' as unknown as 'visible',
    position: 'relative',
    zIndex: 1,
  },
  // Wraps the top nav + alert banner. Lifted above the (position:fixed)
  // map so it visually covers the map's top edge instead of being
  // painted underneath.
  chromeStack: {
    position: 'relative',
    zIndex: 2,
  },
  panelScroll: {
    flex: 1,
  },
  panelScrollContent: {
    paddingBottom: 24,
  },

  // ── Sidebar (left) ──
  sidebar: {
    // Width set by responsive wrapper in SpotsMapScreen.
    // Fills its column height so the inner sidebarList scroll has
    // bounded space to overflow into.
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  sidebarSearch: {
    margin: 16,
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  sidebarSearchIcon: {
    fontSize: 13,
    color: colors.text4,
  },
  sidebarSearchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },
  sidebarSearchClear: {
    fontSize: 16,
    color: colors.text3,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  sidebarEmpty: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
  },
  sidebarEmptyTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text2,
  },
  sidebarEmptySub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
  },
  sidebarTabs: {
    flexDirection: 'row',
    height: 37,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  sidebarTab: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  sidebarTabText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  sidebarTabTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  sidebarTabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  sidebarList: {
    flex: 1,
  },

  // ── Island headers / spot rows ──
  islandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 8,
  },
  islandHeaderName: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    textTransform: 'uppercase',
    flex: 1,
  },
  islandHeaderCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text2,
    fontWeight: '600',
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    position: 'relative',
  },
  spotRowSelected: {
    backgroundColor: colors.accentDim,
  },
  spotRowSelectedBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.accent,
  },
  spotRowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spotRowText: {
    flex: 1,
    gap: 2,
  },
  spotRowName: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  spotRowRegion: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  // ── Map (center) ──
  // Lives in the middle column of the CSS Grid wrapper, so the grid
  // itself places it between the side columns. No position:absolute
  // needed. Mapbox's canvas re-resizes via the ResizeObserver in
  // KaiCastMap whenever this cell's size changes (alert dismiss,
  // sidebar collapse, window resize, etc.).
  mapColumn: {
    height: '100%',
    backgroundColor: '#04111e',
    overflow: 'hidden',
    position: 'relative',
  },
  // Status bar
  mapStatusBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(12,16,21,0.75)',
    borderTopWidth: 1,
    borderTopColor: colors.hairlineStrong,
  },
  mapStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mapStatusText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text2,
  },
  mapStatusDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.hairline,
  },
  mapStatusSpacer: { flex: 1 },
  mapStatusUpdated: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },

  // ── Right panel ──
  panel: {
    // Width set by responsive wrapper in SpotsMapScreen.
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 15,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  panelHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  panelHeaderActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  panelSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // Metrics 2×3
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    width: '50%',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
  },
  metricCellRightBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  metricCellBottomBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  metricLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  metricUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  metricCaption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },

  // Log dive CTA
  logDiveCta: {
    margin: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(9,161,251,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(9,161,251,0.30)',
    borderRadius: radius.sm,
  },
  logDiveCtaIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDiveCtaPlus: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '300',
    color: colors.bg,
  },
  logDiveCtaTextWrap: {
    flex: 1,
    gap: 2,
  },
  logDiveCtaTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  logDiveCtaSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
  },

  // Best window
  bestWindow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  bestWindowBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 1,
    backgroundColor: '#162838',
  },
  bestWindowSeg: {
    flex: 1,
  },
  bestWindowTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bestWindowTime: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text4,
  },
  bestWindowTimeActive: {
    color: colors.text1,
    fontWeight: '700',
  },
  bestWindowCaption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.accent,
  },

  // Panel sections (alerts, friends)
  panelSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  panelSectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  panelSectionBody: {
    gap: 14,
  },

  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  alertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconText: {
    fontSize: 14,
  },
  alertRowTextWrap: {
    flex: 1,
    gap: 4,
  },
  alertRowTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  alertRowBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text3,
  },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendAvatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text1,
  },
  friendTextWrap: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  friendActivity: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  friendWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
});

// Unused so far but exported for navigation wiring later.
export const SPOT_TIERS_FOR_SCREEN: ConditionTier[] = Object.keys(TIER_LABELS) as ConditionTier[];
