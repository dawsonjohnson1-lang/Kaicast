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
import { MetricTile } from './components/MetricTile';
import { HeatmapCell } from './components/HeatmapCell';
import { DiveRow } from './components/DiveRow';
import { KaiCastMap, type MapMarker } from './components/maps/KaiCastMap';
import type { NavigateFn } from './router';

/**
 * Dashboard — desktop screen (Figma 467:4288).
 *
 * Layout:
 *   - DesktopNav (Dashboard active)
 *   - 3-col body:
 *       Left sidebar (240px):  nav anchors + favorites + dive log + profile block
 *       Main (flex):           welcome banner + 4 stat cards + 3 favorite SpotCards + activity heatmap + recent dives
 *       Right rail (340px):    upcoming best window + island breakdown + condition alerts + friends feed
 */

// ─── Mock data ────────────────────────────────────────────────────────────

const USER = {
  initials: 'DJ',
  name: 'Dawson J.',
  location: "Mililani, O'ahu",
  tier: 'Pro member',
  totalDives: 147,
  species: 34,
};

const SIDEBAR_NAV = [
  { key: 'dashboard', label: 'Dashboard',  active: true },
  { key: 'dives',     label: 'My dives',   active: false, count: 147 },
  { key: 'explore',   label: 'Explore',    active: false },
  { key: 'community', label: 'Community',  active: false },
];

const FAVORITES = [
  { name: 'Electric Beach', rating: 'excellent' as ConditionTier, lat: 21.3550, lng: -158.1220, spotId: 'electric-beach' },
  { name: "Shark's Cove",   rating: 'great'     as ConditionTier, lat: 21.6417, lng: -158.0617, spotId: 'sharks-cove' },
  { name: 'Tunnels Beach',  rating: 'good'      as ConditionTier, lat: 22.2233, lng: -159.5705, spotId: 'tunnels-beach' },
  { name: 'Molokini',       rating: 'excellent' as ConditionTier, lat: 20.6330, lng: -156.4950, spotId: 'molokini' },
];

const STATS = [
  { label: 'Total dives',         value: '147', unit: '' },
  { label: 'Cumulative depth',    value: '550', unit: 'ft' },
  { label: 'Total bottom time',   value: '38h 22m', unit: '' },
  { label: 'Species logged',      value: '34',  unit: '' },
];

const FAVORITE_CARDS = [
  { name: 'Electric Beach', region: "O'AHU · LEEWARD",     rating: 'excellent' as ConditionTier, visibilityFt: 56, waterTempF: 79, swellFt: 3, bestWindow: '2pm – 5pm' },
  { name: "Shark's Cove",   region: "O'AHU · NORTH SHORE", rating: 'great'     as ConditionTier, visibilityFt: 48, waterTempF: 78, swellFt: 3.5, bestWindow: '7am – 11am' },
  { name: 'Tunnels Beach',  region: "KAUA'I · NORTH",      rating: 'good'      as ConditionTier, visibilityFt: 45, waterTempF: 76, swellFt: 2.5, bestWindow: '9am – 1pm' },
];

const RECENT_DIVES = [
  { date: 'APR 14', spot: 'Electric Beach', activity: 'Freediving',  depthFt: 38, durationMin: 45, rating: 'excellent' as ConditionTier },
  { date: 'APR 12', spot: "Shark's Cove",   activity: 'Scuba',       depthFt: 52, durationMin: 38, rating: 'great'     as ConditionTier },
  { date: 'APR 09', spot: 'Hanauma Bay',    activity: 'Snorkel',     depthFt: 12, durationMin: 60, rating: 'good'      as ConditionTier },
  { date: 'APR 06', spot: 'Three Tables',   activity: 'Freediving',  depthFt: 45, durationMin: 50, rating: 'great'     as ConditionTier },
  { date: 'APR 03', spot: 'Magic Island',   activity: 'Scuba',       depthFt: 28, durationMin: 42, rating: 'good'      as ConditionTier },
];

const BEST_WINDOW = {
  spotName: 'Electric Beach',
  window: 'Today, 2:00 – 5:00 PM',
  hoursAway: 'PEAK IN 1H 13M',
  rating: 'excellent' as ConditionTier,
};

const ISLAND_BREAKDOWN: Array<{ island: string; counts: Partial<Record<ConditionTier, number>> }> = [
  { island: "O'AHU",      counts: { excellent: 1, great: 2, good: 3, fair: 1 } },
  { island: 'MAUI',       counts: { excellent: 1, great: 2, good: 1, fair: 1 } },
  { island: "BIG ISLAND", counts: { excellent: 2, great: 2, good: 1 } },
  { island: "KAUA'I",     counts: { great: 1, good: 2, fair: 1 } },
];

const DASHBOARD_ALERTS = [
  { title: 'Molokini Crater',                  body: 'Visibility hit 80ft — best reading in 2 weeks.', when: '14M' },
  { title: 'Turtle Canyon · Runoff warning',   body: '48hr advisory after rainfall.',                  when: '2H' },
  { title: 'Hanauma Bay closed Tuesdays',      body: 'Conservation closure. Next open: Wednesday.',    when: '1D' },
];

const FRIENDS_DIVES = [
  { initials: 'KM', name: 'Kai M.',     spot: 'Electric Beach', rating: 'excellent' as ConditionTier, when: 'NOW' },
  { initials: 'LS', name: 'Leilani S.', spot: 'Molokini',       rating: 'excellent' as ConditionTier, when: '14M' },
  { initials: 'MH', name: 'Marcus H.',  spot: "Shark's Cove",   rating: 'great'     as ConditionTier, when: '32M' },
  { initials: 'AT', name: 'Alana T.',   spot: 'Kealakekua',     rating: 'great'     as ConditionTier, when: '1H' },
];

// 52 weeks × 7 days of fake activity
const HEATMAP = (() => {
  const data: number[][] = [];
  for (let w = 0; w < 52; w++) {
    const col: number[] = [];
    for (let d = 0; d < 7; d++) {
      // Cluster activity around weekends + recent weeks
      const recency = w / 52;
      const isWeekend = d === 0 || d === 6;
      const base = isWeekend ? 2 : 0.6;
      const r = Math.random();
      const val = Math.min(4, Math.max(0, Math.round(base * recency + r * 1.5 - 0.5)));
      col.push(val);
    }
    data.push(col);
  }
  return data;
})();

// ─── Screen ───────────────────────────────────────────────────────────────

export interface DashboardScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function DashboardScreen({ activeNav = 'dashboard', onNavigate }: DashboardScreenProps) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.body}>
          <Sidebar onNavigate={onNavigate} />
          <Main onNavigate={onNavigate} />
          <RightRail onNavigate={onNavigate} />
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Left sidebar ─────────────────────────────────────────────────────────

function Sidebar({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarGroupLabel}>NAVIGATION</Text>
        {SIDEBAR_NAV.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              if (item.key === 'dashboard') onNavigate?.('dashboard');
              if (item.key === 'dives')     onNavigate?.('my-dives');
              if (item.key === 'explore')   onNavigate?.('spots-map');
              if (item.key === 'community') onNavigate?.('community');
            }}
            style={[styles.sidebarNavRow, item.active && styles.sidebarNavRowActive]}
          >
            <Text style={[styles.sidebarNavLabel, item.active && styles.sidebarNavLabelActive]}>
              {item.label}
            </Text>
            {item.count != null ? <Text style={styles.sidebarNavCount}>{item.count}</Text> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.sidebarDivider} />

      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarGroupLabel}>FAVORITES</Text>
        {FAVORITES.map((f) => (
          <Pressable
            key={f.name}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugify(f.name) })}
            style={styles.sidebarFavRow}
          >
            <View style={[styles.sidebarFavDot, { backgroundColor: TIER_COLORS[f.rating] }]} />
            <Text style={styles.sidebarFavName}>{f.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sidebarDivider} />

      <View style={styles.sidebarSection}>
        <Text style={styles.sidebarGroupLabel}>DIVE LOG</Text>
        <View style={styles.sidebarLogRow}>
          <Text style={styles.sidebarLogPeriod}>THIS WEEK</Text>
          <Text style={styles.sidebarLogCount}>3</Text>
        </View>
        <View style={styles.sidebarLogRow}>
          <Text style={styles.sidebarLogPeriod}>THIS MONTH</Text>
          <Text style={styles.sidebarLogCount}>12</Text>
        </View>
        <View style={styles.sidebarLogRow}>
          <Text style={styles.sidebarLogPeriod}>THIS YEAR</Text>
          <Text style={styles.sidebarLogCount}>89</Text>
        </View>
      </View>

      <View style={styles.sidebarSpacer} />

      <Pressable
        style={styles.profileBlock}
        onPress={() => onNavigate?.('profile')}
      >
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{USER.initials}</Text>
        </View>
        <Text style={styles.profileName}>{USER.name}</Text>
        <Text style={styles.profileLocation}>{USER.location}</Text>
        <View style={styles.profileTierWrap}>
          <Text style={styles.profileTier}>⬡ {USER.tier}</Text>
        </View>
        <View style={styles.profileStatsRow}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{USER.totalDives}</Text>
            <Text style={styles.profileStatLabel}>Total dives</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{USER.species}</Text>
            <Text style={styles.profileStatLabel}>Species</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────

function Main({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
      <WelcomeBanner onNavigate={onNavigate} />
      <StatsRow />
      <ArchipelagoOverview onNavigate={onNavigate} />
      <FavoriteSpotsRow onNavigate={onNavigate} />
      <HeatmapSection />
      <RecentDivesSection />
    </ScrollView>
  );
}

function ArchipelagoOverview({ onNavigate }: { onNavigate?: NavigateFn }) {
  // Glance-only archipelago map of favorite spots, colored by current
  // condition tier. Read-only — no zoom/pan controls, just an at-a-
  // glance "where am I dialed in" visual. Pin click jumps to detail.
  const markers: MapMarker[] = React.useMemo(
    () => FAVORITES.map((f) => ({ id: f.spotId, lng: f.lng, lat: f.lat, tier: f.rating, label: f.name })),
    [],
  );
  return (
    <View style={styles.archipelagoSection}>
      <View style={styles.archipelagoHeader}>
        <Text style={styles.archipelagoTitle}>YOUR ARCHIPELAGO</Text>
        <Pressable onPress={() => onNavigate?.('spots-map')}>
          <Text style={styles.archipelagoLink}>View all spots →</Text>
        </Pressable>
      </View>
      <View style={styles.archipelagoMapWrap}>
        <KaiCastMap
          markers={markers}
          interactive={false}
          showZoomControls={false}
          onMarkerClick={(spotId) => onNavigate?.('spot-detail', { spotId })}
        />
      </View>
    </View>
  );
}

function WelcomeBanner({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.welcomeBanner}>
      <View style={styles.welcomeText}>
        <Text style={styles.welcomeGreeting}>Good afternoon, Dawson.</Text>
        <Text style={styles.welcomeMeta}>Wednesday, April 15 · 2:41 PM</Text>
        <Text style={styles.welcomeHeadline}>
          <Text style={styles.welcomeHeadlineSpot}>Electric Beach</Text>
          {' is firing — '}
          <Text style={styles.welcomeHeadlineTier}>EXCELLENT</Text>
          {' right now'}
        </Text>
        <Text style={styles.welcomeSub}>Trades drop at 5pm · peak window incoming</Text>

        <View style={styles.welcomeButtonRow}>
          <Pressable
            style={[styles.welcomeBtn, styles.welcomeBtnPrimary]}
            onPress={() => onNavigate?.('log-dive')}
          >
            <Text style={styles.welcomeBtnPrimaryText}>Log a dive</Text>
          </Pressable>
          <Pressable
            style={styles.welcomeBtn}
            onPress={() => onNavigate?.('spots-map')}
          >
            <Text style={styles.welcomeBtnText}>Explore spots</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.welcomeGlow} />
    </View>
  );
}

function StatsRow() {
  return (
    <View style={styles.statsRow}>
      {STATS.map((s) => (
        <View key={s.label} style={styles.statCard}>
          <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
          <MetricTile value={s.value} unit={s.unit} size="lg" />
        </View>
      ))}
    </View>
  );
}

function FavoriteSpotsRow({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Favorite spots</Text>
        <Text style={styles.sectionLink}>Manage favorites →</Text>
      </View>
      <View style={styles.favCardsRow}>
        {FAVORITE_CARDS.map((s) => (
          <Pressable
            key={s.name}
            style={{ flex: 1 }}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugify(s.name) })}
          >
            <SpotCard {...s} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HeatmapSection() {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <Text style={styles.sectionMeta}>147 dives · 52 weeks</Text>
      </View>
      <View style={styles.heatmapWrap}>
        <View style={styles.heatmapGrid}>
          {HEATMAP.map((week, wi) => (
            <View key={wi} style={styles.heatmapCol}>
              {week.map((day, di) => (
                <HeatmapCell key={di} intensity={day as 0 | 1 | 2 | 3 | 4} />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.heatmapLegendRow}>
          <Text style={styles.heatmapLegendLabel}>Less</Text>
          {[0, 1, 2, 3, 4].map((i) => (
            <HeatmapCell key={i} intensity={i as 0 | 1 | 2 | 3 | 4} />
          ))}
          <Text style={styles.heatmapLegendLabel}>More</Text>
        </View>
      </View>
    </View>
  );
}

function RecentDivesSection() {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent dives</Text>
        <Text style={styles.sectionLink}>See all 147 →</Text>
      </View>
      <View style={styles.divesCard}>
        {RECENT_DIVES.map((d) => (
          <DiveRow key={d.date} {...d} />
        ))}
      </View>
    </View>
  );
}

// ─── Right rail ───────────────────────────────────────────────────────────

function RightRail({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.rightRail}>
      <UpcomingBestWindow onNavigate={onNavigate} />
      <IslandBreakdown />
      <ConditionAlerts />
      <FriendsFeed />
    </View>
  );
}

function UpcomingBestWindow({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.rightCard}>
      <View style={styles.rightCardHeader}>
        <Text style={styles.rightCardTitle}>Upcoming best window</Text>
      </View>
      <Pressable
        style={styles.bestWindowBody}
        onPress={() => onNavigate?.('spot-detail', { spotId: slugify(BEST_WINDOW.spotName) })}
      >
        <View style={styles.bestWindowSpotRow}>
          <View style={[styles.bestWindowDot, { backgroundColor: TIER_COLORS[BEST_WINDOW.rating] }]} />
          <Text style={styles.bestWindowSpot}>{BEST_WINDOW.spotName}</Text>
          <ConditionPill tier={BEST_WINDOW.rating} size="sm" />
        </View>
        <Text style={styles.bestWindowTime}>{BEST_WINDOW.window}</Text>
        <Text style={styles.bestWindowCountdown}>★ {BEST_WINDOW.hoursAway}</Text>
      </Pressable>
    </View>
  );
}

function IslandBreakdown() {
  return (
    <View style={styles.rightCard}>
      <View style={styles.rightCardHeader}>
        <Text style={styles.rightCardTitle}>Island breakdown</Text>
      </View>
      <View style={styles.islandBreakdownBody}>
        {ISLAND_BREAKDOWN.map((row) => {
          const total = Object.values(row.counts).reduce((s, n) => s + (n || 0), 0);
          return (
            <View key={row.island} style={styles.islandRow}>
              <Text style={styles.islandLabel}>{row.island}</Text>
              <View style={styles.islandBar}>
                {(['excellent', 'great', 'good', 'fair', 'no-go'] as ConditionTier[]).map((tier) => {
                  const c = row.counts[tier] ?? 0;
                  if (c === 0) return null;
                  return (
                    <View
                      key={tier}
                      style={{
                        flex: c,
                        height: 6,
                        backgroundColor: TIER_COLORS[tier],
                      }}
                    />
                  );
                })}
              </View>
              <Text style={styles.islandCount}>{total}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ConditionAlerts() {
  return (
    <View style={styles.rightCard}>
      <View style={styles.rightCardHeader}>
        <Text style={styles.rightCardTitle}>Condition alerts</Text>
      </View>
      <View style={styles.rightCardBody}>
        {DASHBOARD_ALERTS.map((a, i) => (
          <View
            key={i}
            style={[styles.alertRow, i < DASHBOARD_ALERTS.length - 1 && styles.alertRowDivider]}
          >
            <Text style={styles.alertTitle}>{a.title}</Text>
            <Text style={styles.alertBody}>{a.body}</Text>
            <Text style={styles.alertWhen}>{a.when}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FriendsFeed() {
  return (
    <View style={styles.rightCard}>
      <View style={styles.rightCardHeader}>
        <Text style={styles.rightCardTitle}>Friends' recent dives</Text>
      </View>
      <View>
        {FRIENDS_DIVES.map((f, i) => (
          <View
            key={i}
            style={[styles.friendRow, i < FRIENDS_DIVES.length - 1 && styles.friendRowDivider]}
          >
            <View style={styles.friendAvatar}>
              <Text style={styles.friendAvatarText}>{f.initials}</Text>
            </View>
            <View style={styles.friendTextWrap}>
              <Text style={styles.friendName}>{f.name}</Text>
              <Text style={styles.friendSpot}>at {f.spot}</Text>
            </View>
            <ConditionPill tier={f.rating} size="sm" />
            <Text style={styles.friendWhen}>{f.when}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const SIDEBAR_W = 240;
const RAIL_W = 340;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: DESKTOP_MAX_WIDTH },

  body: { flexDirection: 'row', alignItems: 'flex-start' },

  // ── Sidebar ──
  sidebar: {
    width: SIDEBAR_W,
    paddingVertical: 24,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    minHeight: 1100,
  },
  sidebarSection: {
    paddingHorizontal: 16,
    gap: 6,
  },
  sidebarGroupLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  sidebarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  sidebarNavRowActive: {
    backgroundColor: colors.accentDim,
  },
  sidebarNavLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  sidebarNavLabelActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  sidebarNavCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  sidebarDivider: {
    height: 1,
    marginVertical: 16,
    marginHorizontal: 16,
    backgroundColor: colors.hairline,
  },
  sidebarFavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    gap: 10,
    borderRadius: radius.sm,
  },
  sidebarFavDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sidebarFavName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  sidebarLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 12,
  },
  sidebarLogPeriod: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  sidebarLogCount: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  sidebarSpacer: { flex: 1, minHeight: 24 },

  // Profile block at sidebar bottom
  profileBlock: {
    margin: 16,
    padding: 14,
    backgroundColor: colors.surface0,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    gap: 6,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  profileAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  profileName: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
    marginTop: 6,
  },
  profileLocation: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  profileTierWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.accentDim,
    borderRadius: 4,
    marginTop: 4,
  },
  profileTier: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    width: '100%',
    justifyContent: 'center',
  },
  profileStat: { alignItems: 'center', gap: 2 },
  profileStatValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  profileStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // ── Main ──
  main: { flex: 1, alignSelf: 'stretch' },
  mainContent: {
    paddingHorizontal: 28,
    paddingVertical: 28,
    gap: 28,
  },

  // Welcome banner
  welcomeBanner: {
    padding: 28,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    position: 'relative',
    overflow: 'hidden',
  },
  welcomeGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.accentDim,
    opacity: 0.7,
  },
  welcomeText: { gap: 10 },
  welcomeGreeting: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  welcomeMeta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  welcomeHeadline: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.text2,
    marginTop: 12,
  },
  welcomeHeadlineSpot: {
    color: colors.text1,
    fontWeight: '600',
  },
  welcomeHeadlineTier: {
    color: colors.accent,
    fontWeight: '700',
  },
  welcomeSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  welcomeButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  welcomeBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  welcomeBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  welcomeBtnPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 18,
    gap: 12,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.text3,
  },

  // Archipelago overview map
  archipelagoSection: {
    gap: 10,
  },
  archipelagoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archipelagoTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
  },
  archipelagoLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  archipelagoMapWrap: {
    height: 280,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },

  // Section block (heading + body)
  sectionBlock: { gap: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  sectionLink: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.accent,
  },
  sectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },

  favCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Heatmap
  heatmapWrap: {
    padding: 20,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    gap: 12,
  },
  heatmapGrid: {
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCol: {
    gap: 3,
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  heatmapLegendLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    marginHorizontal: 4,
  },

  divesCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  // ── Right rail ──
  rightRail: {
    width: RAIL_W,
    padding: 16,
    gap: 16,
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  rightCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  rightCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rightCardTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  rightCardBody: {},

  // Best window
  bestWindowBody: {
    padding: 16,
    gap: 8,
  },
  bestWindowSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestWindowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bestWindowSpot: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  bestWindowTime: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  bestWindowCountdown: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.accent,
  },

  // Island breakdown
  islandBreakdownBody: { padding: 16, gap: 10 },
  islandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  islandLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
    width: 80,
  },
  islandBar: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface1,
  },
  islandCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text2,
    width: 24,
    textAlign: 'right',
  },

  // Alerts
  alertRow: {
    padding: 16,
    gap: 4,
    position: 'relative',
  },
  alertRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  alertTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  alertBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    lineHeight: 16,
  },
  alertWhen: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },

  // Friends
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  friendRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
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
  friendTextWrap: { flex: 1, gap: 2 },
  friendName: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  friendSpot: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  friendWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
});
