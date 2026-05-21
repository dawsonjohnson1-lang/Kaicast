import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
  TIER_COLORS,
  TIER_LABELS,
  type ConditionTier,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { ConditionPill } from './components/ConditionPill';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from './components/maps/KaiCastMap';
import type mapboxgl from 'mapbox-gl';
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
  name: string;
  region: string;
  lat: number;
  lng: number;
  rating?: ConditionTier;
  runoff?: boolean;
};

// Coordinates are approximate; pulled from public reef-site listings.
// They drive Mapbox marker placement, so accuracy matters for visual
// honesty but not for navigation.
const ISLANDS: Array<{ name: string; count: number; spots: SidebarSpot[] }> = [
  {
    name: "O'ahu",
    count: 14,
    spots: [
      { name: 'Electric Beach', region: 'Leeward · 4.2 mi',             lat: 21.3550, lng: -158.1220, rating: 'excellent' },
      { name: "Shark's Cove",   region: 'North Shore · 8.4 mi',         lat: 21.6417, lng: -158.0617, rating: 'great' },
      { name: 'Three Tables',   region: 'North Shore · 8.6 mi',         lat: 21.6367, lng: -158.0633, rating: 'great' },
      { name: 'Pupukea Beach',  region: 'North Shore · 9.2 mi',         lat: 21.6500, lng: -158.0500, rating: 'good' },
      { name: 'Magic Island',   region: 'Honolulu · 8.1 mi',            lat: 21.2840, lng: -157.8458, rating: 'good' },
      { name: 'Hanauma Bay',    region: 'East Side · 22 mi · ⚠ Runoff', lat: 21.2694, lng: -157.6939, rating: 'good',  runoff: true },
      { name: 'Turtle Canyon',  region: 'Leeward · 11 mi · ⚠ Runoff',   lat: 21.4000, lng: -158.1500, rating: 'no-go', runoff: true },
      { name: 'Koko Crater',    region: 'East Side · 24 mi',            lat: 21.2820, lng: -157.6700, rating: 'fair' },
      { name: 'Waimea Bay',     region: 'North Shore · 26 mi',          lat: 21.6420, lng: -158.0670, rating: 'fair' },
    ],
  },
  {
    name: 'Maui',
    count: 11,
    spots: [
      { name: 'Molokini Crater', region: 'South · Charter only', lat: 20.6330, lng: -156.4950, rating: 'excellent' },
      { name: 'Honolua Bay',     region: 'Northwest · Shore',    lat: 21.0123, lng: -156.6398, rating: 'great' },
      { name: 'Ulua Beach',      region: 'South Maui · Shore',   lat: 20.6843, lng: -156.4427, rating: 'good' },
      { name: 'Black Rock',      region: 'West · Shore',         lat: 20.9333, lng: -156.6920, rating: 'great' },
    ],
  },
  {
    name: 'Big Island',
    count: 15,
    spots: [
      { name: 'Kealakekua Bay',   region: 'West · State Reserve', lat: 19.4791, lng: -155.9197, rating: 'excellent' },
      { name: 'Kahaluu Beach',    region: 'West · Shore',         lat: 19.5757, lng: -155.9683, rating: 'great' },
      { name: 'Two Step',         region: 'West · Shore',         lat: 19.4187, lng: -155.9099, rating: 'great' },
      { name: 'Richardson Beach', region: 'East · Shore',         lat: 19.7367, lng: -155.0167, rating: 'good' },
    ],
  },
  {
    name: "Kaua'i",
    count: 7,
    spots: [
      { name: 'Tunnels Beach', region: 'North Shore · Shore', lat: 22.2233, lng: -159.5705, rating: 'good' },
      { name: 'Poipu Beach',   region: 'South Shore · Shore', lat: 21.8736, lng: -159.4537, rating: 'good' },
    ],
  },
];

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

const ALERTS = [
  { icon: '👁', tint: colors.accentDim,             title: 'Molokini Crater',                 body: 'Visibility improved to 80ft — best reading in 2 weeks' },
  { icon: '🌊', tint: colors.accentDim,             title: 'Kealakekua Bay',                  body: 'Swell dropping Thursday — excellent 6–10am window forming' },
  { icon: '⚠',  tint: 'rgba(255,157,37,0.16)',      title: 'Turtle Canyon · Runoff warning',  body: '48hr advisory · High rainfall + overflow reported' },
];

const FRIENDS = [
  { initials: 'KM', name: 'Kai M.',     activity: 'at Electric Beach · Freediving',   when: 'NOW' },
  { initials: 'LS', name: 'Leilani S.', activity: 'at Molokini · Scuba · 60ft',       when: '14M' },
  { initials: 'MH', name: 'Marcus H.',  activity: "at Shark's Cove · Spearfishing",   when: '32M' },
];

// Initial layer state — `active` toggles via the layer panel on the map.
const INITIAL_MAP_LAYERS = [
  { label: 'Conditions',    color: colors.accent,            active: true  },
  { label: 'Wind',          color: colors.accent,            active: false },
  { label: 'Swell',         color: colors.good,              active: false },
  { label: 'Cloud cover',   color: 'rgba(255,255,255,0.4)',  active: false },
  { label: 'Rain / Runoff', color: colors.nogo,              active: false },
];

// Favorites set powering the sidebar "Favorites" tab — matches the spots
// listed under "My spots" elsewhere in the app for consistency.
const FAVORITE_SPOTS = new Set(['Electric Beach', "Shark's Cove", 'Molokini Crater', 'Three Tables']);

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
  const [tab, setTab] = React.useState<'All' | 'Favorites' | 'Nearby'>('All');
  const [search, setSearch] = React.useState('');
  const [layers, setLayers] = React.useState(INITIAL_MAP_LAYERS);
  // Selection is keyed by spot name (the data has no stable id field).
  const [selectedName, setSelectedName] = React.useState<string>('Electric Beach');
  const [hoveredName, setHoveredName] = React.useState<string | undefined>(undefined);

  const toggleLayer = React.useCallback((label: string) => {
    setLayers((prev) => prev.map((l) => (l.label === label ? { ...l, active: !l.active } : l)));
  }, []);

  // Flat list of every spot — used by the map (always shows all pins,
  // sidebar filtering only affects the list panel).
  const allSpots = React.useMemo(
    () => ISLANDS.flatMap((i) => i.spots),
    [],
  );

  const selectedSpot = React.useMemo(
    () => allSpots.find((s) => s.name === selectedName),
    [allSpots, selectedName],
  );

  // "Conditions" layer toggles pin visibility — when off, the map shows
  // an empty geography. Other layer toggles (Wind / Swell / Cloud /
  // Rain) hold visual state but their data layers are TODO (backend
  // overlays not yet shipped).
  const conditionsOn = layers.find((l) => l.label === 'Conditions')?.active ?? true;
  const mapMarkers: MapMarker[] = React.useMemo(() => {
    if (!conditionsOn) return [];
    return allSpots.map((s) => ({
      id: s.name,
      lng: s.lng,
      lat: s.lat,
      tier: s.rating,
      label: s.name,
    }));
  }, [allSpots, conditionsOn]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <AlertBanner />

        <View style={styles.body}>
          <Sidebar
            tab={tab}
            onTab={setTab}
            search={search}
            onSearch={setSearch}
            selectedName={selectedName}
            onSelect={setSelectedName}
            onHover={setHoveredName}
            onNavigate={onNavigate}
          />
          <MapColumn
            markers={mapMarkers}
            selectedName={selectedName}
            hoveredName={hoveredName}
            onSelect={setSelectedName}
            layers={layers}
            onToggleLayer={toggleLayer}
          />
          <SelectedSpotPanel spot={selectedSpot} onNavigate={onNavigate} />
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────

function AlertBanner() {
  return (
    <View style={styles.alertBanner}>
      <View style={styles.alertDot} />
      <Text style={styles.alertText}>
        <Text style={{ color: colors.text1, fontWeight: '600' }}>Runoff advisory: </Text>
        <Text style={{ color: colors.fair, fontWeight: '600' }}>Turtle Canyon</Text>
        <Text> and </Text>
        <Text style={{ color: colors.fair, fontWeight: '600' }}>Hanauma Bay</Text>
        <Text> — avoid for 48hrs after recent rainfall. </Text>
        <Text style={styles.alertLink}>Learn more</Text>
      </Text>
      <View style={styles.alertSpacer} />
      <Text style={styles.alertDismiss}>DISMISS ×</Text>
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
}: {
  tab: 'All' | 'Favorites' | 'Nearby';
  onTab: (t: 'All' | 'Favorites' | 'Nearby') => void;
  search: string;
  onSearch: (s: string) => void;
  selectedName: string;
  onSelect: (name: string) => void;
  onHover: (name: string | undefined) => void;
  onNavigate?: NavigateFn;
}) {
  const q = search.trim().toLowerCase();

  const matchTab = (spot: SidebarSpot): boolean => {
    if (tab === 'Favorites') return FAVORITE_SPOTS.has(spot.name);
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

  const filteredIslands = ISLANDS
    .map((island) => ({
      ...island,
      spots: island.spots.filter((s) => matchTab(s) && matchSearch(s)),
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
}: {
  spot: SidebarSpot;
  selected: boolean;
  onSelect: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onOpen: () => void;
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
  layers,
  onToggleLayer,
}: {
  markers: MapMarker[];
  selectedName: string;
  hoveredName?: string;
  onSelect: (name: string) => void;
  layers: ReadonlyArray<{ label: string; color: string; active: boolean }>;
  onToggleLayer: (label: string) => void;
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
    <View style={styles.mapColumn}>
      <KaiCastMap
        markers={markers}
        center={center}
        zoom={zoom}
        selectedId={selectedName}
        hoveredId={hoveredName}
        onMarkerClick={onSelect}
        showZoomControls
      />

      {/* Top-left layer panel — absolute overlay above the map canvas. */}
      <View style={styles.mapLayerPanel}>
        <Text style={styles.mapLayerTitle}>MAP LAYER</Text>
        {layers.map((l) => (
          <Pressable
            key={l.label}
            onPress={() => onToggleLayer(l.label)}
            style={[styles.mapLayerRow, l.active && styles.mapLayerRowActive]}
          >
            <View style={[styles.mapLayerSwatch, { backgroundColor: l.color }]} />
            <Text style={[styles.mapLayerLabel, l.active && styles.mapLayerLabelActive]}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Bottom status bar — also absolute, anchored to bottom edge. */}
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
  // Header reflects the selected spot. Below the header, the metric
  // grid + alerts + friends rows stay on the canonical Electric Beach
  // mock — per-spot live metrics are a backend wiring task, not part
  // of the map-wireup pass.
  const name = spot?.name ?? SELECTED_SPOT.name;
  const region = spot?.region ?? SELECTED_SPOT.region;
  const rating = spot?.rating ?? SELECTED_SPOT.rating;
  const spotId = spot ? slugify(spot.name) : 'electric-beach';
  return (
    <View style={styles.panel}>
      <Pressable
        style={styles.panelHeader}
        onPress={() => onNavigate?.('spot-detail', { spotId })}
      >
        <View style={styles.panelHeaderTextWrap}>
          <Text style={styles.panelTitle}>{name}</Text>
          <Text style={styles.panelSub}>{region}</Text>
        </View>
        <ConditionPill tier={rating} size="md" />
      </Pressable>

      <View style={styles.metricsGrid}>
        {SELECTED_SPOT.metrics.map((m, i) => (
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
        onPress={() => onNavigate?.('log-dive', { spotId: 'electric-beach' })}
      >
        <View style={styles.logDiveCtaIcon}>
          <Text style={styles.logDiveCtaPlus}>+</Text>
        </View>
        <View style={styles.logDiveCtaTextWrap}>
          <Text style={styles.logDiveCtaTitle}>Log a dive here</Text>
          <Text style={styles.logDiveCtaSub}>Conditions auto-filled · 2:47 PM</Text>
        </View>
      </Pressable>

      <BestWindow />

      <PanelSection title="Condition alerts">
        {ALERTS.map((a, i) => (
          <View key={i} style={styles.alertRow}>
            <View style={[styles.alertIconWrap, { backgroundColor: a.tint }]}>
              <Text style={styles.alertIconText}>{a.icon}</Text>
            </View>
            <View style={styles.alertRowTextWrap}>
              <Text style={styles.alertRowTitle}>{a.title}</Text>
              <Text style={styles.alertRowBody}>{a.body}</Text>
            </View>
          </View>
        ))}
      </PanelSection>

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

function BestWindow() {
  return (
    <View style={styles.bestWindow}>
      <Text style={styles.panelSectionTitle}>Best window today</Text>
      <View style={styles.bestWindowBar}>
        {BEST_WINDOW_BAR.map((tier, i) => (
          <View key={i} style={[styles.bestWindowSeg, { backgroundColor: TIER_COLORS[tier] }]} />
        ))}
      </View>
      <View style={styles.bestWindowTimeRow}>
        {['12a', '6a', '12p', '▼ 2p', '6p', '12a'].map((t, i) => (
          <Text
            key={i}
            style={[styles.bestWindowTime, t.startsWith('▼') && styles.bestWindowTimeActive]}
          >
            {t}
          </Text>
        ))}
      </View>
      <Text style={styles.bestWindowCaption}>★ PEAK WINDOW: 2 PM – 5 PM TODAY</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 300;
const PANEL_WIDTH = 320;

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
    backgroundColor: 'rgba(255,157,37,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,157,37,0.30)',
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

  // ── Sidebar (left) ──
  sidebar: {
    width: SIDEBAR_WIDTH,
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
  mapColumn: {
    flex: 1,
    backgroundColor: '#04111e',
    position: 'relative',
    overflow: 'hidden',
  },
  // Layer panel
  mapLayerPanel: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 160,
    padding: 12,
    backgroundColor: 'rgba(12,16,21,0.65)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 8,
  },
  mapLayerTitle: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
  },
  mapLayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  mapLayerRowActive: {
    backgroundColor: colors.accentDim,
  },
  mapLayerSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  mapLayerLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
  },
  mapLayerLabelActive: {
    color: colors.text1,
    fontWeight: '500',
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
    width: PANEL_WIDTH,
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
