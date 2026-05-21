import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, StyleSheet } from 'react-native';
import profileHeaderBg from './assets/figma/backgrounds/profile-header.png';
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
import { HeatmapCell } from './components/HeatmapCell';
import { DiveReportCard, type DiveReportCardProps } from './components/DiveReportCard';
import { initialsFromUser, useAuth } from './hooks/useAuth';
import type { NavigateFn } from './router';

/**
 * Profile — desktop screen (Figma 472:3274).
 *
 * Layout:
 *   - DesktopNav (no specific item active — Profile is reached via avatar)
 *   - Full-width hero header (ocean photo bg placeholder, avatar, name,
 *     stats row, action buttons, forecaster badge + PR card on right)
 *   - Sticky tab bar (Dashboard active)
 *   - 2-col body:
 *       Main: stat cards (3) → heatmap → recent dives list
 *       Sidebar (340px): favorite spots, species grid, achievements
 *
 * Per the spec we render inside a 1440px centered container, ignoring
 * the source Figma's 1920px import artifact.
 */

// ─── Mock data ────────────────────────────────────────────────────────────

// Personal stats / lists / achievements are empty for every account at
// launch. There's no users/{uid} Firestore collection yet, so we can't
// hydrate per-user data — and showing Dawson's mock numbers to a brand
// new user is worse than showing zero. When the user-profile collection
// lands, these become `useUserProfile(uid)` lookups instead.
const USER = {
  initials: '',
  name: '',
  handle: '',
  location: '',
  bio: '',
  stats: [
    { label: 'Dives',     value: '0' },
    { label: 'Spots',     value: '0' },
    { label: 'Species',   value: '0' },
    { label: 'Followers', value: '0' },
    { label: 'Following', value: '0' },
  ],
};

const TABS = ['Dashboard', 'Dive Reports', 'Friends', 'Settings'] as const;

const STAT_CARDS = [
  { icon: '🤿', value: '0', unit: '',   label: 'Dives logged' },
  { icon: '📏', value: '—', unit: 'ft', label: 'Personal depth record' },
  { icon: '⏱',  value: '0', unit: 'h',  label: 'Total bottom time' },
];

const DIVE_LIST: Array<{
  spot: string; meta: string; type: string;
  depth: number; duration: number; vis: number; stars: number;
}> = [];

const FAVORITES: Array<{
  name: string; region: string; rating: ConditionTier;
  vis: number; water: number; current: number;
}> = [];

const SPECIES: Array<{ emoji: string; name: string; rare?: boolean }> = [];

const DIVE_REPORTS: DiveReportCardProps[] = [];

/* Mock reports retained as reference but excluded from the empty-state build.
const _MOCK_REPORTS: DiveReportCardProps[] = [
  {
    date: 'Apr 14, 2024', time: '9:12 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🤿 Scuba', rating: 'excellent',
    depthFt: 68, durationMin: 52, vizFt: 60, waterTempF: 79, airTempF: 82,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
    wildlife: ['Green Turtle', 'Reef Fish', 'Octopus'],
    notes:
      'Crystal clear today — trades dropped out around noon and the outflow did its thing. Entry at the stairs was easy, viz opened up immediately. Saw a hawksbill at the cleaning station around 35ft. Made it down the wall to the pipe at 65ft, finished air with safety stop on the rope. Best dive in weeks.',
    photoCount: 7, stars: 5, recommend: 'Definitely',
  },
  {
    date: 'Apr 12, 2024', time: '7:30 AM',
    spot: "Shark's Cove", region: "O'AHU · NORTH SHORE",
    diveType: '🧜 Freediving', rating: 'great',
    depthFt: 42, durationMin: 38, vizFt: 48, waterTempF: 77, airTempF: 78,
    conditions: { current: 'None', surface: 'Calm', surge: 'Mild' },
    wildlife: ['Reef Fish', 'Eagle Ray'],
    notes:
      'Glassy morning. Hit 42ft on a comfortable hold, kept seeing eagle rays cruise past the deeper lava arches. Worked on equalization down to that depth — much easier than last week. Vis was beautiful in the channels.',
    photoCount: 3, stars: 5, recommend: 'Definitely',
  },
  {
    date: 'Apr 6, 2024', time: '8:00 AM',
    spot: 'Molokini Crater', region: 'MAUI · SOUTH SHORE',
    diveType: '🤿 Scuba', rating: 'excellent',
    depthFt: 110, durationMin: 44, vizFt: 80, waterTempF: 77, airTempF: 81,
    conditions: { current: 'Moderate', surface: 'Light chop', surge: 'None' },
    wildlife: ['Humpback', 'Reef Shark', 'Reef Fish', 'Moray Eel'],
    notes:
      'Personal best depth — 110ft on a deep wall dive outside the crater. Heard humpback song the entire dive, two passed close enough to see. Current was the real one but manageable on the descent. Nitrox 32 gave me a comfortable 22 min bottom time before slow ascent.',
    photoCount: 12, stars: 5, recommend: 'Definitely',
  },
  {
    date: 'Apr 4, 2024', time: '6:45 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🎣 Spearfishing', rating: 'great',
    depthFt: 35, durationMin: 62, vizFt: 50, waterTempF: 78,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'Mild' },
    wildlife: ['Reef Fish'],
    notes:
      'Pre-dawn session. Got one nice ulua but mostly just enjoyed the dawn light through the water. Vis cleaned up beautifully after the wind died.',
    photoCount: 2, stars: 4, recommend: 'Yes',
  },
  {
    date: 'Mar 31, 2024', time: '11:00 AM',
    spot: 'Hanauma Bay', region: "O'AHU · EAST SHORE",
    diveType: '🐠 Snorkel', rating: 'good',
    depthFt: 12, durationMin: 60, vizFt: 30, waterTempF: 79,
    conditions: { current: 'None', surface: 'Calm', surge: 'None' },
    wildlife: ['Green Turtle', 'Reef Fish', 'Pufferfish'],
    notes:
      'Took the family out for a chill snorkel session. Crowded but the reef is in good shape — saw three turtles and a friendly puffer. Kid loved it.',
    photoCount: 5, stars: 4, recommend: 'Yes',
  },
  {
    date: 'Mar 28, 2024', time: '5:30 PM',
    spot: 'Three Tables', region: "O'AHU · NORTH SHORE",
    diveType: '🧜 Freediving', rating: 'great',
    depthFt: 45, durationMin: 50, vizFt: 55, waterTempF: 76,
    conditions: { current: 'None', surface: 'Calm', surge: 'None' },
    wildlife: ['Reef Shark', 'Reef Fish'],
    notes:
      'Sunset session. Two whitetips cruising the deeper sand patches, totally indifferent. Held a 1:50 PB on a hangout at 30ft.',
    photoCount: 0, stars: 5, recommend: 'Definitely',
  },
  {
    date: 'Mar 24, 2024', time: '10:15 AM',
    spot: 'Magic Island', region: "O'AHU · SOUTH SHORE",
    diveType: '🤿 Scuba', rating: 'good',
    depthFt: 28, durationMin: 42, vizFt: 35, waterTempF: 80,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
    wildlife: ['Reef Fish', 'Squid'],
    notes:
      'Easy shore dive to refresh skills. Some particulate but plenty of life on the rubble flats. Practiced neutral buoyancy drills.',
    photoCount: 4, stars: 3, recommend: 'With caveats',
  },
  {
    date: 'Mar 20, 2024', time: '7:00 AM',
    spot: 'Two Step', region: 'BIG ISLAND · WEST',
    diveType: '🤿 Scuba', rating: 'great',
    depthFt: 55, durationMin: 48, vizFt: 70, waterTempF: 78, airTempF: 80,
    conditions: { current: 'None', surface: 'Calm', surge: 'Mild' },
    wildlife: ['Dolphin', 'Reef Fish', 'Eagle Ray'],
    notes:
      'Drove down the coast for this one — got rewarded with a spinner pod that played around the dive boat for 20 minutes after we surfaced. The reef itself is stellar; visibility was the clearest I have seen on this side of the island.',
    photoCount: 9, stars: 5, recommend: 'Definitely',
  },
];
*/

const DIVE_TYPE_FILTERS = ['All', 'Scuba', 'Freediving', 'Spearfishing', 'Snorkel'] as const;

const ACHIEVEMENTS: Array<{ emoji: string; title: string; desc: string; tier?: 'gold' | 'silver' }> = [];

// All-zeros heatmap until real dive data populates it.
const HEATMAP: Array<Array<0 | 1 | 2 | 3 | 4>> = Array.from({ length: 52 }, () =>
  Array.from({ length: 7 }, () => 0 as const),
);

// Earned-on-demand: the Forecaster badge appears once the user's reports
// have demonstrably good accuracy. Hidden until then.
const FORECASTER_BADGE: { label: string; sub: string } | null = null;

// Personal-record card only renders once the user has logged a dive.
const PERSONAL_RECORD: { label: string; depthFt: number; spot: string; date: string } | null = null;

// ─── Screen ───────────────────────────────────────────────────────────────

export interface ProfileScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

type EditableProfile = {
  name: string;
  handle: string;
  location: string;
  bio: string;
};

export function ProfileScreen({ activeNav = 'dashboard', onNavigate }: ProfileScreenProps) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>('Dashboard');
  const auth = useAuth();

  // Editable profile fields, lifted here so the header and the Settings
  // tab's Account section read/write the same source of truth. Seed from
  // the Firebase auth user once at mount; later edits live in local
  // state until we have a users/{uid} doc to persist to.
  const [profile, setProfile] = React.useState<EditableProfile>(() => ({
    name: auth.user?.displayName?.trim() || USER.name,
    handle: auth.user?.email ? `@${auth.user.email.split('@')[0]}` : USER.handle,
    location: USER.location,
    bio: USER.bio,
  }));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <ProfileHeader
          profile={profile}
          onEditProfile={() => setTab('Settings')}
        />
        <TabBar value={tab} onTab={setTab} />
        {tab === 'Dashboard'    ? <DashboardTabBody    onNavigate={onNavigate} /> : null}
        {tab === 'Dive Reports' ? <DiveReportsTabBody  onNavigate={onNavigate} /> : null}
        {tab === 'Friends'      ? <FriendsTabBody onNavigate={onNavigate} /> : null}
        {tab === 'Settings'     ? <SettingsTabBody profile={profile} setProfile={setProfile} /> : null}
      </View>
    </ScrollView>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <View style={styles.comingSoonWrap}>
      <Text style={styles.comingSoonIcon}>◇</Text>
      <Text style={styles.comingSoonTitle}>{name} tab</Text>
      <Text style={styles.comingSoonSub}>Coming soon — being built one tab per turn.</Text>
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────

function ProfileHeader({
  profile,
  onEditProfile,
}: {
  profile: EditableProfile;
  onEditProfile?: () => void;
}) {
  const auth = useAuth();
  // Display values now flow from the lifted `profile` state — edits in
  // Settings update here live. Initials still derive from auth so they
  // track when the user signs out/in.
  const displayName = profile.name || USER.name;
  const displayInitials = initialsFromUser(auth.user, USER.initials);
  const handle = profile.handle || USER.handle;

  const onSignOut = async () => {
    try { await auth.signOut(); } catch {}
  };

  return (
    <View style={styles.header}>
      {/* Jellyfish photo, blurred via CSS filter for the frosted-glass
          finish. Scaled up slightly so the blur radius doesn't reveal
          transparent edges inside the clipped header. RN Web passes
          `filter` through; backdrop-filter doesn't make it. */}
      <Image
        source={{ uri: profileHeaderBg }}
        style={[
          styles.headerBg,
          {
            filter: 'blur(14px) saturate(135%) brightness(0.82)',
            transform: [{ scale: 1.08 }],
          } as object,
        ]}
        resizeMode="cover"
      />
      {/* Glass sheen: subtle white wash on top of the blurred photo. */}
      <View style={styles.headerSheen} />
      {/* Dark vignette for text contrast against the sheen. */}
      <View style={styles.headerOverlay} />

      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarOuter}>
            {auth.user?.photoURL ? (
              <Image source={{ uri: auth.user.photoURL }} style={styles.avatar as object} resizeMode="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayInitials}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerNameWrap}>
            <Text style={styles.headerName}>{displayName}</Text>
            <View style={styles.headerHandleRow}>
              <Text style={styles.headerHandle}>{handle}</Text>
              {profile.location ? <View style={styles.headerHandleDot} /> : null}
              <Text style={styles.headerHandle}>{profile.location}</Text>
            </View>
            <Text style={styles.headerBio}>{profile.bio}</Text>

            <View style={styles.headerStatsRow}>
              {USER.stats.map((s) => (
                <View key={s.label} style={styles.headerStat}>
                  <Text style={styles.headerStatValue}>{s.value}</Text>
                  <Text style={styles.headerStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.headerButtonRow}>
              {/* On your own profile, the "follow / message" pair becomes
                  "edit / sign out". Real follow/message live on other
                  divers' profiles once that flow exists. */}
              <Pressable style={[styles.headerBtn, styles.headerBtnPrimary]} onPress={onEditProfile}>
                <Text style={styles.headerBtnPrimaryText}>Edit profile</Text>
              </Pressable>
              <Pressable style={styles.headerBtn} onPress={onSignOut}>
                <Text style={styles.headerBtnText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {FORECASTER_BADGE != null || PERSONAL_RECORD != null ? (
          <View style={styles.headerRight}>
            {FORECASTER_BADGE != null ? (
              <View style={styles.forecasterBadge}>
                <Text style={styles.forecasterEmoji}>🔮</Text>
                <Text style={styles.forecasterLabel}>{FORECASTER_BADGE.label}</Text>
                <Text style={styles.forecasterSub}>{FORECASTER_BADGE.sub}</Text>
              </View>
            ) : null}

            {PERSONAL_RECORD != null ? (
              <View style={styles.prCard}>
                <Text style={styles.prLabel}>{PERSONAL_RECORD.label}</Text>
                <View style={styles.prValueRow}>
                  <Text style={styles.prValue}>{PERSONAL_RECORD.depthFt}</Text>
                  <Text style={styles.prUnit}>ft</Text>
                </View>
                <Text style={styles.prSpot}>{PERSONAL_RECORD.spot}</Text>
                <Text style={styles.prDate}>{PERSONAL_RECORD.date}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────

function TabBar({
  value,
  onTab,
}: {
  value: (typeof TABS)[number];
  onTab: (t: (typeof TABS)[number]) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const isActive = t === value;
        return (
          <Pressable key={t} onPress={() => onTab(t)} style={styles.tabBtn}>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t}</Text>
            {isActive ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Dashboard tab body ───────────────────────────────────────────────────

function DashboardTabBody({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.body}>
      <View style={styles.bodyMain}>
        <View style={styles.statCardsRow}>
          {STAT_CARDS.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statCardIcon}>{s.icon}</Text>
              <View style={styles.statCardValueRow}>
                <Text style={styles.statCardValue}>{s.value}</Text>
                {s.unit ? <Text style={styles.statCardUnit}>{s.unit}</Text> : null}
              </View>
              <Text style={styles.statCardLabel}>{s.label}</Text>
              <Text style={styles.statCardBgIcon}>{s.icon}</Text>
            </View>
          ))}
        </View>

        <HeatmapBlock />

        <RecentDivesBlock />
      </View>

      <View style={styles.bodySidebar}>
        <FavoriteSpotsSidebar onNavigate={onNavigate} />
        <SpeciesBlock />
        <AchievementsBlock />
      </View>
    </View>
  );
}

function DiveReportsTabBody({ onNavigate }: { onNavigate?: NavigateFn }) {
  const [filter, setFilter] = React.useState<(typeof DIVE_TYPE_FILTERS)[number]>('All');
  const [sort, setSort] = React.useState<'recent' | 'deepest' | 'longest'>('recent');

  const filtered = React.useMemo(() => {
    let list = filter === 'All'
      ? DIVE_REPORTS
      : DIVE_REPORTS.filter((d) => d.diveType.toLowerCase().includes(filter.toLowerCase()));
    if (sort === 'deepest') list = [...list].sort((a, b) => b.depthFt - a.depthFt);
    else if (sort === 'longest') list = [...list].sort((a, b) => b.durationMin - a.durationMin);
    // 'recent' = mock order is already chronological-desc
    return list;
  }, [filter, sort]);

  return (
    <View style={styles.body}>
      <View style={styles.bodyMain}>
        <View style={styles.diveReportsFilterRow}>
          <View style={styles.diveReportsFilterChips}>
            {DIVE_TYPE_FILTERS.map((f) => {
              const active = f === filter;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.drFilterChip, active && styles.drFilterChipActive]}
                >
                  <Text style={[styles.drFilterChipText, active && styles.drFilterChipTextActive]}>{f}</Text>
                  {active ? (
                    <Text style={styles.drFilterChipCount}>{filtered.length}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.diveReportsSortWrap}>
            {(['recent', 'deepest', 'longest'] as const).map((s) => {
              const active = s === sort;
              return (
                <Pressable key={s} onPress={() => setSort(s)} style={styles.drSortBtn}>
                  <Text style={[styles.drSortText, active && styles.drSortTextActive]}>
                    {s === 'recent' ? 'Most recent' : s === 'deepest' ? 'Deepest' : 'Longest'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.diveReportsList}>
          {filtered.map((r, i) => (
            <DiveReportCard
              key={i}
              {...r}
              onPress={() => onNavigate?.('spot-detail', { spotId: slugifyName(r.spot) })}
            />
          ))}
          {filtered.length === 0 ? (
            <View style={styles.drEmpty}>
              <Text style={styles.drEmptyTitle}>No dives match "{filter}"</Text>
              <Text style={styles.drEmptySub}>Adjust the filter above or log a new dive.</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.bodySidebar}>
        <DiveTypeBreakdown />
        <IslandBreakdown />
        <RecentSpotsBlock onNavigate={onNavigate} />
      </View>
    </View>
  );
}

function DiveTypeBreakdown() {
  // Compute from the mock list so the bars match what's rendered above.
  const counts: Record<string, number> = {};
  for (const d of DIVE_REPORTS) {
    const key = d.diveType.replace(/^[^\w]+\s*/, ''); // strip emoji
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = DIVE_REPORTS.length;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>By dive type</Text>
        <Text style={styles.sectionMeta}>{total} total</Text>
      </View>
      <View style={styles.breakdownList}>
        {rows.map(([type, count]) => (
          <View key={type} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{type}</Text>
            <View style={styles.breakdownBarTrack}>
              <View
                style={[styles.breakdownBarFill, { width: `${(count / total) * 100}%` }]}
              />
            </View>
            <Text style={styles.breakdownCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function IslandBreakdown() {
  const counts: Record<string, number> = {};
  for (const d of DIVE_REPORTS) {
    const isl = d.region.split('·')[0].trim();
    counts[isl] = (counts[isl] ?? 0) + 1;
  }
  const total = DIVE_REPORTS.length;
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>By island</Text>
      </View>
      <View style={styles.breakdownList}>
        {rows.map(([isl, count]) => (
          <View key={isl} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{isl}</Text>
            <View style={styles.breakdownBarTrack}>
              <View style={[styles.breakdownBarFill, { width: `${(count / total) * 100}%` }]} />
            </View>
            <Text style={styles.breakdownCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecentSpotsBlock({ onNavigate }: { onNavigate?: NavigateFn }) {
  const uniqueSpots = Array.from(new Set(DIVE_REPORTS.map((d) => d.spot))).slice(0, 6);
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Spots visited</Text>
        <Text style={styles.sectionMeta}>{uniqueSpots.length}</Text>
      </View>
      <View style={styles.recentSpotsList}>
        {uniqueSpots.map((s) => (
          <Pressable
            key={s}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugifyName(s) })}
            style={styles.recentSpotRow}
          >
            <View style={styles.recentSpotDot} />
            <Text style={styles.recentSpotName}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function slugifyName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Friends tab body ────────────────────────────────────────────────────

type Friend = {
  initials: string;
  name: string;
  handle: string;
  location: string;
  diveCount: number;
  mutualSpots: number;
  lastDiveSpot: string;
  lastDiveWhen: string;     // 'NOW' | '14M' | '2H' | '3D'
  isOnline?: boolean;
  homeSpot?: string;
};

const FRIENDS_LIST: Friend[] = [];

type PendingReq = {
  direction: 'incoming' | 'outgoing';
  initials: string;
  name: string;
  handle: string;
  mutualFriends: number;
  reason: string;
};

const PENDING_REQUESTS: PendingReq[] = [];

type Suggested = {
  initials: string;
  name: string;
  location: string;
  reason: string;
  mutualSpots: number;
  mutualFriends: number;
};

const SUGGESTED: Suggested[] = [];

const FRIEND_VIEWS = ['All friends', 'Pending', 'Discover'] as const;

function FriendsTabBody({ onNavigate }: { onNavigate?: NavigateFn }) {
  const [view, setView] = React.useState<(typeof FRIEND_VIEWS)[number]>('All friends');

  return (
    <View style={styles.body}>
      <View style={styles.bodyMain}>
        <View style={styles.friendsHeaderRow}>
          <View style={styles.friendsSegmentedControl}>
            {FRIEND_VIEWS.map((v) => {
              const active = v === view;
              const count =
                v === 'All friends' ? FRIENDS_LIST.length :
                v === 'Pending'     ? PENDING_REQUESTS.length :
                SUGGESTED.length;
              return (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={[styles.friendsSegmentBtn, active && styles.friendsSegmentBtnActive]}
                >
                  <Text style={[styles.friendsSegmentText, active && styles.friendsSegmentTextActive]}>{v}</Text>
                  <Text style={[styles.friendsSegmentCount, active && styles.friendsSegmentCountActive]}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.friendsSearchWrap}>
            <Text style={styles.friendsSearchIcon}>⌕</Text>
            <TextInput
              placeholder="Find a diver…"
              placeholderTextColor={colors.text4}
              style={[styles.friendsSearchInput, { outlineStyle: 'none' } as object]}
            />
          </View>
        </View>

        {view === 'All friends' ? (
          <View style={styles.friendCardsGrid}>
            {FRIENDS_LIST.map((f) => (
              <FriendCard key={f.handle} friend={f} onNavigate={onNavigate} />
            ))}
          </View>
        ) : null}

        {view === 'Pending' ? (
          <View style={styles.pendingList}>
            {PENDING_REQUESTS.map((p, i) => (
              <View
                key={p.handle}
                style={[styles.pendingRow, i < PENDING_REQUESTS.length - 1 && styles.pendingRowDivider]}
              >
                <View style={styles.pendingAvatar}>
                  <Text style={styles.pendingAvatarText}>{p.initials}</Text>
                </View>
                <View style={styles.pendingTextWrap}>
                  <View style={styles.pendingNameRow}>
                    <Text style={styles.pendingName}>{p.name}</Text>
                    <Text style={styles.pendingHandle}>{p.handle}</Text>
                    <View style={[
                      styles.pendingDirChip,
                      p.direction === 'incoming' ? styles.pendingDirChipIn : styles.pendingDirChipOut,
                    ]}>
                      <Text style={[
                        styles.pendingDirText,
                        p.direction === 'incoming' ? { color: colors.accent } : { color: colors.text3 },
                      ]}>
                        {p.direction === 'incoming' ? 'WANTS TO FOLLOW' : 'REQUEST SENT'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.pendingReason}>{p.reason} · {p.mutualFriends} mutual friend{p.mutualFriends === 1 ? '' : 's'}</Text>
                </View>
                {p.direction === 'incoming' ? (
                  <View style={styles.pendingActions}>
                    <Pressable style={styles.pendingAcceptBtn}>
                      <Text style={styles.pendingAcceptText}>Accept</Text>
                    </Pressable>
                    <Pressable style={styles.pendingDeclineBtn}>
                      <Text style={styles.pendingDeclineText}>Decline</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.pendingCancelBtn}>
                    <Text style={styles.pendingCancelText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {view === 'Discover' ? (
          <View>
            <Text style={styles.discoverHint}>
              Suggestions are based on shared spots, mutual friends, and forecaster accuracy.
            </Text>
            <View style={styles.suggestedGrid}>
              {SUGGESTED.map((s) => (
                <View key={s.name} style={styles.suggestedCard}>
                  <View style={styles.suggestedAvatar}>
                    <Text style={styles.suggestedAvatarText}>{s.initials}</Text>
                  </View>
                  <Text style={styles.suggestedName}>{s.name}</Text>
                  <Text style={styles.suggestedLocation}>{s.location}</Text>
                  <Text style={styles.suggestedReason}>{s.reason}</Text>
                  <View style={styles.suggestedStatsRow}>
                    <View style={styles.suggestedStat}>
                      <Text style={styles.suggestedStatValue}>{s.mutualSpots}</Text>
                      <Text style={styles.suggestedStatLabel}>SHARED SPOTS</Text>
                    </View>
                    <View style={styles.suggestedStat}>
                      <Text style={styles.suggestedStatValue}>{s.mutualFriends}</Text>
                      <Text style={styles.suggestedStatLabel}>MUTUAL</Text>
                    </View>
                  </View>
                  <Pressable style={styles.suggestedFollowBtn}>
                    <Text style={styles.suggestedFollowText}>+ Follow</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.bodySidebar}>
        <FriendStatsCard />
        <RecentlyActiveCard onNavigate={onNavigate} />
        <ImportFriendsCard />
      </View>
    </View>
  );
}

function FriendCard({ friend, onNavigate: _onNavigate }: { friend: Friend; onNavigate?: NavigateFn }) {
  return (
    <View style={styles.friendCard}>
      <View style={styles.friendCardTop}>
        <View style={styles.friendAvatarWrap}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>{friend.initials}</Text>
          </View>
          {friend.isOnline ? <View style={styles.friendOnlineDot} /> : null}
        </View>
        <View style={styles.friendTextWrap}>
          <Text style={styles.friendName}>{friend.name}</Text>
          <Text style={styles.friendHandle}>{friend.handle}</Text>
          <Text style={styles.friendLocation}>{friend.location}</Text>
        </View>
      </View>
      <View style={styles.friendStatsRow}>
        <View style={styles.friendStat}>
          <Text style={styles.friendStatValue}>{friend.diveCount}</Text>
          <Text style={styles.friendStatLabel}>DIVES</Text>
        </View>
        <View style={styles.friendStatDivider} />
        <View style={styles.friendStat}>
          <Text style={styles.friendStatValue}>{friend.mutualSpots}</Text>
          <Text style={styles.friendStatLabel}>SHARED SPOTS</Text>
        </View>
      </View>
      <View style={styles.friendLastDive}>
        <Text style={styles.friendLastDiveLabel}>LAST DIVE</Text>
        <Text style={styles.friendLastDiveSpot}>{friend.lastDiveSpot}</Text>
        <Text style={styles.friendLastDiveWhen}>· {friend.lastDiveWhen}</Text>
      </View>
      <View style={styles.friendActionsRow}>
        <Pressable style={[styles.friendActionBtn, styles.friendActionBtnPrimary]}>
          <Text style={styles.friendActionTextPrimary}>View profile</Text>
        </Pressable>
        <Pressable style={styles.friendActionBtn}>
          <Text style={styles.friendActionText}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FriendStatsCard() {
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Network</Text>
      </View>
      <View style={styles.networkStatsCard}>
        <View style={styles.networkStatRow}>
          <View style={styles.networkStat}>
            <Text style={styles.networkStatValue}>{FRIENDS_LIST.length}</Text>
            <Text style={styles.networkStatLabel}>FRIENDS</Text>
          </View>
          <View style={styles.networkStatDivider} />
          <View style={styles.networkStat}>
            <Text style={styles.networkStatValue}>23</Text>
            <Text style={styles.networkStatLabel}>SHARED SPOTS</Text>
          </View>
        </View>
        <View style={styles.networkStatRow}>
          <View style={styles.networkStat}>
            <Text style={styles.networkStatValue}>4</Text>
            <Text style={styles.networkStatLabel}>ONLINE NOW</Text>
          </View>
          <View style={styles.networkStatDivider} />
          <View style={styles.networkStat}>
            <Text style={styles.networkStatValue}>312</Text>
            <Text style={styles.networkStatLabel}>MAX FRIEND DIVES</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function RecentlyActiveCard({ onNavigate }: { onNavigate?: NavigateFn }) {
  const active = FRIENDS_LIST.filter((f) => f.isOnline || ['14M', '32M', '1H', '3H'].includes(f.lastDiveWhen)).slice(0, 5);
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>In the water now</Text>
        <Text style={styles.sectionMeta}>{active.length} active</Text>
      </View>
      <View style={styles.recentActiveCard}>
        {active.map((f, i) => (
          <Pressable
            key={f.handle}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugifyName(f.lastDiveSpot) })}
            style={[styles.recentActiveRow, i < active.length - 1 && styles.recentActiveRowDivider]}
          >
            <View style={styles.recentActiveAvatarWrap}>
              <View style={styles.recentActiveAvatar}>
                <Text style={styles.recentActiveAvatarText}>{f.initials}</Text>
              </View>
              {f.isOnline ? <View style={styles.recentActiveOnlineDot} /> : null}
            </View>
            <View style={styles.recentActiveTextWrap}>
              <Text style={styles.recentActiveName}>{f.name}</Text>
              <Text style={styles.recentActiveActivity}>at {f.lastDiveSpot}</Text>
            </View>
            <Text style={styles.recentActiveWhen}>{f.lastDiveWhen}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ImportFriendsCard() {
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Find more</Text>
      </View>
      <View style={styles.importCard}>
        <Text style={styles.importCardBody}>
          Connect Strava or Garmin to find dive buddies in your existing network.
        </Text>
        <View style={styles.importBtnRow}>
          <Pressable style={styles.importBtn}>
            <Text style={styles.importBtnText}>Strava</Text>
          </Pressable>
          <Pressable style={styles.importBtn}>
            <Text style={styles.importBtnText}>Garmin</Text>
          </Pressable>
          <Pressable style={styles.importBtn}>
            <Text style={styles.importBtnText}>Contacts</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Settings tab body ───────────────────────────────────────────────────

type SettingsState = {
  // Display & units
  units: 'imperial' | 'metric';
  temp: '°F' | '°C';
  depth: 'ft' | 'm';
  timeFormat: '12h' | '24h';
  theme: 'dark' | 'system';
  // Notifications
  pushAlerts: boolean;
  emailDigest: boolean;
  bestWindowAlerts: boolean;
  runoffAlerts: boolean;
  friendActivity: boolean;
  // Privacy
  profileVisibility: 'public' | 'followers' | 'private';
  defaultDivePrivacy: 'public' | 'followers' | 'private';
  shareLocation: boolean;
  shareTrips: boolean;
};

const DEFAULT_SETTINGS: SettingsState = {
  units: 'imperial',
  temp: '°F',
  depth: 'ft',
  timeFormat: '12h',
  theme: 'dark',
  pushAlerts: true,
  emailDigest: true,
  bestWindowAlerts: true,
  runoffAlerts: true,
  friendActivity: false,
  profileVisibility: 'public',
  defaultDivePrivacy: 'followers',
  shareLocation: true,
  shareTrips: true,
};

const CONNECTED_ACCOUNTS = [
  { id: 'strava',  name: 'Strava',          status: 'connected'  as const, note: 'Last sync 12m ago · 147 activities' },
  { id: 'garmin',  name: 'Garmin Connect',  status: 'connected'  as const, note: 'Last sync 1h ago · 89 activities' },
  { id: 'apple',   name: 'Apple Health',    status: 'available'  as const, note: 'Pull dive depths from Apple Watch' },
  { id: 'shearwater', name: 'Shearwater Cloud', status: 'available'  as const, note: 'Import detailed dive computer logs' },
];

function SettingsTabBody({
  profile,
  setProfile,
}: {
  profile: EditableProfile;
  setProfile: React.Dispatch<React.SetStateAction<EditableProfile>>;
}) {
  const [s, setS] = React.useState<SettingsState>(DEFAULT_SETTINGS);
  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => setS((p) => ({ ...p, [k]: v }));
  const auth = useAuth();
  const setField = <K extends keyof EditableProfile>(k: K, v: EditableProfile[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  return (
    <View style={styles.body}>
      <View style={styles.bodyMain}>
        <SettingsSection title="Account" subtitle="Your identity on KaiCast">
          <EditableSettingsRow
            label="Display name"
            value={profile.name}
            placeholder="Your name"
            onSave={(v) => setField('name', v)}
          />
          <EditableSettingsRow
            label="Handle"
            value={profile.handle}
            placeholder="@yourhandle"
            onSave={(v) => setField('handle', v.startsWith('@') ? v : `@${v}`)}
          />
          <EditableSettingsRow
            label="Location"
            value={profile.location}
            placeholder="City, Island"
            onSave={(v) => setField('location', v)}
          />
          <EditableSettingsRow
            label="Bio"
            value={profile.bio}
            placeholder="Tell other divers about yourself"
            multiline
            onSave={(v) => setField('bio', v)}
          />
          <SettingsRow label="Email" value={auth.user?.email ?? '—'} />
          <SettingsRow label="Password" value="Last changed —" actionLabel="Change" />
          <SettingsRow label="Time zone" value="Pacific/Honolulu (UTC−10)" isLast />
        </SettingsSection>

        <SettingsSection title="Display & units" subtitle="How KaiCast shows numbers and time">
          <SegmentedRow
            label="Unit system"
            value={s.units}
            options={[{ key: 'imperial', label: 'Imperial' }, { key: 'metric', label: 'Metric' }]}
            onChange={(v) => set('units', v as SettingsState['units'])}
          />
          <SegmentedRow
            label="Temperature"
            value={s.temp}
            options={[{ key: '°F', label: '°F' }, { key: '°C', label: '°C' }]}
            onChange={(v) => set('temp', v as SettingsState['temp'])}
          />
          <SegmentedRow
            label="Depth"
            value={s.depth}
            options={[{ key: 'ft', label: 'ft' }, { key: 'm', label: 'm' }]}
            onChange={(v) => set('depth', v as SettingsState['depth'])}
          />
          <SegmentedRow
            label="Time format"
            value={s.timeFormat}
            options={[{ key: '12h', label: '12-hour' }, { key: '24h', label: '24-hour' }]}
            onChange={(v) => set('timeFormat', v as SettingsState['timeFormat'])}
          />
          <SegmentedRow
            label="Theme"
            value={s.theme}
            options={[{ key: 'dark', label: 'Dark' }, { key: 'system', label: 'Match system' }]}
            onChange={(v) => set('theme', v as SettingsState['theme'])}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Notifications" subtitle="When KaiCast should reach out">
          <ToggleRow
            label="Push notifications"
            sub="Browser and mobile push for time-sensitive alerts"
            value={s.pushAlerts}
            onToggle={(v) => set('pushAlerts', v)}
          />
          <ToggleRow
            label="Email digest"
            sub="Weekly summary of activity at your favorite spots"
            value={s.emailDigest}
            onToggle={(v) => set('emailDigest', v)}
          />
          <ToggleRow
            label="Best-window alerts"
            sub="Push me when conditions hit Excellent at a favorite"
            value={s.bestWindowAlerts}
            onToggle={(v) => set('bestWindowAlerts', v)}
          />
          <ToggleRow
            label="Runoff & hazard warnings"
            sub="Always-on safety alerts for spots you've logged"
            value={s.runoffAlerts}
            onToggle={(v) => set('runoffAlerts', v)}
          />
          <ToggleRow
            label="Friend activity"
            sub="Notify when friends post new reports"
            value={s.friendActivity}
            onToggle={(v) => set('friendActivity', v)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Privacy & sharing" subtitle="What gets shown and to whom">
          <SegmentedRow
            label="Profile visibility"
            value={s.profileVisibility}
            options={[
              { key: 'public',    label: 'Public' },
              { key: 'followers', label: 'Followers' },
              { key: 'private',   label: 'Private' },
            ]}
            onChange={(v) => set('profileVisibility', v as SettingsState['profileVisibility'])}
          />
          <SegmentedRow
            label="Default dive privacy"
            value={s.defaultDivePrivacy}
            options={[
              { key: 'public',    label: 'Public' },
              { key: 'followers', label: 'Followers' },
              { key: 'private',   label: 'Private' },
            ]}
            onChange={(v) => set('defaultDivePrivacy', v as SettingsState['defaultDivePrivacy'])}
          />
          <ToggleRow
            label="Share precise dive location"
            sub="When off, spots are coarsened to the nearest 1km grid"
            value={s.shareLocation}
            onToggle={(v) => set('shareLocation', v)}
          />
          <ToggleRow
            label="Show me on 'In the water now'"
            sub="Friends see when you're actively diving at one of their spots"
            value={s.shareTrips}
            onToggle={(v) => set('shareTrips', v)}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="Connected accounts" subtitle="Pull dive data from other platforms">
          {CONNECTED_ACCOUNTS.map((a, i) => (
            <View
              key={a.id}
              style={[styles.connectedRow, i < CONNECTED_ACCOUNTS.length - 1 && styles.connectedRowDivider]}
            >
              <View style={styles.connectedIcon}>
                <Text style={styles.connectedIconText}>{a.name[0]}</Text>
              </View>
              <View style={styles.connectedTextWrap}>
                <Text style={styles.connectedName}>{a.name}</Text>
                <Text style={styles.connectedNote}>{a.note}</Text>
              </View>
              {a.status === 'connected' ? (
                <View style={styles.connectedStatusRow}>
                  <View style={[styles.connectedStatusDot, { backgroundColor: colors.great }]} />
                  <Text style={[styles.connectedStatusText, { color: colors.great }]}>CONNECTED</Text>
                  <Pressable style={styles.connectedDisconnectBtn}>
                    <Text style={styles.connectedDisconnectText}>Disconnect</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.connectedConnectBtn}>
                  <Text style={styles.connectedConnectText}>Connect</Text>
                </Pressable>
              )}
            </View>
          ))}
        </SettingsSection>

        <SettingsSection title="Subscription" subtitle="Your KaiCast Pro plan">
          <View style={styles.subscriptionHero}>
            <View style={styles.subscriptionBadge}>
              <Text style={styles.subscriptionBadgeIcon}>⬡</Text>
              <Text style={styles.subscriptionBadgeText}>PRO MEMBER</Text>
            </View>
            <Text style={styles.subscriptionPlan}>$8 / month · Annual</Text>
            <Text style={styles.subscriptionRenew}>Renews Nov 14, 2024 · Next charge $96</Text>
          </View>
          <View style={styles.subscriptionActionsRow}>
            <Pressable style={styles.subscriptionActionBtn}>
              <Text style={styles.subscriptionActionText}>Manage billing</Text>
            </Pressable>
            <Pressable style={styles.subscriptionActionBtn}>
              <Text style={styles.subscriptionActionText}>View invoices</Text>
            </Pressable>
            <Pressable style={[styles.subscriptionActionBtn, styles.subscriptionActionBtnDanger]}>
              <Text style={[styles.subscriptionActionText, { color: colors.fair }]}>Cancel plan</Text>
            </Pressable>
          </View>
        </SettingsSection>

        <SettingsSection title="Data & export" subtitle="Download or remove your data">
          <SettingsRow
            label="Download dive log"
            value="ZIP archive · all 147 dives + photos"
            actionLabel="Request"
          />
          <SettingsRow
            label="Export to UDDF"
            value="Dive Computer XML format"
            actionLabel="Export"
          />
          <SettingsRow
            label="Archive my profile"
            value="Hide from search & feeds — recoverable for 30 days"
            actionLabel="Archive"
          />
          <View style={[styles.connectedRow, styles.dangerRow]}>
            <View style={styles.connectedTextWrap}>
              <Text style={styles.dangerLabel}>Delete account</Text>
              <Text style={styles.dangerNote}>
                Permanently remove your profile, dive log, photos, and community contributions. Cannot be undone.
              </Text>
            </View>
            <Pressable style={styles.dangerBtn}>
              <Text style={styles.dangerBtnText}>Delete</Text>
            </Pressable>
          </View>
        </SettingsSection>

        <SettingsSection title="About">
          <SettingsRow label="Version"        value="0.0.1 · Desktop preview build" />
          <SettingsRow label="Forecast model" value="KaiCast Abyss v1.2 · 7 layers" />
          <SettingsRow label="Last sync"      value="2:47 PM · 4 min ago" />
          <SettingsRow label="Terms of Service" actionLabel="Read" value="" />
          <SettingsRow label="Privacy Policy"   actionLabel="Read" value="" isLast />
        </SettingsSection>
      </View>

      <View style={styles.bodySidebar}>
        <View style={styles.sideBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account status</Text>
          </View>
          <View style={styles.accountStatusCard}>
            <View style={styles.accountStatusAvatar}>
              <Text style={styles.accountStatusAvatarText}>{USER.initials}</Text>
            </View>
            <Text style={styles.accountStatusName}>{USER.name}</Text>
            <Text style={styles.accountStatusHandle}>{USER.handle}</Text>
            <View style={styles.accountStatusTierWrap}>
              <Text style={styles.accountStatusTier}>⬡ Pro member · since Nov 2023</Text>
            </View>
          </View>
        </View>

        <View style={styles.sideBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>
          <View style={styles.quickActionsCard}>
            <QuickAction icon="↗" label="View public profile" />
            <QuickAction icon="↻" label="Re-sync all sources" />
            <QuickAction icon="✉" label="Contact support" />
            <QuickAction icon="↤" label="Sign out" tone="muted" />
          </View>
        </View>

        <View style={styles.sideBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Help</Text>
          </View>
          <View style={styles.helpCard}>
            <HelpLink label="What's the visibility model?" />
            <HelpLink label="How are conditions rated?" />
            <HelpLink label="Privacy & data handling" />
            <HelpLink label="Pro tier features" />
            <HelpLink label="Report a bug" />
          </View>
        </View>
      </View>
    </View>
  );
}

function SettingsSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingsSection}>
      <View style={styles.settingsSectionHeader}>
        <Text style={styles.settingsSectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingsSectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.settingsSectionBody}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  actionLabel,
  onAction,
  isLast,
}: {
  label: string;
  value?: string;
  actionLabel?: string;
  onAction?: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingsRow, !isLast && styles.settingsRowDivider]}>
      <Text style={styles.settingsRowLabel}>{label}</Text>
      {value ? <Text style={styles.settingsRowValue}>{value}</Text> : null}
      {onAction || actionLabel ? (
        <Pressable style={styles.settingsRowAction} onPress={onAction}>
          <Text style={styles.settingsRowActionText}>{actionLabel ?? 'Edit'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EditableSettingsRow({
  label,
  value,
  placeholder,
  multiline,
  onSave,
  isLast,
}: {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (next: string) => void;
  isLast?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  // Keep the draft in sync if the underlying value changes from
  // elsewhere (e.g. another field on the same profile updates).
  React.useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const startEdit = () => { setDraft(value); setEditing(true); };
  const cancel = () => { setDraft(value); setEditing(false); };
  const save = () => { onSave(draft.trim()); setEditing(false); };

  if (!editing) {
    return (
      <View style={[styles.settingsRow, !isLast && styles.settingsRowDivider]}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        <Text style={styles.settingsRowValue}>{value || placeholder || '—'}</Text>
        <Pressable style={styles.settingsRowAction} onPress={startEdit}>
          <Text style={styles.settingsRowActionText}>Edit</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.settingsRow, !isLast && styles.settingsRowDivider]}>
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        multiline={multiline}
        style={[styles.settingsRowInput, multiline && styles.settingsRowInputMultiline] as object[]}
      />
      <Pressable style={styles.settingsRowAction} onPress={cancel}>
        <Text style={[styles.settingsRowActionText, { color: colors.text3 }]}>Cancel</Text>
      </Pressable>
      <Pressable style={styles.settingsRowAction} onPress={save}>
        <Text style={styles.settingsRowActionText}>Save</Text>
      </Pressable>
    </View>
  );
}

function SegmentedRow({
  label,
  value,
  options,
  onChange,
  isLast,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (v: string) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingsRow, !isLast && styles.settingsRowDivider]}>
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <View style={styles.settingsRowSpacer} />
      <View style={styles.segCtl}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              style={[styles.segBtn, active && styles.segBtnActive]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onToggle,
  isLast,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingsRow, !isLast && styles.settingsRowDivider]}>
      <View style={styles.settingsRowTextWrap}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {sub ? <Text style={styles.settingsRowSub}>{sub}</Text> : null}
      </View>
      <Pressable
        onPress={() => onToggle(!value)}
        style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff]}
      >
        <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
      </Pressable>
    </View>
  );
}

function QuickAction({ icon, label, tone }: { icon: string; label: string; tone?: 'muted' }) {
  return (
    <Pressable style={styles.quickActionRow}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={[styles.quickActionLabel, tone === 'muted' && { color: colors.text3 }]}>{label}</Text>
      <Text style={styles.quickActionCaret}>›</Text>
    </Pressable>
  );
}

function HelpLink({ label }: { label: string }) {
  return (
    <Pressable style={styles.helpLinkRow}>
      <Text style={styles.helpLinkLabel}>{label}</Text>
      <Text style={styles.helpLinkArrow}>→</Text>
    </Pressable>
  );
}

function HeatmapBlock() {
  return (
    <View style={styles.heatmapBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dive activity · last 12 months</Text>
        <Text style={styles.sectionMeta}>147 dives</Text>
      </View>

      <View style={styles.heatmapBody}>
        <View style={styles.heatmapDayLabels}>
          {['Mon', 'Wed', 'Fri', 'Sun'].map((d) => (
            <Text key={d} style={styles.heatmapDayLabel}>{d}</Text>
          ))}
        </View>
        <View style={styles.heatmapGrid}>
          {HEATMAP.map((col, ci) => (
            <View key={ci} style={styles.heatmapCol}>
              {col.map((v, di) => <HeatmapCell key={di} intensity={v} />)}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.heatmapFooter}>
        <View style={styles.heatmapMonths}>
          {['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => (
            <Text key={i} style={styles.heatmapMonth}>{m}</Text>
          ))}
        </View>
        <View style={styles.heatmapLegend}>
          <Text style={styles.heatmapLegendLabel}>Less</Text>
          {[0, 1, 2, 3, 4].map((i) => <HeatmapCell key={i} intensity={i as 0 | 1 | 2 | 3 | 4} />)}
          <Text style={styles.heatmapLegendLabel}>More</Text>
        </View>
      </View>
    </View>
  );
}

function RecentDivesBlock() {
  return (
    <View style={styles.diveBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent dives</Text>
        <Text style={styles.sectionLink}>View all 147 →</Text>
      </View>
      <View style={styles.diveList}>
        {DIVE_LIST.map((d, i) => (
          <View
            key={i}
            style={[styles.diveItem, i < DIVE_LIST.length - 1 && styles.diveItemDivider]}
          >
            <View style={styles.diveDot} />
            <View style={styles.diveInfo}>
              <Text style={styles.diveSpot}>{d.spot}</Text>
              <Text style={styles.diveMeta}>{d.meta}</Text>
            </View>
            <View style={styles.diveType}>
              <Text style={styles.diveTypeText}>{d.type}</Text>
            </View>
            <View style={styles.diveStats}>
              <DiveStat value={d.depth}    unit="ft"  label="Depth" />
              <DiveStat value={d.duration} unit="min" label="Time" />
              <DiveStat value={d.vis}      unit="ft"  label="Vis" />
            </View>
            <Stars n={d.stars} />
          </View>
        ))}
      </View>
    </View>
  );
}

function DiveStat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <View style={styles.diveStat}>
      <View style={styles.diveStatValueRow}>
        <Text style={styles.diveStatValue}>{value}</Text>
        <Text style={styles.diveStatUnit}>{unit}</Text>
      </View>
      <Text style={styles.diveStatLabel}>{label}</Text>
    </View>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <View style={styles.starsRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Text key={i} style={[styles.star, i < n && styles.starFilled]}>★</Text>
      ))}
    </View>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────

function FavoriteSpotsSidebar({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Favorite spots</Text>
        <Text style={styles.sectionLink}>See all →</Text>
      </View>
      <View style={styles.favList}>
        {FAVORITES.map((f) => (
          <Pressable
            key={f.name}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugify(f.name) })}
            style={styles.favCard}
          >
            <View style={[styles.favCardBar, { backgroundColor: TIER_COLORS[f.rating] }]} />
            <View style={styles.favCardRow}>
              <View style={styles.favCardTextWrap}>
                <Text style={styles.favCardName}>{f.name}</Text>
                <Text style={styles.favCardRegion}>{f.region}</Text>
              </View>
              <ConditionPill tier={f.rating} size="sm" />
            </View>
            <View style={styles.favCardMetrics}>
              <FavMetric value={f.vis}     unit="ft"  label="Visibility" />
              <FavMetric value={f.water}   unit="°F"  label="Water" />
              <FavMetric value={f.current} unit="mph" label="Current" />
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function FavMetric({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <View style={styles.favMetric}>
      <View style={styles.favMetricValueRow}>
        <Text style={styles.favMetricValue}>{value}</Text>
        <Text style={styles.favMetricUnit}>{unit}</Text>
      </View>
      <Text style={styles.favMetricLabel}>{label}</Text>
    </View>
  );
}

function SpeciesBlock() {
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Species logged</Text>
        <Text style={styles.sectionMeta}>34 total</Text>
      </View>
      <View style={styles.speciesGrid}>
        {SPECIES.map((s) => (
          <View key={s.name} style={[styles.speciesItem, s.rare && styles.speciesItemRare]}>
            <Text style={styles.speciesEmoji}>{s.emoji}</Text>
            <Text style={styles.speciesName}>{s.name}</Text>
          </View>
        ))}
      </View>
      <View style={styles.speciesLegend}>
        <View style={styles.speciesLegendDot} />
        <Text style={styles.speciesLegendText}>Rare sightings highlighted</Text>
      </View>
    </View>
  );
}

function AchievementsBlock() {
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Achievements</Text>
      </View>
      <View style={styles.badgeRow}>
        {ACHIEVEMENTS.map((a) => (
          <View
            key={a.title}
            style={[
              styles.badge,
              a.tier === 'gold' && styles.badgeGold,
              a.tier === 'silver' && styles.badgeSilver,
            ]}
          >
            <Text style={styles.badgeEmoji}>{a.emoji}</Text>
            <View style={styles.badgeTextWrap}>
              <Text style={styles.badgeTitle}>{a.title}</Text>
              <Text style={styles.badgeDesc}>{a.desc}</Text>
            </View>
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

  // ── Header ──
  header: {
    height: 330,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBg: {
    // backgroundColor kept as a fallback tint while the Figma photo loads.
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#0a3a4d',
  },
  headerSheen: {
    ...StyleSheet.absoluteFillObject,
    // Translucent white wash that, layered over the blurred jellyfish
    // image, reads as the front face of frosted glass.
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Soft dark vignette over the glass for text contrast.
    backgroundColor: 'rgba(12,16,21,0.32)',
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  avatarOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 3,
    backgroundColor: colors.accent,
  },
  avatar: {
    flex: 1,
    borderRadius: 56,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.mono,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text1,
  },
  headerNameWrap: { flex: 1, gap: 6 },
  headerName: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  headerHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerHandle: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text2,
  },
  headerHandleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text3,
  },
  headerBio: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text2,
    maxWidth: 520,
    marginTop: 6,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineStrong,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineStrong,
  },
  headerStat: { gap: 2 },
  headerStatValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
  },
  headerStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  headerButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  headerBtn: {
    height: 34,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  headerBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  headerBtnPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },
  headerBtnIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIconText: {
    fontSize: 16,
    color: colors.text1,
  },

  headerRight: {
    width: 240,
    gap: 12,
  },
  forecasterBadge: {
    padding: 14,
    backgroundColor: 'rgba(9,161,251,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(9,161,251,0.40)',
    borderRadius: radius.sm,
    alignItems: 'flex-start',
    gap: 4,
  },
  forecasterEmoji: { fontSize: 22, marginBottom: 4 },
  forecasterLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  forecasterSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  prCard: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    gap: 4,
  },
  prLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.text3,
  },
  prValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  prValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  prUnit: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text3,
  },
  prSpot: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  prDate: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  tabBtn: {
    paddingHorizontal: 18,
    height: 49,
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text2,
  },
  tabLabelActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 18,
    right: 18,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },

  // ── Body ──
  body: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  bodyMain: { flex: 1, gap: 24 },
  bodySidebar: { width: 280, gap: 24 },

  // Stat cards
  statCardsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statCard: {
    flex: 1,
    height: 148,
    padding: 20,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    position: 'relative',
    overflow: 'hidden',
  },
  statCardIcon: {
    fontSize: 22,
  },
  statCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 12,
  },
  statCardValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  statCardUnit: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text3,
  },
  statCardLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text3,
    marginTop: 6,
  },
  statCardBgIcon: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    fontSize: 72,
    opacity: 0.05,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 16,
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

  // Heatmap
  heatmapBlock: {
    padding: 20,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  heatmapBody: {
    flexDirection: 'row',
    gap: 8,
  },
  heatmapDayLabels: {
    gap: 11,
    paddingTop: 4,
  },
  heatmapDayLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
    height: 11,
  },
  heatmapGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCol: { gap: 3 },
  heatmapFooter: {
    marginTop: 8,
    gap: 8,
  },
  heatmapMonths: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 30,
  },
  heatmapMonth: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
  },
  heatmapLegend: {
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

  // Dive list
  diveBlock: {},
  diveList: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  diveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  diveItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  diveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  diveInfo: { flex: 1, gap: 2 },
  diveSpot: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  diveMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text3,
  },
  diveType: {
    paddingHorizontal: 10,
    height: 22,
    backgroundColor: colors.surface2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diveTypeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text2,
  },
  diveStats: {
    flexDirection: 'row',
    gap: 16,
  },
  diveStat: { gap: 2 },
  diveStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  diveStatValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  diveStatUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  diveStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.text4,
  },
  starsRow: { flexDirection: 'row', gap: 2 },
  star: {
    fontSize: 12,
    color: colors.text4,
  },
  starFilled: {
    color: colors.accent,
  },

  // ── Sidebar ──
  sideBlock: {},

  // Favorite cards (compact 3-stat)
  favList: { gap: 12 },
  favCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  favCardBar: {
    height: 3,
  },
  favCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 10,
  },
  favCardTextWrap: { flex: 1, gap: 2 },
  favCardName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  favCardRegion: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  favCardMetrics: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 16,
  },
  favMetric: { gap: 2 },
  favMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  favMetricValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  favMetricUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  favMetricLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.text4,
  },

  // Species grid
  speciesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speciesItem: {
    width: 'calc(20% - 7px)' as unknown as number,
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.surface0,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    gap: 4,
  },
  speciesItemRare: {
    borderColor: colors.accent,
  },
  speciesEmoji: { fontSize: 18 },
  speciesName: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.text2,
    textAlign: 'center',
  },
  speciesLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  speciesLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  speciesLegendText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  // ── Dive Reports tab ──
  diveReportsFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  diveReportsFilterChips: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  drFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  drFilterChipActive: {
    backgroundColor: colors.surface1,
    borderColor: colors.hairlineStrong,
  },
  drFilterChipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text2,
  },
  drFilterChipTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  drFilterChipCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  diveReportsSortWrap: {
    flexDirection: 'row',
    gap: 14,
  },
  drSortBtn: {},
  drSortText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  drSortTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  diveReportsList: {
    gap: 14,
    marginTop: 14,
  },
  drEmpty: {
    padding: 32,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 6,
  },
  drEmptyTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  drEmptySub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },

  // Sidebar breakdowns (used by Dive Reports sidebar)
  breakdownList: {
    gap: 10,
    padding: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    width: 100,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  breakdownCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },

  recentSpotsList: {
    padding: 8,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  recentSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  recentSpotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  recentSpotName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },

  // ── Friends tab ──
  friendsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  friendsSegmentedControl: {
    flexDirection: 'row',
    padding: 3,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 2,
  },
  friendsSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm - 2,
  },
  friendsSegmentBtnActive: {
    backgroundColor: colors.surface2,
  },
  friendsSegmentText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text3,
  },
  friendsSegmentTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  friendsSegmentCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text4,
  },
  friendsSegmentCountActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  friendsSearchWrap: {
    flex: 1,
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
  friendsSearchIcon: {
    fontSize: 13,
    color: colors.text4,
  },
  friendsSearchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },

  // Friend cards grid
  friendCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  friendCard: {
    width: 'calc(50% - 7px)' as unknown as number,
    padding: 18,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    gap: 14,
  },
  friendCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  friendAvatarWrap: {
    position: 'relative',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  friendAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  friendOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.great,
    borderWidth: 2,
    borderColor: colors.surface0,
  },
  friendTextWrap: { flex: 1, gap: 2 },
  friendName: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  friendHandle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  friendLocation: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
    marginTop: 2,
  },
  friendStatsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
  },
  friendStat: { flex: 1, gap: 2 },
  friendStatDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 12,
  },
  friendStatValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  friendStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  friendLastDive: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  friendLastDiveLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  friendLastDiveSpot: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  friendLastDiveWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  friendActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  friendActionBtn: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendActionBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  friendActionText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text1,
  },
  friendActionTextPrimary: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },

  // Pending list
  pendingList: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  pendingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pendingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
  },
  pendingTextWrap: { flex: 1, gap: 4 },
  pendingNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  pendingName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  pendingHandle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  pendingDirChip: {
    paddingHorizontal: 7,
    height: 18,
    borderRadius: 3,
    justifyContent: 'center',
    borderWidth: 1,
  },
  pendingDirChipIn: {
    backgroundColor: colors.accentDim,
    borderColor: 'rgba(9,161,251,0.30)',
  },
  pendingDirChipOut: {
    backgroundColor: colors.surface2,
    borderColor: colors.hairlineStrong,
  },
  pendingDirText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pendingReason: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 6,
  },
  pendingAcceptBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAcceptText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },
  pendingDeclineBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDeclineText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  pendingCancelBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingCancelText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },

  // Discover suggestions
  discoverHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    marginBottom: 14,
  },
  suggestedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestedCard: {
    width: 'calc(33.333% - 8px)' as unknown as number,
    padding: 16,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 6,
  },
  suggestedAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: 4,
  },
  suggestedAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  suggestedName: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  suggestedLocation: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  suggestedReason: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    textAlign: 'center',
    marginTop: 4,
    minHeight: 32,
  },
  suggestedStatsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    alignSelf: 'stretch',
    marginTop: 4,
  },
  suggestedStat: { flex: 1, alignItems: 'center', gap: 2 },
  suggestedStatValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  suggestedStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  suggestedFollowBtn: {
    alignSelf: 'stretch',
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  suggestedFollowText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },

  // ── Friends sidebar ──
  networkStatsCard: {
    padding: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    gap: 10,
  },
  networkStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkStat: { flex: 1, gap: 2 },
  networkStatDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },
  networkStatValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  networkStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  recentActiveCard: {
    padding: 6,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  recentActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
    borderRadius: radius.sm,
  },
  recentActiveRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  recentActiveAvatarWrap: {
    position: 'relative',
  },
  recentActiveAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentActiveAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.text1,
  },
  recentActiveOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.great,
    borderWidth: 2,
    borderColor: colors.surface0,
  },
  recentActiveTextWrap: { flex: 1, gap: 2 },
  recentActiveName: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  recentActiveActivity: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  recentActiveWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  importCard: {
    padding: 16,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    gap: 12,
  },
  importCardBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text2,
  },
  importBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  importBtn: {
    flex: 1,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },

  // ── Settings tab ──
  settingsSection: {
    marginBottom: 16,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  settingsSectionHeader: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 4,
  },
  settingsSectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  settingsSectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  settingsSectionBody: {},

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 16,
  },
  settingsRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  settingsRowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
    minWidth: 180,
  },
  settingsRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  settingsRowSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    maxWidth: 480,
  },
  settingsRowValue: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  settingsRowSpacer: { flex: 1 },
  settingsRowInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  settingsRowInputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  settingsRowAction: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  settingsRowActionText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },

  // Toggle (used inside ToggleRow)
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    padding: 2,
  },
  toggleTrackOn: { backgroundColor: colors.accent },
  toggleTrackOff: { backgroundColor: colors.surface2 },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleThumbOff: { alignSelf: 'flex-start' },

  // Segmented control (used inside SegmentedRow)
  segCtl: {
    flexDirection: 'row',
    padding: 2,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 2,
  },
  segBtn: {
    paddingHorizontal: 12,
    height: 26,
    borderRadius: radius.sm - 2,
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: colors.surface2,
  },
  segText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  segTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },

  // Connected accounts rows
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 14,
  },
  connectedRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  connectedIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedIconText: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  connectedTextWrap: { flex: 1, gap: 2 },
  connectedName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  connectedNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.text3,
  },
  connectedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectedStatusText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  connectedDisconnectBtn: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 4,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
  },
  connectedDisconnectText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
  },
  connectedConnectBtn: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  connectedConnectText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },

  // Subscription
  subscriptionHero: {
    padding: 22,
    gap: 6,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.accentDim,
    marginBottom: 6,
  },
  subscriptionBadgeIcon: {
    fontSize: 13,
    color: colors.accent,
  },
  subscriptionBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  subscriptionPlan: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  subscriptionRenew: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  subscriptionActionsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  subscriptionActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionActionBtnDanger: {
    borderColor: 'rgba(255,157,37,0.40)',
    backgroundColor: 'rgba(255,157,37,0.06)',
  },
  subscriptionActionText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text1,
  },

  // Danger zone
  dangerRow: {
    backgroundColor: 'rgba(247,55,38,0.04)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(247,55,38,0.20)',
  },
  dangerLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.nogo,
  },
  dangerNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text3,
    maxWidth: 480,
  },
  dangerBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(247,55,38,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.nogo,
  },

  // ── Settings sidebar ──
  accountStatusCard: {
    padding: 18,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  accountStatusAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: 8,
  },
  accountStatusAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  accountStatusName: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  accountStatusHandle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  accountStatusTierWrap: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accentDim,
    borderRadius: 4,
  },
  accountStatusTier: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.6,
  },

  quickActionsCard: {
    padding: 6,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderRadius: radius.sm,
  },
  quickActionIcon: {
    fontSize: 14,
    color: colors.text2,
    width: 16,
    textAlign: 'center',
  },
  quickActionLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },
  quickActionCaret: {
    fontSize: 14,
    color: colors.text4,
  },

  helpCard: {
    padding: 6,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  helpLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  helpLinkLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  helpLinkArrow: {
    fontSize: 12,
    color: colors.accent,
  },

  // Coming-soon placeholder for Friends / Settings tabs
  comingSoonWrap: {
    padding: 80,
    alignItems: 'center',
    gap: 10,
  },
  comingSoonIcon: {
    fontSize: 40,
    color: colors.text4,
  },
  comingSoonTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
  },
  comingSoonSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text3,
  },

  // Achievements
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    width: 'calc(50% - 4px)' as unknown as number,
    minHeight: 56,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
  },
  badgeGold: {
    borderColor: '#d4a017',
    backgroundColor: 'rgba(212,160,23,0.10)',
  },
  badgeSilver: {
    borderColor: '#7d8a96',
    backgroundColor: 'rgba(125,138,150,0.10)',
  },
  badgeEmoji: { fontSize: 18 },
  badgeTextWrap: { flex: 1, gap: 2 },
  badgeTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  badgeDesc: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
  },
});
