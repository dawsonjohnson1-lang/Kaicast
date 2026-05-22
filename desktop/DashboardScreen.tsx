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
import { SpotConditionMap } from './components/SpotConditionMap';
import { DiveRow } from './components/DiveRow';
import { KaiCastMap, type MapMarker } from './components/maps/KaiCastMap';
import { useBreakpoint, pick } from './hooks/useBreakpoint';
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

// Personal-data constants are empty for every account at launch — no
// users/{uid} backing exists yet, so showing Dawson's mocked 147 dives
// to a brand-new visitor is misleading. When the user-profile collection
// lands these become per-user lookups.
const USER = {
  initials: '',
  name: '',
  location: '',
  tier: '',
  totalDives: 0,
  species: 0,
};

const SIDEBAR_NAV = [
  { key: 'dashboard', label: 'Dashboard',  active: true },
  { key: 'dives',     label: 'My dives',   active: false, count: 0 },
  { key: 'explore',   label: 'Explore',    active: false },
  { key: 'community', label: 'Community',  active: false },
];

// Canonical spots lookup is still needed for the map; but FAVORITES
// (the user's saved spots) is empty until they actually star one.
import { findSpot as findCanonicalSpot } from './data/spots';
import { useSpotRatings, useSpotReport, tierFromRating, bestWindowLabel, type BackendReport } from './data/getReport';
import { useFavorites } from './hooks/useFavorites';
import { useAuth } from './hooks/useAuth';
const FAVORITE_IDS: ReadonlyArray<string> = [];

// Default favorite spots shown on the dashboard only when the user
// hasn't hearted any spots yet. Once they pick favorites, the
// FavoriteSpotsRow renders their actual list instead (see hook).
const DEFAULT_FAVORITE_SPOT_IDS: ReadonlyArray<string> = [
  'electric-beach',
  'sharks-cove',
  'molokini-crater',
];
const BASE_FAVORITES: Array<{
  name: string; rating: ConditionTier; lat: number; lng: number; spotId: string;
}> = FAVORITE_IDS
  .map((id) => findCanonicalSpot(id))
  .filter((s): s is NonNullable<ReturnType<typeof findCanonicalSpot>> => !!s)
  .map((s) => ({
    name: s.name,
    rating: 'good' as ConditionTier,
    lat: s.lat,
    lng: s.lon,
    spotId: s.id,
  }));

const STATS = [
  { label: 'Total dives',         value: '0',  unit: '' },
  { label: 'Cumulative depth',    value: '0',  unit: 'ft' },
  { label: 'Total bottom time',   value: '0h', unit: '' },
  { label: 'Species logged',      value: '0',  unit: '' },
];

const RECENT_DIVES: Array<{
  date: string; spot: string; activity: string;
  depthFt: number; durationMin: number; rating: ConditionTier;
}> = [];

const BEST_WINDOW: {
  spotName: string; window: string; hoursAway: string; rating: ConditionTier;
} | null = null;

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

// Friends' recent dives — empty until the friend graph + dive feed
// surfaces in the real backend.
const FRIENDS_DIVES: Array<{
  initials: string; name: string; spot: string; rating: ConditionTier; when: string;
}> = [];

// 52 weeks × 7 days — all zeros until the user has logged dives.
const HEATMAP: number[][] = Array.from({ length: 52 }, () =>
  Array.from({ length: 7 }, () => 0),
);

// ─── Screen ───────────────────────────────────────────────────────────────

export interface DashboardScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function DashboardScreen({ activeNav = 'dashboard', onNavigate }: DashboardScreenProps) {
  const bp = useBreakpoint();
  const sidebarW = pick(bp, 240, 200);
  const railW = pick(bp, 340, 260);

  // Real favorites from the per-user useFavorites hook. Resolves each
  // favorited spotId to its canonical record (lat/lon/name/region) via
  // findCanonicalSpot, then layers today's live tier on top through
  // useSpotRatings. IDs that no longer exist in SPOTS (e.g. user
  // favorited something we later deleted from data/spots.ts) silently
  // drop out instead of rendering as a broken row.
  const favs = useFavorites();
  const favoriteIds = React.useMemo(() => [...favs.ids], [favs.ids]);
  const liveRatings = useSpotRatings(favoriteIds);
  const favorites: FavoriteRow[] = React.useMemo(
    () =>
      favoriteIds
        .map((id) => {
          const spot = findCanonicalSpot(id);
          if (!spot) return null;
          return {
            name: spot.name,
            rating: liveRatings.get(id) ?? ('good' as ConditionTier),
            lat: spot.lat,
            lng: spot.lon,
            spotId: spot.id,
          };
        })
        .filter((f): f is FavoriteRow => !!f),
    [favoriteIds, liveRatings],
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.body}>
          <View style={{ width: sidebarW }}>
            <Sidebar onNavigate={onNavigate} favorites={favorites} />
          </View>
          <Main onNavigate={onNavigate} favorites={favorites} />
          <View style={{ width: railW }}>
            <RightRail onNavigate={onNavigate} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// Shape the Sidebar / Main / ArchipelagoOverview expect for each favorite.
// Used to live as `(typeof BASE_FAVORITES)[number]` back when this list was
// hardcoded; now BASE_FAVORITES is always empty, so we declare it explicitly.
type FavoriteRow = {
  name: string;
  rating: ConditionTier;
  lat: number;
  lng: number;
  spotId: string;
};

// ─── Left sidebar ─────────────────────────────────────────────────────────

function Sidebar({ onNavigate, favorites }: { onNavigate?: NavigateFn; favorites: FavoriteRow[] }) {
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
        {favorites.length === 0 ? (
          <Pressable
            onPress={() => onNavigate?.('spots-map')}
            style={styles.sidebarFavEmpty}
          >
            <Text style={styles.sidebarFavEmptyText}>
              No favorites yet — open a spot and tap the heart to save it.
            </Text>
          </Pressable>
        ) : (
          favorites.map((f) => (
            <Pressable
              key={f.spotId}
              onPress={() => onNavigate?.('spot-detail', { spotId: f.spotId })}
              style={styles.sidebarFavRow}
            >
              <View style={[styles.sidebarFavDot, { backgroundColor: TIER_COLORS[f.rating] }]} />
              <Text style={styles.sidebarFavName}>{f.name}</Text>
            </Pressable>
          ))
        )}
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

function Main({
  onNavigate,
  favorites,
}: {
  onNavigate?: NavigateFn;
  favorites: FavoriteRow[];
}) {
  return (
    <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
      <WelcomeBanner onNavigate={onNavigate} favorites={favorites} />
      <StatsRow />
      <ArchipelagoOverview onNavigate={onNavigate} favorites={favorites} />
      <FavoriteSpotsRow onNavigate={onNavigate} favoriteSpotIds={favorites.map((f) => f.spotId)} />
      <HeatmapSection onNavigate={onNavigate} />
      <RecentDivesSection />
    </ScrollView>
  );
}

function ArchipelagoOverview({ onNavigate, favorites }: { onNavigate?: NavigateFn; favorites: FavoriteRow[] }) {
  // Glance-only archipelago map of favorite spots, colored by current
  // condition tier. Read-only — no zoom/pan controls, just an at-a-
  // glance "where am I dialed in" visual. Pin click jumps to detail.
  const markers: MapMarker[] = React.useMemo(
    () => favorites.map((f) => ({ id: f.spotId, lng: f.lng, lat: f.lat, tier: f.rating, label: f.name })),
    [favorites],
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

// Tier ranking — lower index is better. Used to pick the user's
// "best favorite right now" for the welcome headline.
const TIER_RANK: Record<ConditionTier, number> = {
  excellent: 0, great: 1, good: 2, fair: 3, 'no-go': 4,
};
const TIER_HEADLINE_WORD: Record<ConditionTier, string> = {
  excellent: 'firing',
  great:     'great',
  good:      'solid',
  fair:      'fair',
  'no-go':   'tough',
};

function WelcomeBanner({
  onNavigate,
  favorites,
}: {
  onNavigate?: NavigateFn;
  favorites: FavoriteRow[];
}) {
  const auth = useAuth();
  // Live greeting + date so the banner doesn't look like a frozen mockup.
  const now = new Date();
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  // First name from displayName (split on whitespace). Falls through to
  // the email local-part for accounts where displayName isn't set yet.
  // Final fallback is "diver" so the greeting still reads as a sentence.
  const firstName =
    auth.user?.displayName?.trim().split(/\s+/)[0] ||
    auth.user?.email?.split('@')[0] ||
    'diver';

  // Best favorite right now — sorted by today's live tier rank, ties
  // broken alphabetically by name so the same spot stays headlined as
  // long as the rating holds. Null when the user hasn't favorited
  // anything yet.
  const topFav = favorites.length === 0
    ? null
    : [...favorites].sort((a, b) => {
        const r = TIER_RANK[a.rating] - TIER_RANK[b.rating];
        return r !== 0 ? r : a.name.localeCompare(b.name);
      })[0];

  return (
    <View style={styles.welcomeBanner}>
      <View style={styles.welcomeText}>
        <Text style={styles.welcomeGreeting}>{greeting}, {firstName}.</Text>
        <Text style={styles.welcomeMeta}>{dateStr} · {timeStr}</Text>

        {topFav ? (
          <Text style={styles.welcomeHeadline}>
            <Text style={styles.welcomeHeadlineSpot}>{topFav.name}</Text>
            {` is ${TIER_HEADLINE_WORD[topFav.rating]} — `}
            <Text style={styles.welcomeHeadlineTier}>{topFav.rating.toUpperCase()}</Text>
            {' right now'}
          </Text>
        ) : (
          <Text style={styles.welcomeHeadline}>
            Find spots you love, then we'll surface their best windows here.
          </Text>
        )}
        <Text style={styles.welcomeSub}>
          {topFav
            ? `Check the forecast strip below for the next 7 days.`
            : `Browse the map — tap the heart on any spot to make it yours.`}
        </Text>

        <View style={styles.welcomeButtonRow}>
          <Pressable
            style={[styles.welcomeBtn, styles.welcomeBtnPrimary]}
            onPress={() => onNavigate?.(topFav ? 'log-dive' : 'spots-map')}
          >
            <Text style={styles.welcomeBtnPrimaryText}>
              {topFav ? 'Log a dive' : 'Find your spots'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.welcomeBtn}
            onPress={() => onNavigate?.(topFav ? 'spot-detail' : 'spots-map', topFav ? { spotId: topFav.spotId } : undefined)}
          >
            <Text style={styles.welcomeBtnText}>
              {topFav ? `Open ${topFav.name}` : 'Explore spots'}
            </Text>
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

function FavoriteSpotsRow({
  onNavigate,
  favoriteSpotIds,
}: {
  onNavigate?: NavigateFn;
  favoriteSpotIds: string[];
}) {
  const hasFavorites = favoriteSpotIds.length > 0;
  // When the user has no favorites yet, surface the three popular
  // starter spots so the row isn't an empty rectangle — and mark the
  // section accordingly so they know to click the heart on one.
  const idsToShow = hasFavorites ? favoriteSpotIds.slice(0, 6) : DEFAULT_FAVORITE_SPOT_IDS;

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {hasFavorites ? 'Your favorite spots' : 'Popular spots'}
        </Text>
        <Pressable onPress={() => onNavigate?.('spots-map')}>
          <Text style={styles.sectionLink}>
            {hasFavorites ? 'Manage favorites →' : 'Find your spots →'}
          </Text>
        </Pressable>
      </View>
      {!hasFavorites ? (
        <Text style={styles.favCardsHint}>
          Tap the heart on any spot to pin it here.
        </Text>
      ) : null}
      <View style={styles.favCardsRow}>
        {idsToShow.map((spotId) => (
          <LiveFavoriteCard key={spotId} spotId={spotId} onNavigate={onNavigate} />
        ))}
      </View>
    </View>
  );
}

// Render a single SpotCard with live conditions pulled from getReport.
// Each card owns its own useSpotReport call — they cache per-spotId so
// re-renders don't refetch and the 3 calls fire in parallel.
function LiveFavoriteCard({
  spotId,
  onNavigate,
}: {
  spotId: string;
  onNavigate?: NavigateFn;
}) {
  const { data: report, loading } = useSpotReport(spotId);
  const canonical = findCanonicalSpot(spotId);
  const name = canonical?.name ?? spotId;
  // Canonical Spot only has a single `region` field (e.g. "Oahu") —
  // surface it as the card's region line. No coast/subregion in this
  // dataset yet.
  const region = canonical ? canonical.region.toUpperCase() : '';
  const props = buildSpotCardProps(report, { name, region, fallbackTier: 'good' });

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => onNavigate?.('spot-detail', { spotId })}
    >
      <SpotCard {...props} />
      {loading && !report ? (
        <Text style={styles.favCardLoading}>Loading…</Text>
      ) : null}
    </Pressable>
  );
}

const M_TO_FT = (m: number) => Math.round(m * 3.28084);
const C_TO_F = (c: number) => Math.round(c * 1.8 + 32);

function buildSpotCardProps(
  report: BackendReport | null,
  defaults: { name: string; region: string; fallbackTier: ConditionTier },
): {
  name: string;
  region: string;
  rating: ConditionTier;
  visibilityFt: number;
  waterTempF: number;
  swellFt: number;
  bestWindow: string;
} {
  const visFt = (report?.now?.visibility as { estimatedVisibilityFeet?: number } | undefined)
    ?.estimatedVisibilityFeet ?? 0;
  const waterC = report?.now?.metrics?.waterTempC;
  const waveM = report?.now?.metrics?.waveHeightM;
  const rating = report ? tierFromRating(report.now?.rating) : defaults.fallbackTier;
  const bestWin = bestWindowLabel(report?.windows) ?? '—';
  return {
    name: defaults.name,
    region: defaults.region,
    rating,
    visibilityFt: Math.round(visFt),
    waterTempF: typeof waterC === 'number' ? C_TO_F(waterC) : 0,
    swellFt: typeof waveM === 'number' ? M_TO_FT(waveM) : 0,
    bestWindow: bestWin,
  };
}

function HeatmapSection({ onNavigate }: { onNavigate?: NavigateFn }) {
  // Was a year-in-review activity grid; replaced with a compact Hawaii
  // map of every spot dot-colored by today's tier. More immediately
  // useful (and not empty for new users).
  return (
    <View style={styles.sectionBlock}>
      <SpotConditionMap
        title="Conditions across Hawaii"
        subtitle="Every KaiCast spot · colored by today's rating · click to open"
        height={300}
        onNavigate={onNavigate}
      />
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
  if (!BEST_WINDOW) {
    return (
      <View style={styles.rightCard}>
        <View style={styles.rightCardHeader}>
          <Text style={styles.rightCardTitle}>Upcoming best window</Text>
        </View>
        <Pressable style={styles.bestWindowBody} onPress={() => onNavigate?.('spots-map')}>
          <Text style={styles.bestWindowTime}>Save spots to your favorites and we'll surface their best window here.</Text>
        </Pressable>
      </View>
    );
  }
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: DESKTOP_MAX_WIDTH },

  body: { flexDirection: 'row', alignItems: 'flex-start' },

  // ── Sidebar ──
  sidebar: {
    // Width comes from the responsive wrapper in DashboardScreen.
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
  sidebarFavEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sidebarFavEmptyText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
    lineHeight: 15,
  },
  favCardsHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
    marginBottom: 4,
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
  favCardLoading: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
    letterSpacing: 0.6,
    marginTop: 4,
    paddingLeft: 4,
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
    // Width comes from the responsive wrapper in DashboardScreen.
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
