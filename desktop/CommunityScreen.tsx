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
import { DiveReportCard, type DiveReportCardProps } from './components/DiveReportCard';
import type { NavigateFn } from './router';

/**
 * Community — chronological feed of activity across all KaiCast users.
 *
 * Reached from the Dashboard left sidebar ("Community" link). Sits
 * under the Dashboard nav group. Mixed-type feed: dive reports,
 * photos, milestones (PBs, badges), and spot reviews — interleaved
 * by recency.
 */

// ─── Feed-item types ─────────────────────────────────────────────────────

type FeedAuthor = {
  initials: string;
  name: string;
  badge?: 'Pro' | 'Forecaster' | 'Divemaster';
};

type DiveFeedItem = {
  kind: 'dive';
  when: string;
  whenAgo: string;
  author: FeedAuthor;
  report: DiveReportCardProps;
};

type PhotoFeedItem = {
  kind: 'photo';
  when: string;
  whenAgo: string;
  author: FeedAuthor;
  spot: string;
  caption: string;
  tint: string;
  likes: number;
  comments: number;
  liked?: boolean;
};

type MilestoneFeedItem = {
  kind: 'milestone';
  when: string;
  whenAgo: string;
  author: FeedAuthor;
  badge: { emoji: string; title: string; description: string };
  tier?: 'gold' | 'silver';
};

type SpotReviewFeedItem = {
  kind: 'spot-review';
  when: string;
  whenAgo: string;
  author: FeedAuthor;
  spot: string;
  region: string;
  rating: ConditionTier;
  stars: number;
  body: string;
  visitCount: number;
};

type FeedItem = DiveFeedItem | PhotoFeedItem | MilestoneFeedItem | SpotReviewFeedItem;

// ─── Mock data ───────────────────────────────────────────────────────────

const FEED: FeedItem[] = [
  {
    kind: 'dive',
    when: '12:14 PM',
    whenAgo: '2H AGO',
    author: { initials: 'KM', name: 'Kai M.', badge: 'Divemaster' },
    report: {
      author: 'Kai M.', authorInitials: 'KM', whenAgo: '2H AGO',
      date: 'Apr 15, 2024', time: '12:14 PM',
      spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
      diveType: '🤿 Scuba', rating: 'excellent',
      depthFt: 42, durationMin: 48, vizFt: 60, waterTempF: 79,
      conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
      wildlife: ['Green Turtle', 'Spinner Dolphin', 'Eagle Ray'],
      notes:
        "Spinner pod circled the dive boat for 20 min before we even got in the water. Once down, vis was clean to 60ft and the pipes were swarming with life. One of those days that reminds you why we live here.",
      photoCount: 8, stars: 5, recommend: 'Definitely', showSpot: true,
    },
  },
  {
    kind: 'milestone',
    when: 'Today',
    whenAgo: '3H AGO',
    author: { initials: 'RP', name: 'Ryan P.' },
    badge: { emoji: '🏆', title: 'Century Club', description: '100 dives logged' },
    tier: 'gold',
  },
  {
    kind: 'photo',
    when: '11:30 AM',
    whenAgo: '4H AGO',
    author: { initials: 'NO', name: 'Nina O.' },
    spot: 'Three Tables',
    caption: 'Whitetip cruising the lava arches at 35ft. Held my breath the whole time.',
    tint: '#0b5a6f',
    likes: 124, comments: 18, liked: true,
  },
  {
    kind: 'spot-review',
    when: 'Today',
    whenAgo: '5H AGO',
    author: { initials: 'AT', name: 'Alana T.', badge: 'Forecaster' },
    spot: 'Kealakekua Bay',
    region: "BIG ISLAND · KONA",
    rating: 'excellent',
    stars: 5,
    body:
      'Hands down the best vis I have ever seen here. The forecast model nailed it 4 days out — went from "promising" to "exceptional" exactly when predicted. Worth the boat ride.',
    visitCount: 12,
  },
  {
    kind: 'dive',
    when: '8:00 AM',
    whenAgo: '7H AGO',
    author: { initials: 'LS', name: 'Leilani S.', badge: 'Pro' },
    report: {
      author: 'Leilani S.', authorInitials: 'LS', whenAgo: '7H AGO',
      date: 'Apr 15, 2024', time: '8:00 AM',
      spot: 'Molokini Crater', region: 'MAUI · SOUTH',
      diveType: '🧜 Freediving', rating: 'great',
      depthFt: 48, durationMin: 65, vizFt: 75, waterTempF: 77,
      conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
      wildlife: ['Humpback', 'Reef Fish', 'Eagle Ray'],
      notes:
        'Heard humpback song through the entire dive. One passed within 50ft on the second descent. The crater wall just keeps giving.',
      photoCount: 11, stars: 5, recommend: 'Definitely', showSpot: true,
    },
  },
  {
    kind: 'photo',
    when: 'Yesterday',
    whenAgo: '1D AGO',
    author: { initials: 'TB', name: 'Tina B.' },
    spot: 'Honolua Bay',
    caption: 'Octopus mid color-change — I watched it shift three times in 30 seconds.',
    tint: '#1a3850',
    likes: 89, comments: 11,
  },
  {
    kind: 'milestone',
    when: 'Yesterday',
    whenAgo: '1D AGO',
    author: { initials: 'MH', name: 'Marcus H.' },
    badge: { emoji: '🗺️', title: 'Archipelago', description: 'Dived all 4 main islands this month' },
    tier: 'silver',
  },
  {
    kind: 'spot-review',
    when: '2D AGO',
    whenAgo: '2D AGO',
    author: { initials: 'SW', name: 'Sam W.' },
    spot: 'Sandy Beach',
    region: "O'AHU · EAST",
    rating: 'fair',
    stars: 2,
    body:
      'Took a beating from the shore break on entry. NW swell wraps in stronger than the forecast suggested. Honest review: skip this one unless you know exactly what you are doing.',
    visitCount: 3,
  },
  {
    kind: 'dive',
    when: '3D AGO',
    whenAgo: '3D AGO',
    author: { initials: 'JK', name: 'Jordan K.' },
    report: {
      author: 'Jordan K.', authorInitials: 'JK', whenAgo: '3D AGO',
      date: 'Apr 12, 2024', time: '10:30 AM',
      spot: 'Tunnels Beach', region: "KAUA'I · NORTH SHORE",
      diveType: '🐠 Snorkel', rating: 'good',
      depthFt: 18, durationMin: 90, vizFt: 50, waterTempF: 76,
      conditions: { current: 'Mild', surface: 'Calm', surge: 'Mild' },
      wildlife: ['Green Turtle', 'Reef Fish'],
      notes:
        "Lava tube system is wild — felt like swimming through a cathedral. Brought my kid for the first time, totally hooked her.",
      photoCount: 6, stars: 4, recommend: 'Yes', showSpot: true,
    },
  },
  {
    kind: 'photo',
    when: '4D AGO',
    whenAgo: '4D AGO',
    author: { initials: 'DC', name: 'Devin C.' },
    spot: 'Electric Beach',
    caption: 'Sunset spear session — beam through the water like a cathedral.',
    tint: '#0d4860',
    likes: 67, comments: 4,
  },
];

const FEED_FILTERS = ['Following', 'Discover', 'Trending'] as const;
const ISLAND_TOPICS = ['All islands', "O'ahu", 'Maui', 'Big Island', "Kaua'i"] as const;

const TRENDING_SPOTS = [
  { name: 'Electric Beach', region: "O'AHU · LEEWARD",   reports: 23, change: '+8',  rating: 'excellent' as ConditionTier },
  { name: 'Molokini Crater', region: 'MAUI · SOUTH',     reports: 18, change: '+5',  rating: 'excellent' as ConditionTier },
  { name: 'Kealakekua Bay',  region: 'BIG ISLAND · KONA', reports: 14, change: '+2', rating: 'excellent' as ConditionTier },
  { name: "Shark's Cove",    region: "O'AHU · NORTH",     reports: 12, change: '−1', rating: 'great'     as ConditionTier },
  { name: 'Tunnels Beach',   region: "KAUA'I · NORTH",    reports: 9,  change: '+3', rating: 'good'      as ConditionTier },
];

const TOP_CONTRIBUTORS = [
  { initials: 'KM', name: 'Kai M.',     activity: '23 reports · 47 photos', badge: 'Divemaster' as const },
  { initials: 'NO', name: 'Nina O.',    activity: '18 reports · 32 photos' },
  { initials: 'AT', name: 'Alana T.',   activity: '14 reports · 28 photos', badge: 'Forecaster' as const },
  { initials: 'LS', name: 'Leilani S.', activity: '12 reports · 41 photos', badge: 'Pro' as const },
];

const SUGGESTED_FOLLOWS = [
  { initials: 'HK', name: 'Hana K.',   reason: 'Dives 5 of your favorite spots',   mutualFriends: 3 },
  { initials: 'IM', name: 'Iolana M.', reason: 'Forecaster · 92% accuracy in Kona', mutualFriends: 2 },
  { initials: 'BK', name: 'Brody K.',  reason: 'Top contributor at Shark\'s Cove', mutualFriends: 1 },
];

const ACTIVITY_TODAY = {
  dives: 47,
  reports: 23,
  photos: 56,
  activeNow: 12,
};

// ─── Screen ──────────────────────────────────────────────────────────────

export interface CommunityScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function CommunityScreen({ activeNav = 'dashboard', onNavigate }: CommunityScreenProps) {
  const [filter, setFilter] = React.useState<(typeof FEED_FILTERS)[number]>('Following');
  const [island, setIsland] = React.useState<(typeof ISLAND_TOPICS)[number]>('All islands');

  // Filter feed by island when one is selected.
  const filtered = React.useMemo(() => {
    if (island === 'All islands') return FEED;
    return FEED.filter((item) => {
      if (item.kind === 'dive')        return item.report.region.includes(island);
      if (item.kind === 'photo')       return true; // photos don't carry island in mock
      if (item.kind === 'spot-review') return item.region.includes(island);
      return true;
    });
  }, [island]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.body}>
          <LeftSidebar
            filter={filter} onFilter={setFilter}
            island={island} onIsland={setIsland}
          />

          <View style={styles.feedColumn}>
            <FeedHeader filter={filter} island={island} count={filtered.length} />
            <View style={styles.feedList}>
              {filtered.map((item, i) => (
                <FeedItemView key={i} item={item} onNavigate={onNavigate} />
              ))}
              {filtered.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No posts match this filter</Text>
                  <Text style={styles.emptySub}>Try a different island or follow more divers.</Text>
                </View>
              ) : null}
            </View>
          </View>

          <RightSidebar onNavigate={onNavigate} />
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Left sidebar ────────────────────────────────────────────────────────

function LeftSidebar({
  filter,
  onFilter,
  island,
  onIsland,
}: {
  filter: (typeof FEED_FILTERS)[number];
  onFilter: (v: (typeof FEED_FILTERS)[number]) => void;
  island: (typeof ISLAND_TOPICS)[number];
  onIsland: (v: (typeof ISLAND_TOPICS)[number]) => void;
}) {
  return (
    <View style={styles.leftSidebar}>
      <View style={styles.sideSection}>
        <Text style={styles.sideLabel}>FEED</Text>
        {FEED_FILTERS.map((f) => {
          const active = f === filter;
          const counts = f === 'Following' ? FEED.length : f === 'Discover' ? 247 : 89;
          return (
            <Pressable
              key={f}
              onPress={() => onFilter(f)}
              style={[styles.sideRow, active && styles.sideRowActive]}
            >
              <Text style={[styles.sideRowLabel, active && styles.sideRowLabelActive]}>{f}</Text>
              <Text style={styles.sideRowCount}>{counts}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sideDivider} />

      <View style={styles.sideSection}>
        <Text style={styles.sideLabel}>BY ISLAND</Text>
        {ISLAND_TOPICS.map((i) => {
          const active = i === island;
          return (
            <Pressable
              key={i}
              onPress={() => onIsland(i)}
              style={[styles.sideRow, active && styles.sideRowActive]}
            >
              <Text style={[styles.sideRowLabel, active && styles.sideRowLabelActive]}>{i}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sideDivider} />

      <View style={styles.sideSection}>
        <Text style={styles.sideLabel}>TODAY</Text>
        <View style={styles.activityCard}>
          <View style={styles.activityRow}>
            <Text style={styles.activityValue}>{ACTIVITY_TODAY.dives}</Text>
            <Text style={styles.activityLabel}>DIVES</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityValue}>{ACTIVITY_TODAY.reports}</Text>
            <Text style={styles.activityLabel}>REPORTS</Text>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityValue}>{ACTIVITY_TODAY.photos}</Text>
            <Text style={styles.activityLabel}>PHOTOS</Text>
          </View>
          <View style={[styles.activityRow, styles.activityRowAccent]}>
            <View style={styles.activityLiveDot} />
            <Text style={[styles.activityValue, { color: colors.great }]}>{ACTIVITY_TODAY.activeNow}</Text>
            <Text style={styles.activityLabel}>IN WATER NOW</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Feed header ─────────────────────────────────────────────────────────

function FeedHeader({
  filter,
  island,
  count,
}: {
  filter: (typeof FEED_FILTERS)[number];
  island: (typeof ISLAND_TOPICS)[number];
  count: number;
}) {
  const title =
    filter === 'Following' ? 'Activity from divers you follow'
    : filter === 'Discover' ? 'Discover new divers'
    : 'Trending across Hawaii';

  return (
    <View style={styles.feedHeader}>
      <View style={styles.feedHeaderTextWrap}>
        <Text style={styles.feedHeaderTitle}>{title}</Text>
        <Text style={styles.feedHeaderSub}>
          {island === 'All islands' ? `${count} posts` : `${count} posts · ${island}`}
        </Text>
      </View>
      <Pressable style={styles.feedHeaderBtn}>
        <Text style={styles.feedHeaderBtnText}>+ Post update</Text>
      </Pressable>
    </View>
  );
}

// ─── Feed item dispatch ──────────────────────────────────────────────────

function FeedItemView({ item, onNavigate }: { item: FeedItem; onNavigate?: NavigateFn }) {
  if (item.kind === 'dive') {
    return (
      <DiveReportCard
        {...item.report}
        onPress={() => onNavigate?.('spot-detail', { spotId: slugify(item.report.spot) })}
      />
    );
  }
  if (item.kind === 'photo')       return <PhotoFeedCard item={item} onNavigate={onNavigate} />;
  if (item.kind === 'milestone')   return <MilestoneFeedCard item={item} />;
  if (item.kind === 'spot-review') return <SpotReviewFeedCard item={item} onNavigate={onNavigate} />;
  return null;
}

// ─── Feed item: photo ────────────────────────────────────────────────────

function PhotoFeedCard({ item, onNavigate }: { item: PhotoFeedItem; onNavigate?: NavigateFn }) {
  return (
    <View style={styles.feedCard}>
      <FeedCardHeader author={item.author} whenAgo={item.whenAgo} subtitle={`Posted a photo from ${item.spot}`} />

      <Pressable
        style={styles.photoImage}
        onPress={() => onNavigate?.('spot-detail', { spotId: slugify(item.spot) })}
      >
        <View style={[styles.photoImageBg, { backgroundColor: item.tint }]} />
        <View style={[styles.photoImageOverlay, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
        <View style={styles.photoImageSpotPill}>
          <Text style={styles.photoImageSpotPillText}>{item.spot}</Text>
        </View>
      </Pressable>

      <View style={styles.feedCardBody}>
        <Text style={styles.photoCaption}>{item.caption}</Text>
        <View style={styles.feedActionsRow}>
          <Pressable style={styles.feedAction}>
            <Text style={[styles.feedActionIcon, item.liked && { color: colors.nogo }]}>
              {item.liked ? '♥' : '♡'}
            </Text>
            <Text style={styles.feedActionText}>{item.likes}</Text>
          </Pressable>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>💬</Text>
            <Text style={styles.feedActionText}>{item.comments}</Text>
          </Pressable>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>↗</Text>
            <Text style={styles.feedActionText}>Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Feed item: milestone ────────────────────────────────────────────────

function MilestoneFeedCard({ item }: { item: MilestoneFeedItem }) {
  const tone =
    item.tier === 'gold'   ? { border: '#d4a017', bg: 'rgba(212,160,23,0.10)' }
    : item.tier === 'silver' ? { border: '#7d8a96', bg: 'rgba(125,138,150,0.10)' }
    : { border: colors.hairlineStrong, bg: colors.surface1 };

  return (
    <View style={styles.feedCard}>
      <FeedCardHeader author={item.author} whenAgo={item.whenAgo} subtitle="Earned an achievement" />
      <View style={styles.feedCardBody}>
        <View style={[styles.milestoneBadge, { borderColor: tone.border, backgroundColor: tone.bg }]}>
          <Text style={styles.milestoneEmoji}>{item.badge.emoji}</Text>
          <View style={styles.milestoneTextWrap}>
            <Text style={styles.milestoneTitle}>{item.badge.title}</Text>
            <Text style={styles.milestoneDescription}>{item.badge.description}</Text>
          </View>
        </View>
        <View style={styles.feedActionsRow}>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>♡</Text>
            <Text style={styles.feedActionText}>Congrats</Text>
          </Pressable>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>💬</Text>
            <Text style={styles.feedActionText}>Comment</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Feed item: spot review ──────────────────────────────────────────────

function SpotReviewFeedCard({ item, onNavigate }: { item: SpotReviewFeedItem; onNavigate?: NavigateFn }) {
  return (
    <View style={styles.feedCard}>
      <FeedCardHeader author={item.author} whenAgo={item.whenAgo} subtitle={`Reviewed ${item.spot} · visit #${item.visitCount}`} />
      <View style={styles.feedCardBody}>
        <Pressable
          onPress={() => onNavigate?.('spot-detail', { spotId: slugify(item.spot) })}
          style={styles.reviewSpotChip}
        >
          <View style={styles.reviewSpotTextWrap}>
            <Text style={styles.reviewSpotName}>{item.spot}</Text>
            <Text style={styles.reviewSpotRegion}>{item.region}</Text>
          </View>
          <ConditionPill tier={item.rating} size="md" />
        </Pressable>

        <View style={styles.reviewStarsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Text key={i} style={[styles.reviewStar, i < item.stars && styles.reviewStarFilled]}>★</Text>
          ))}
          <Text style={styles.reviewStarsLabel}>{item.stars} of 5</Text>
        </View>

        <Text style={styles.reviewBody}>{item.body}</Text>

        <View style={styles.feedActionsRow}>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>♡</Text>
            <Text style={styles.feedActionText}>34</Text>
          </Pressable>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>💬</Text>
            <Text style={styles.feedActionText}>7</Text>
          </Pressable>
          <Pressable style={styles.feedAction}>
            <Text style={styles.feedActionIcon}>↗</Text>
            <Text style={styles.feedActionText}>Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Shared feed card header ─────────────────────────────────────────────

function FeedCardHeader({
  author,
  whenAgo,
  subtitle,
}: {
  author: FeedAuthor;
  whenAgo: string;
  subtitle: string;
}) {
  return (
    <View style={styles.feedCardHeader}>
      <View style={styles.feedAvatar}>
        <Text style={styles.feedAvatarText}>{author.initials}</Text>
      </View>
      <View style={styles.feedHeaderTextCol}>
        <View style={styles.feedHeaderNameRow}>
          <Text style={styles.feedAuthorName}>{author.name}</Text>
          {author.badge ? (
            <View style={styles.feedAuthorBadge}>
              <Text style={styles.feedAuthorBadgeText}>{author.badge.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.feedHeaderSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.feedWhen}>{whenAgo}</Text>
    </View>
  );
}

// ─── Right sidebar ───────────────────────────────────────────────────────

function RightSidebar({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.rightSidebar}>
      <View style={styles.rightCard}>
        <View style={styles.rightCardHeader}>
          <Text style={styles.rightCardTitle}>Trending spots</Text>
          <Text style={styles.rightCardSub}>30 DAYS</Text>
        </View>
        {TRENDING_SPOTS.map((s, i) => (
          <Pressable
            key={s.name}
            onPress={() => onNavigate?.('spot-detail', { spotId: slugify(s.name) })}
            style={[styles.trendingRow, i < TRENDING_SPOTS.length - 1 && styles.trendingRowDivider]}
          >
            <Text style={styles.trendingRank}>{i + 1}</Text>
            <View style={[styles.trendingDot, { backgroundColor: TIER_COLORS[s.rating] }]} />
            <View style={styles.trendingTextWrap}>
              <Text style={styles.trendingName}>{s.name}</Text>
              <Text style={styles.trendingRegion}>{s.region}</Text>
            </View>
            <View style={styles.trendingStatsWrap}>
              <Text style={styles.trendingReports}>{s.reports}</Text>
              <Text style={[
                styles.trendingChange,
                { color: s.change.startsWith('−') ? colors.fair : colors.great },
              ]}>
                {s.change}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.rightCard}>
        <View style={styles.rightCardHeader}>
          <Text style={styles.rightCardTitle}>Top contributors</Text>
          <Text style={styles.rightCardSub}>THIS WEEK</Text>
        </View>
        {TOP_CONTRIBUTORS.map((c, i) => (
          <View
            key={c.name}
            style={[styles.contribRow, i < TOP_CONTRIBUTORS.length - 1 && styles.contribRowDivider]}
          >
            <View style={styles.contribAvatar}>
              <Text style={styles.contribAvatarText}>{c.initials}</Text>
            </View>
            <View style={styles.contribTextWrap}>
              <View style={styles.contribNameRow}>
                <Text style={styles.contribName}>{c.name}</Text>
                {c.badge ? (
                  <Text style={styles.contribBadge}>{c.badge.toUpperCase()}</Text>
                ) : null}
              </View>
              <Text style={styles.contribActivity}>{c.activity}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.rightCard}>
        <View style={styles.rightCardHeader}>
          <Text style={styles.rightCardTitle}>Suggested follows</Text>
        </View>
        {SUGGESTED_FOLLOWS.map((s, i) => (
          <View
            key={s.name}
            style={[styles.suggRow, i < SUGGESTED_FOLLOWS.length - 1 && styles.suggRowDivider]}
          >
            <View style={styles.suggAvatar}>
              <Text style={styles.suggAvatarText}>{s.initials}</Text>
            </View>
            <View style={styles.suggTextWrap}>
              <Text style={styles.suggName}>{s.name}</Text>
              <Text style={styles.suggReason}>{s.reason}</Text>
            </View>
            <Pressable style={styles.suggFollowBtn}>
              <Text style={styles.suggFollowText}>Follow</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Styles ──────────────────────────────────────────────────────────────

const LEFT_W = 220;
const RIGHT_W = 320;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
  },

  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // ── Left sidebar ──
  leftSidebar: {
    width: LEFT_W,
    paddingVertical: 24,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    gap: 0,
  },
  sideSection: {
    paddingHorizontal: 8,
    gap: 4,
  },
  sideLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    paddingHorizontal: 10,
    paddingBottom: 6,
    fontWeight: '700',
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    gap: 8,
  },
  sideRowActive: {
    backgroundColor: colors.accentDim,
  },
  sideRowLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  sideRowLabelActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  sideRowCount: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  sideDivider: {
    height: 1,
    marginVertical: 16,
    marginHorizontal: 18,
    backgroundColor: colors.hairline,
  },

  // Today activity card
  activityCard: {
    marginHorizontal: 10,
    padding: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    gap: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  activityRowAccent: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  activityLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.great,
  },
  activityValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  activityLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
    flex: 1,
  },

  // ── Feed column ──
  feedColumn: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  feedHeaderTextWrap: { flex: 1, gap: 4 },
  feedHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  feedHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  feedHeaderBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedHeaderBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },
  feedList: {
    gap: 14,
  },

  // Generic feed card shell
  feedCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  feedCardBody: {
    padding: 18,
    gap: 14,
  },

  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  feedAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
  },
  feedHeaderTextCol: { flex: 1, gap: 2 },
  feedHeaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedAuthorName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  feedAuthorBadge: {
    paddingHorizontal: 6,
    height: 16,
    borderRadius: 3,
    backgroundColor: colors.accentDim,
    justifyContent: 'center',
  },
  feedAuthorBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.accent,
  },
  feedHeaderSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text3,
  },
  feedWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },

  // Photo card
  photoImage: {
    aspectRatio: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  photoImageBg: { ...StyleSheet.absoluteFillObject },
  photoImageOverlay: { ...StyleSheet.absoluteFillObject },
  photoImageSpotPill: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    paddingHorizontal: 10,
    height: 22,
    backgroundColor: 'rgba(12,16,21,0.75)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
  },
  photoImageSpotPillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text1,
    fontWeight: '600',
  },
  photoCaption: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text1,
  },

  // Milestone
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  milestoneEmoji: {
    fontSize: 36,
  },
  milestoneTextWrap: { flex: 1, gap: 4 },
  milestoneTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  milestoneDescription: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },

  // Spot review
  reviewSpotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
  },
  reviewSpotTextWrap: { flex: 1, gap: 2 },
  reviewSpotName: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  reviewSpotRegion: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewStar: {
    fontSize: 18,
    color: colors.text4,
  },
  reviewStarFilled: {
    color: colors.accent,
  },
  reviewStarsLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    marginLeft: 6,
  },
  reviewBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text2,
  },

  // Generic feed actions
  feedActionsRow: {
    flexDirection: 'row',
    paddingTop: 4,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    marginTop: 4,
  },
  feedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
  },
  feedActionIcon: {
    fontSize: 14,
    color: colors.text2,
  },
  feedActionText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    fontWeight: '500',
  },

  // Empty state
  emptyState: {
    padding: 48,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },

  // ── Right sidebar ──
  rightSidebar: {
    width: RIGHT_W,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rightCardTitle: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  rightCardSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // Trending rows
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  trendingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  trendingRank: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    width: 14,
  },
  trendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trendingTextWrap: { flex: 1, gap: 2 },
  trendingName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text1,
  },
  trendingRegion: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.text3,
  },
  trendingStatsWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  trendingReports: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  trendingChange: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
  },

  // Contributor rows
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  contribRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  contribAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text1,
  },
  contribTextWrap: { flex: 1, gap: 2 },
  contribNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contribName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  contribBadge: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.accent,
  },
  contribActivity: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  // Suggested rows
  suggRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  suggRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  suggAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text1,
  },
  suggTextWrap: { flex: 1, gap: 2 },
  suggName: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  suggReason: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  suggFollowBtn: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggFollowText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.bg,
  },
});
