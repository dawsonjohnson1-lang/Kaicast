import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
  TIER_COLORS,
  type ConditionTier,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { ConditionPill } from './components/ConditionPill';
import { SpotCard } from './components/SpotCard';
import type { NavigateFn } from './router';

/**
 * Conditions Overview — desktop screen (Figma 464:4963).
 *
 * Layout:
 *   - DesktopNav (Forecast active)
 *   - Sticky filter bar (full width)
 *   - 2-col body:
 *       Left sidebar 240px:  filter groups + today's snapshot + my spots
 *       Main (flex):         "Firing now" 3-card strip + island-grouped table
 *
 * The island-grouped table is the hero of the screen — each row shows a
 * spot's current condition + key metrics + a 7-cell color bar for the
 * 7-day outlook.
 */

// ─── Mock data ────────────────────────────────────────────────────────────

type SpotRow = {
  name: string;
  region: string;
  rating: ConditionTier;
  forecast: ConditionTier[]; // length 7 — today + 6 days out
  vis: number;
  temp: number;
  swell: number;
};

const FIRING_NOW = [
  {
    name: 'Electric Beach',
    region: "O'AHU · LEEWARD · 4.2 MI",
    rating: 'excellent' as ConditionTier,
    visibilityFt: 56,
    waterTempF: 79,
    swellFt: 3,
    bestWindow: '2pm – 5pm',
  },
  {
    name: 'Kealakekua Bay',
    region: "HAWAI'I · KONA · CHARTER",
    rating: 'excellent' as ConditionTier,
    visibilityFt: 90,
    waterTempF: 78,
    swellFt: 1,
    bestWindow: 'All day',
  },
  {
    name: 'Molokini Crater',
    region: 'MAUI · SOUTH · BOAT ACCESS',
    rating: 'excellent' as ConditionTier,
    visibilityFt: 80,
    waterTempF: 77,
    swellFt: 2,
    bestWindow: '7am – 12pm',
  },
];

const OAHU_SPOTS: SpotRow[] = [
  { name: 'Electric Beach', region: 'Leeward · Shore',  rating: 'excellent', forecast: ['excellent','excellent','great','good','fair','good','great'], vis: 56, temp: 79, swell: 3 },
  { name: "Shark's Cove",   region: 'North Shore',      rating: 'great',     forecast: ['great','great','good','good','fair','fair','good'],            vis: 48, temp: 78, swell: 3.5 },
  { name: 'Three Tables',   region: 'North Shore',      rating: 'great',     forecast: ['great','great','good','good','fair','good','good'],             vis: 50, temp: 78, swell: 3.2 },
  { name: 'Hanauma Bay',    region: 'East Shore',       rating: 'good',      forecast: ['good','good','good','fair','fair','good','good'],               vis: 40, temp: 79, swell: 1.4 },
  { name: 'Magic Island',   region: 'South Shore',      rating: 'good',      forecast: ['good','great','great','good','good','good','great'],            vis: 35, temp: 80, swell: 1.8 },
  { name: 'China Walls',    region: 'East Shore',       rating: 'good',      forecast: ['good','good','fair','fair','fair','good','good'],               vis: 38, temp: 79, swell: 2.0 },
  { name: 'Makaha',         region: 'Leeward · Shore',  rating: 'fair',      forecast: ['fair','good','good','great','great','good','good'],             vis: 28, temp: 79, swell: 4.5 },
  { name: 'Sandy Beach',    region: 'East Shore',       rating: 'fair',      forecast: ['fair','fair','no-go','no-go','fair','fair','good'],             vis: 22, temp: 80, swell: 5.0 },
];

const MAUI_SPOTS: SpotRow[] = [
  { name: 'Molokini Crater',     region: 'South · Boat',  rating: 'excellent', forecast: ['excellent','excellent','great','good','fair','good','great'], vis: 80, temp: 77, swell: 2.0 },
  { name: 'Honolua Bay',         region: 'West · Shore',  rating: 'great',     forecast: ['great','great','good','good','fair','fair','good'],            vis: 55, temp: 77, swell: 2.5 },
  { name: 'Black Rock',          region: 'West · Shore',  rating: 'great',     forecast: ['great','great','good','good','good','good','great'],           vis: 45, temp: 78, swell: 2.0 },
  { name: 'La Perouse',          region: 'South · Shore', rating: 'good',      forecast: ['good','good','good','fair','fair','good','good'],              vis: 40, temp: 77, swell: 2.2 },
  { name: 'Airport Beach',       region: 'West · Shore',  rating: 'good',      forecast: ['good','good','great','good','good','great','good'],            vis: 38, temp: 78, swell: 2.0 },
];

const BIG_ISLAND_SPOTS: SpotRow[] = [
  { name: 'Kealakekua Bay',  region: 'Kona · Charter', rating: 'excellent', forecast: ['excellent','excellent','excellent','great','great','great','excellent'], vis: 90, temp: 78, swell: 1.0 },
  { name: 'Two Step',        region: 'Kona · Shore',   rating: 'great',     forecast: ['great','great','great','good','good','great','great'],                    vis: 70, temp: 78, swell: 1.2 },
  { name: 'Garden Eel Cove', region: 'Kona · Boat',    rating: 'great',     forecast: ['great','great','good','good','good','good','great'],                      vis: 65, temp: 78, swell: 1.4 },
  { name: 'Manta Heaven',    region: 'Kona · Boat',    rating: 'good',      forecast: ['good','good','good','great','great','good','good'],                       vis: 55, temp: 78, swell: 1.5 },
  { name: 'Kaiwi Point',     region: 'Kona · Shore',   rating: 'good',      forecast: ['good','great','great','good','fair','good','good'],                       vis: 50, temp: 78, swell: 1.6 },
];

const KAUAI_SPOTS: SpotRow[] = [
  { name: 'Koloa Landing',     region: 'South · Shore',   rating: 'great', forecast: ['great','great','good','good','great','great','great'], vis: 50, temp: 76, swell: 2.0 },
  { name: 'Tunnels',           region: 'North · Shore',   rating: 'good',  forecast: ['good','good','fair','fair','fair','good','good'],       vis: 45, temp: 76, swell: 2.5 },
  { name: "Brennecke's Ledge", region: 'South · Shore',   rating: 'good',  forecast: ['good','good','good','great','great','good','good'],     vis: 40, temp: 76, swell: 2.0 },
  { name: 'Nukumoi Point',     region: 'South · Shore',   rating: 'fair',  forecast: ['fair','fair','good','good','good','fair','fair'],       vis: 30, temp: 76, swell: 2.8 },
];

const MOLOKAI_SPOTS: SpotRow[] = [
  { name: "Mo'omomi", region: 'North · Remote', rating: 'fair', forecast: ['fair','fair','no-go','no-go','fair','fair','good'], vis: 25, temp: 77, swell: 4.0 },
];

type FilterTab = 'All conditions' | 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Hazardous';
const FILTER_TABS: readonly FilterTab[] = ['All conditions', 'Excellent', 'Great', 'Good', 'Fair', 'Hazardous'];

// Map top-bar / sidebar filter labels to row tiers. "Hazardous" maps to
// 'no-go' (the dataset's worst tier). 'All conditions' applies no filter.
const TAB_TO_TIER: Partial<Record<FilterTab, ConditionTier>> = {
  Excellent: 'excellent',
  Great: 'great',
  Good: 'good',
  Fair: 'fair',
  Hazardous: 'no-go',
};

// The sidebar's "Condition" group mirrors the top tabs — same labels, same
// tier mapping. `active` is derived from state at render time, not stored
// on the descriptor.
const SIDEBAR_CONDITION_FILTERS: ReadonlyArray<{
  tab: FilterTab;
  tier?: ConditionTier;
  count: number;
}> = [
  { tab: 'All conditions', count: 23 },
  { tab: 'Excellent',      count: 5,  tier: 'excellent' },
  { tab: 'Great',          count: 9,  tier: 'great' },
  { tab: 'Good',           count: 6,  tier: 'good' },
  { tab: 'Fair',           count: 3,  tier: 'fair' },
  { tab: 'Hazardous',      count: 0,  tier: 'no-go' },
];

const SIDEBAR_DIVE_TYPES = ['🤿 Scuba', '🧜 Freediving', '🎣 Spearfishing', '🐠 Snorkel'];

type VisFilter = '80+ ft (gin clear)' | '50–80 ft (clean)' | '25–50 ft (decent)' | '< 25 ft (murky)';
const SIDEBAR_VISIBILITY_FILTERS: readonly VisFilter[] = [
  '80+ ft (gin clear)', '50–80 ft (clean)', '25–50 ft (decent)', '< 25 ft (murky)',
];

function visMatches(vis: number, range: VisFilter): boolean {
  switch (range) {
    case '80+ ft (gin clear)':  return vis >= 80;
    case '50–80 ft (clean)':    return vis >= 50 && vis < 80;
    case '25–50 ft (decent)':   return vis >= 25 && vis < 50;
    case '< 25 ft (murky)':     return vis < 25;
  }
}

const MY_SPOTS = new Set(['Electric Beach', "Shark's Cove", 'Molokini Crater', 'Three Tables']);

// ─── Screen ───────────────────────────────────────────────────────────────

export interface ConditionsScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function ConditionsScreen({ activeNav = 'forecast', onNavigate }: ConditionsScreenProps) {
  const [activeFilter, setActiveFilter] = React.useState<FilterTab>('All conditions');
  const [visFilter, setVisFilter] = React.useState<VisFilter | null>(null);
  const [diveTypeFilter, setDiveTypeFilter] = React.useState<string | null>(null);
  const [mySpotsOnly, setMySpotsOnly] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'grid'>('table');

  const filterRow = React.useCallback(
    (s: SpotRow): boolean => {
      const tabTier = TAB_TO_TIER[activeFilter];
      if (tabTier && s.rating !== tabTier) return false;
      if (visFilter && !visMatches(s.vis, visFilter)) return false;
      if (mySpotsOnly && !MY_SPOTS.has(s.name)) return false;
      return true;
    },
    [activeFilter, visFilter, mySpotsOnly],
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <FilterBar
          value={activeFilter}
          onChange={setActiveFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <View style={styles.body}>
          <Sidebar
            activeFilter={activeFilter}
            onActiveFilterChange={setActiveFilter}
            visFilter={visFilter}
            onVisFilterChange={setVisFilter}
            diveTypeFilter={diveTypeFilter}
            onDiveTypeFilterChange={setDiveTypeFilter}
            mySpotsOnly={mySpotsOnly}
            onMySpotsOnlyChange={setMySpotsOnly}
          />
          <Main filterRow={filterRow} onNavigate={onNavigate} />
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────

function FilterBar({
  value,
  onChange,
  viewMode,
  onViewModeChange,
}: {
  value: FilterTab;
  onChange: (v: FilterTab) => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (m: 'table' | 'grid') => void;
}) {
  return (
    <View style={styles.filterBar}>
      <View style={styles.filterTabs}>
        {FILTER_TABS.map((f) => {
          const active = f === value;
          return (
            <Pressable key={f} onPress={() => onChange(f)} style={[styles.filterTab, active && styles.filterTabActive]}>
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filterDivider} />

      <View style={styles.sortGroup}>
        <Text style={styles.sortLabel}>Sort: Today's rating ▾</Text>
      </View>

      <View style={styles.filterDivider} />

      {/* Table/grid toggle is interactive but grid view isn't implemented
          yet, so for now the active button is purely visual. */}
      <View style={styles.viewToggle}>
        <Pressable
          onPress={() => onViewModeChange('table')}
          style={[styles.viewToggleBtn, viewMode === 'table' && styles.viewToggleBtnActive]}
        >
          <Text style={styles.viewToggleText}>▦</Text>
        </Pressable>
        <Pressable
          onPress={() => onViewModeChange('grid')}
          style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
        >
          <Text style={styles.viewToggleText}>▤</Text>
        </Pressable>
      </View>

      <View style={styles.filterDivider} />

      <Text style={styles.filterCount}>23 spots · Wed Apr 15</Text>
    </View>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────

function Sidebar({
  activeFilter,
  onActiveFilterChange,
  visFilter,
  onVisFilterChange,
  diveTypeFilter,
  onDiveTypeFilterChange,
  mySpotsOnly,
  onMySpotsOnlyChange,
}: {
  activeFilter: FilterTab;
  onActiveFilterChange: (v: FilterTab) => void;
  visFilter: VisFilter | null;
  onVisFilterChange: (v: VisFilter | null) => void;
  diveTypeFilter: string | null;
  onDiveTypeFilterChange: (v: string | null) => void;
  mySpotsOnly: boolean;
  onMySpotsOnlyChange: (v: boolean) => void;
}) {
  // Filter rows toggle: clicking the active filter clears it. Makes the
  // sidebar a self-contained way to back out of a filter without hunting
  // for a separate "clear" button.
  const toggleVis = (label: VisFilter) =>
    onVisFilterChange(visFilter === label ? null : label);
  const toggleDiveType = (label: string) =>
    onDiveTypeFilterChange(diveTypeFilter === label ? null : label);

  return (
    <View style={styles.sidebar}>
      <SidebarGroup title="Condition">
        {SIDEBAR_CONDITION_FILTERS.map((f) => (
          <SidebarFilterRow
            key={f.tab}
            label={f.tab}
            count={f.count}
            tier={f.tier}
            active={f.tab === activeFilter}
            onPress={() => onActiveFilterChange(f.tab)}
          />
        ))}
      </SidebarGroup>

      <Divider />

      <SidebarGroup title="Dive type">
        {SIDEBAR_DIVE_TYPES.map((label) => (
          <SidebarRow
            key={label}
            label={label}
            active={diveTypeFilter === label}
            onPress={() => toggleDiveType(label)}
          />
        ))}
      </SidebarGroup>

      <Divider />

      <SidebarGroup title="Visibility">
        {SIDEBAR_VISIBILITY_FILTERS.map((label) => (
          <SidebarRow
            key={label}
            label={label}
            active={visFilter === label}
            onPress={() => toggleVis(label)}
          />
        ))}
      </SidebarGroup>

      <Divider />

      <TodaysSnapshot />

      <Divider />

      <SidebarGroup title="My spots">
        <SidebarRow
          label={mySpotsOnly ? 'Showing my spots only' : 'Show only my spots'}
          active={mySpotsOnly}
          onPress={() => onMySpotsOnlyChange(!mySpotsOnly)}
        />
        {['Electric Beach', "Shark's Cove", 'Molokini Crater', 'Three Tables'].map((s) => (
          <SidebarRow key={s} label={s} muted />
        ))}
      </SidebarGroup>
    </View>
  );
}

function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sidebarGroup}>
      <Text style={styles.sidebarGroupTitle}>{title}</Text>
      <View style={styles.sidebarGroupItems}>{children}</View>
    </View>
  );
}

function SidebarRow({
  label,
  onPress,
  active,
  muted,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  muted?: boolean;
}) {
  // `muted` is for read-only rows (e.g. the list of my-spot names that
  // sits below the actual "Show only my spots" toggle).
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[styles.sidebarRow, active && styles.sidebarRowActive]}>
      <Text
        style={[
          styles.sidebarRowLabel,
          active && styles.sidebarRowLabelActive,
          muted && styles.sidebarRowLabelMuted,
        ]}
      >
        {label}
      </Text>
    </Wrapper>
  );
}

function SidebarFilterRow({
  label,
  count,
  tier,
  active,
  onPress,
}: {
  label: string;
  count: number;
  tier?: ConditionTier;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.sidebarRow, active && styles.sidebarRowActive]}>
      {tier ? (
        <View style={[styles.sidebarRowDot, { backgroundColor: TIER_COLORS[tier] }]} />
      ) : (
        <View style={{ width: 6 }} />
      )}
      <Text style={[styles.sidebarRowLabel, active && styles.sidebarRowLabelActive]}>{label}</Text>
      <View style={styles.sidebarRowCountWrap}>
        <Text style={styles.sidebarRowCount}>{count}</Text>
      </View>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.sidebarDivider} />;
}

function TodaysSnapshot() {
  // Same numbers used in the sidebar filter counts.
  const SEGMENTS = [
    { tier: 'excellent' as ConditionTier, count: 5 },
    { tier: 'great'     as ConditionTier, count: 9 },
    { tier: 'good'      as ConditionTier, count: 6 },
    { tier: 'fair'      as ConditionTier, count: 3 },
  ];
  const total = SEGMENTS.reduce((s, x) => s + x.count, 0);

  return (
    <View style={styles.snapshot}>
      <View style={styles.snapshotHeader}>
        <Text style={styles.snapshotTitle}>Today across Hawaii</Text>
        <Text style={styles.snapshotUpdated}>Updated 4m ago</Text>
      </View>

      <View style={styles.snapshotBar}>
        {SEGMENTS.map((s) => (
          <View
            key={s.tier}
            style={{
              flex: s.count / total,
              backgroundColor: TIER_COLORS[s.tier],
              height: 6,
            }}
          />
        ))}
      </View>

      <View style={styles.snapshotLegend}>
        {SEGMENTS.map((s) => (
          <View key={s.tier} style={styles.snapshotLegendItem}>
            <View style={[styles.snapshotLegendDot, { backgroundColor: TIER_COLORS[s.tier] }]} />
            <Text style={styles.snapshotLegendText}>{s.count} {s.tier}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

function Main({
  filterRow,
  onNavigate,
}: {
  filterRow: (s: SpotRow) => boolean;
  onNavigate?: NavigateFn;
}) {
  // Pre-filter per-island so we can skip rendering empty island tables.
  // Total filtered count drives the "no spots match" empty state below.
  const islands = [
    { title: "O'ahu",    spots: OAHU_SPOTS.filter(filterRow) },
    { title: 'Maui',     spots: MAUI_SPOTS.filter(filterRow) },
    { title: "Hawai'i",  spots: BIG_ISLAND_SPOTS.filter(filterRow) },
    { title: "Kaua'i",   spots: KAUAI_SPOTS.filter(filterRow) },
    { title: "Moloka'i", spots: MOLOKAI_SPOTS.filter(filterRow) },
  ];
  const total = islands.reduce((n, x) => n + x.spots.length, 0);

  return (
    <View style={styles.main}>
      <FiringNow onNavigate={onNavigate} />
      {total === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No spots match these filters</Text>
          <Text style={styles.emptySub}>Try clearing one — the sidebar filters toggle off on a second click.</Text>
        </View>
      ) : (
        islands
          .filter((i) => i.spots.length > 0)
          .map((i) => <SpotTable key={i.title} title={i.title} spots={i.spots} onNavigate={onNavigate} />)
      )}
    </View>
  );
}

function FiringNow({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.firingNow}>
      <View style={styles.firingNowHeader}>
        <View style={styles.firingNowTitleRow}>
          <View style={styles.firingNowPulse} />
          <Text style={styles.firingNowTitle}>Firing right now</Text>
        </View>
        <Text style={styles.firingNowLink}>See all excellent spots →</Text>
      </View>
      <View style={styles.firingNowCards}>
        {FIRING_NOW.map((s) => (
          <Pressable
            key={s.name}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugify(s.name) })}
            style={{ flex: 1 }}
          >
            <SpotCard {...s} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Spot table (per island) ──────────────────────────────────────────────

function SpotTable({ title, spots, onNavigate }: { title: string; spots: SpotRow[]; onNavigate?: NavigateFn }) {
  const best = bestRating(spots);
  return (
    <View style={styles.tableWrap}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderTitle}>{title}</Text>
        <Text style={styles.tableHeaderSpotCount}>{spots.length} {spots.length === 1 ? 'spot' : 'spots'}</Text>
        <View style={styles.tableHeaderSpacer} />
        <View style={styles.tableHeaderBestWrap}>
          <View style={[styles.tableHeaderBestDot, { backgroundColor: TIER_COLORS[best] }]} />
          <Text style={styles.tableHeaderBestText}>Best: {capitalize(best)}</Text>
        </View>
        <Text style={styles.tableHeaderCaret}>▾</Text>
      </View>

      <View style={styles.tableBody}>
        <View style={styles.tableColumnHeader}>
          <View style={[styles.colSpot]}><Text style={styles.colHeaderText}>Spot</Text></View>
          <View style={[styles.colCondition]}><Text style={styles.colHeaderText}>Condition</Text></View>
          <View style={[styles.colForecast]}><Text style={styles.colHeaderText}>7-day forecast</Text></View>
          <View style={[styles.colVis]}><Text style={styles.colHeaderText}>Vis</Text></View>
          <View style={[styles.colTemp]}><Text style={styles.colHeaderText}>Temp</Text></View>
          <View style={[styles.colSwell]}><Text style={styles.colHeaderText}>Swell</Text></View>
        </View>

        {spots.map((s, i) => (
          <Pressable
            key={s.name}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugify(s.name) })}
            style={[styles.tableRow, i === spots.length - 1 && styles.tableRowLast]}
          >
            <View style={styles.colSpot}>
              <Text style={styles.spotName}>{s.name}</Text>
              <Text style={styles.spotRegion}>{s.region}</Text>
            </View>
            <View style={styles.colCondition}>
              <ConditionPill tier={s.rating} size="sm" />
            </View>
            <View style={styles.colForecast}>
              <View style={styles.forecastBarRow}>
                {s.forecast.map((tier, idx) => (
                  <View key={idx} style={[styles.forecastBar, { backgroundColor: TIER_COLORS[tier] }]} />
                ))}
              </View>
              <View style={styles.forecastDayRow}>
                {['T', 'F', 'S', 'S', 'M', 'T', 'W'].map((d, idx) => (
                  <Text key={idx} style={styles.forecastDayLetter}>{d}</Text>
                ))}
              </View>
            </View>
            <View style={styles.colVis}>
              <Text style={styles.cellValue}>{s.vis}<Text style={styles.cellUnit}> ft</Text></Text>
            </View>
            <View style={styles.colTemp}>
              <Text style={styles.cellValue}>{s.temp}<Text style={styles.cellUnit}> °F</Text></Text>
            </View>
            <View style={styles.colSwell}>
              <Text style={styles.cellValue}>{s.swell}<Text style={styles.cellUnit}> ft</Text></Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function bestRating(rows: SpotRow[]): ConditionTier {
  const order: ConditionTier[] = ['excellent', 'great', 'good', 'fair', 'no-go'];
  for (const t of order) if (rows.some((r) => r.rating === t)) return t;
  return 'no-go';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Styles ───────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 200;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    paddingBottom: 64,
  },

  // ── Filter bar ──
  filterBar: {
    height: 59,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  filterTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  filterTabText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text2,
  },
  filterTabTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.hairline,
  },
  sortGroup: {
    paddingHorizontal: 8,
  },
  sortLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  viewToggle: {
    flexDirection: 'row',
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    padding: 4,
    gap: 2,
  },
  viewToggleBtn: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 2,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.surface2,
  },
  viewToggleText: {
    fontSize: 14,
    color: colors.text2,
  },
  filterCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // ── Body ──
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // ── Sidebar ──
  sidebar: {
    width: SIDEBAR_WIDTH,
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 24,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  sidebarGroup: {
    paddingHorizontal: 12,
    gap: 12,
  },
  sidebarGroupTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  sidebarGroupItems: {
    gap: 2,
  },
  sidebarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: 34,
    borderRadius: radius.sm,
    gap: 10,
  },
  sidebarRowActive: {
    backgroundColor: colors.surface1,
  },
  sidebarRowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sidebarRowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    flex: 1,
  },
  sidebarRowLabelActive: {
    color: colors.text1,
    fontWeight: '500',
  },
  sidebarRowLabelMuted: {
    color: colors.text3,
  },
  emptyWrap: {
    paddingVertical: 56,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text1,
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  sidebarRowCountWrap: {
    minWidth: 18,
    alignItems: 'flex-end',
  },
  sidebarRowCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  sidebarDivider: {
    height: 1,
    marginHorizontal: 12,
    backgroundColor: colors.hairline,
  },
  snapshot: {
    marginHorizontal: 12,
    padding: 15,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    gap: 8,
  },
  snapshotHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  snapshotTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text1,
    flex: 1,
  },
  snapshotUpdated: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  snapshotBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
  },
  snapshotLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    columnGap: 16,
  },
  snapshotLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  snapshotLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  snapshotLegendText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },

  // ── Main ──
  main: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 28,
    gap: 28,
  },

  // ── Firing now ──
  firingNow: {
    gap: 16,
  },
  firingNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  firingNowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  firingNowPulse: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.excellent,
  },
  firingNowTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
  },
  firingNowLink: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.accent,
  },
  firingNowCards: {
    flexDirection: 'row',
    gap: 12,
  },

  // ── Table ──
  tableWrap: {
    gap: 0,
  },
  tableHeader: {
    height: 42,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  tableHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  tableHeaderSpotCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  tableHeaderSpacer: { flex: 1 },
  tableHeaderBestWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableHeaderBestDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tableHeaderBestText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  tableHeaderCaret: {
    fontSize: 12,
    color: colors.text3,
  },
  tableBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.hairline,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  tableColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  colHeaderText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },

  // Column widths roughly match the Figma: spot 260, condition 120,
  // forecast 460 (the hero), vis 60, temp 60, swell 70 — flex on forecast.
  colSpot: { width: 260, paddingHorizontal: 8, gap: 4 },
  colCondition: { width: 120, paddingHorizontal: 8 },
  colForecast: { flex: 1, paddingHorizontal: 8, gap: 6 },
  colVis: { width: 60, alignItems: 'center' },
  colTemp: { width: 60, alignItems: 'center' },
  colSwell: { width: 70, alignItems: 'center' },

  spotName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text1,
  },
  spotRegion: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  forecastBarRow: {
    flexDirection: 'row',
    gap: 4,
    height: 22,
  },
  forecastBar: {
    flex: 1,
    borderRadius: 3,
  },
  forecastDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  forecastDayLetter: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
  },

  cellValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    fontWeight: '500',
  },
  cellUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '400',
  },
});
