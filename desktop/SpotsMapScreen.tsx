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

/**
 * Spots & Maps — desktop screen (Figma 444:1787).
 *
 * Layout:
 *   - DesktopNav (Spots & Maps active)
 *   - Runoff alert banner (full width)
 *   - 3-col grid: 300px spot list | fluid map | 320px selected-spot panel
 *
 * The center map is a styled placeholder — real tile rendering (Mapbox /
 * satellite layer) is wired separately per the data-fetching boundary.
 */

// ─── Mock data ────────────────────────────────────────────────────────────

type SidebarSpot = {
  name: string;
  region: string;
  rating?: ConditionTier;
  runoff?: boolean;
  selected?: boolean;
};

const ISLANDS: Array<{ name: string; count: number; spots: SidebarSpot[] }> = [
  {
    name: "O'ahu",
    count: 14,
    spots: [
      { name: 'Electric Beach', region: 'Leeward · 4.2 mi',                  rating: 'excellent', selected: true },
      { name: "Shark's Cove",   region: 'North Shore · 8.4 mi',              rating: 'great' },
      { name: 'Three Tables',   region: 'North Shore · 8.6 mi',              rating: 'great' },
      { name: 'Pupukea Beach',  region: 'North Shore · 9.2 mi',              rating: 'good' },
      { name: 'Magic Island',   region: 'Honolulu · 8.1 mi',                 rating: 'good' },
      { name: 'Hanauma Bay',    region: 'East Side · 22 mi · ⚠ Runoff',      rating: 'good',  runoff: true },
      { name: 'Turtle Canyon',  region: 'Leeward · 11 mi · ⚠ Runoff',        rating: 'no-go', runoff: true },
      { name: 'Koko Crater',    region: 'East Side · 24 mi',                 rating: 'fair' },
      { name: 'Waimea Bay',     region: 'North Shore · 26 mi',               rating: 'fair' },
    ],
  },
  {
    name: 'Maui',
    count: 11,
    spots: [
      { name: 'Molokini Crater', region: 'South · Charter only',  rating: 'excellent' },
      { name: 'Honolua Bay',     region: 'Northwest · Shore',     rating: 'great' },
      { name: 'Ulua Beach',      region: 'South Maui · Shore',    rating: 'good' },
      { name: 'Black Rock',      region: 'West · Shore',          rating: 'great' },
    ],
  },
  {
    name: 'Big Island',
    count: 15,
    spots: [
      { name: 'Kealakekua Bay',   region: 'West · State Reserve', rating: 'excellent' },
      { name: 'Kahaluu Beach',    region: 'West · Shore',         rating: 'great' },
      { name: 'Two Step',         region: 'West · Shore',         rating: 'great' },
      { name: 'Richardson Beach', region: 'East · Shore',         rating: 'good' },
    ],
  },
  {
    name: "Kaua'i",
    count: 7,
    spots: [
      { name: 'Tunnels Beach', region: 'North Shore · Shore', rating: 'good' },
      { name: 'Poipu Beach',   region: 'South Shore · Shore', rating: 'good' },
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

const MAP_LAYERS = [
  { label: 'Conditions',   color: colors.accent, active: true  },
  { label: 'Wind',         color: colors.accent, active: false },
  { label: 'Swell',        color: colors.good,   active: false },
  { label: 'Cloud cover',  color: 'rgba(255,255,255,0.4)', active: false },
  { label: 'Rain / Runoff', color: colors.nogo,  active: false },
];

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
}

export function SpotsMapScreen({ activeNav = 'spots' }: SpotsMapScreenProps) {
  const [tab, setTab] = React.useState<'All' | 'Favorites' | 'Nearby'>('All');

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} />

      <View style={styles.maxWidth}>
        <AlertBanner />

        <View style={styles.body}>
          <Sidebar tab={tab} onTab={setTab} />
          <MapColumn />
          <SelectedSpotPanel />
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
}: {
  tab: 'All' | 'Favorites' | 'Nearby';
  onTab: (t: 'All' | 'Favorites' | 'Nearby') => void;
}) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarSearch}>
        <Text style={styles.sidebarSearchIcon}>⌕</Text>
        <TextInput
          placeholder="Filter spots…"
          placeholderTextColor={colors.text4}
          style={[styles.sidebarSearchInput, { outlineStyle: 'none' } as object]}
        />
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
        {ISLANDS.map((island) => (
          <View key={island.name}>
            <View style={styles.islandHeader}>
              <Text style={styles.islandHeaderName}>{island.name}</Text>
              <Text style={styles.islandHeaderCount}>{island.count} spots</Text>
            </View>
            {island.spots.map((s) => (
              <SidebarSpotRow key={s.name} spot={s} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SidebarSpotRow({ spot }: { spot: SidebarSpot }) {
  return (
    <View style={[styles.spotRow, spot.selected && styles.spotRowSelected]}>
      {spot.selected ? <View style={styles.spotRowSelectedBar} /> : null}
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
    </View>
  );
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

function MapColumn() {
  return (
    <View style={styles.mapColumn}>
      {/* Faint grid background */}
      <View style={styles.mapGrid} pointerEvents="none">
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.mapGridLineV, { left: `${(i / 18) * 100}%` }]} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.mapGridLineH, { top: `${(i / 12) * 100}%` }]} />
        ))}
      </View>

      {/* Radial glow accent */}
      <View style={styles.mapGlow} pointerEvents="none" />

      {/* Latitude reference lines */}
      <View pointerEvents="none">
        {[
          { top: '20%', label: '23.5°N' },
          { top: '50%', label: '21.5°N · Hawaiian Trough' },
          { top: '80%', label: '19.5°N' },
        ].map((r) => (
          <View key={r.label} style={[styles.mapLatRow, { top: r.top as `${number}%` }]}>
            <Text style={styles.mapLatLabel}>{r.label}</Text>
            <View style={styles.mapLatLine} />
          </View>
        ))}
      </View>

      {/* Top-left layer panel */}
      <View style={styles.mapLayerPanel}>
        <Text style={styles.mapLayerTitle}>MAP LAYER</Text>
        {MAP_LAYERS.map((l) => (
          <View
            key={l.label}
            style={[styles.mapLayerRow, l.active && styles.mapLayerRowActive]}
          >
            <View style={[styles.mapLayerSwatch, { backgroundColor: l.color }]} />
            <Text style={[styles.mapLayerLabel, l.active && styles.mapLayerLabelActive]}>{l.label}</Text>
          </View>
        ))}
      </View>

      {/* Top-right zoom control */}
      <View style={styles.mapZoom}>
        <Text style={styles.mapZoomLabel}>ZOOM</Text>
        <Pressable style={styles.mapZoomBtn}><Text style={styles.mapZoomBtnText}>+</Text></Pressable>
        <Pressable style={styles.mapZoomBtn}><Text style={styles.mapZoomBtnText}>−</Text></Pressable>
      </View>

      {/* Pin callout (selected spot) */}
      <View style={styles.pinCallout}>
        <Text style={styles.pinCalloutTitle}>Electric Beach</Text>
        <View style={styles.pinCalloutMetrics}>
          {[
            { value: '56FT', label: 'VIS' },
            { value: '79°F', label: '' },
            { value: '3FT',  label: 'WAVE' },
            { value: '1MPH', label: 'CURR' },
          ].map((m, i) => (
            <View key={i} style={styles.pinCalloutMetric}>
              <Text style={styles.pinCalloutValue}>{m.value}</Text>
              {m.label ? <Text style={styles.pinCalloutLabel}>{m.label}</Text> : null}
            </View>
          ))}
        </View>
        <View style={styles.pinCalloutFooter}>
          <View style={[styles.pinCalloutDot, { backgroundColor: colors.excellent }]} />
          <Text style={styles.pinCalloutFooterText}>Excellent · Live · 4.2 mi</Text>
        </View>
      </View>

      {/* Bottom status bar */}
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

function SelectedSpotPanel() {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelHeaderTextWrap}>
          <Text style={styles.panelTitle}>{SELECTED_SPOT.name}</Text>
          <Text style={styles.panelSub}>{SELECTED_SPOT.region}</Text>
          <Text style={styles.panelSub}>{SELECTED_SPOT.distance}</Text>
        </View>
        <ConditionPill tier={SELECTED_SPOT.rating} size="md" />
      </View>

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

      <Pressable style={styles.logDiveCta}>
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
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mapGridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  mapGridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  mapGlow: {
    position: 'absolute',
    top: '30%',
    left: '40%',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: colors.accentDim,
    opacity: 0.4,
  },
  mapLatRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapLatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: 'rgba(255,255,255,0.30)',
    paddingLeft: 16,
    width: 220,
  },
  mapLatLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
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

  // Zoom
  mapZoom: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    padding: 4,
    gap: 4,
    backgroundColor: 'rgba(12,16,21,0.65)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
  },
  mapZoomLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.text4,
    marginTop: 4,
    marginBottom: 4,
  },
  mapZoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapZoomBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text1,
  },

  // Pin callout
  pinCallout: {
    position: 'absolute',
    top: '30%',
    left: 240,
    width: 210,
    padding: 14,
    gap: 10,
    backgroundColor: 'rgba(12,16,21,0.92)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pinCalloutTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  pinCalloutMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  pinCalloutMetric: {
    gap: 2,
  },
  pinCalloutValue: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  pinCalloutLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  pinCalloutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  pinCalloutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pinCalloutFooterText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text2,
    letterSpacing: 0.6,
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
