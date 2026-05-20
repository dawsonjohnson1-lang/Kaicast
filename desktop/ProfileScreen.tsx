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
import { HeatmapCell } from './components/HeatmapCell';

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

const USER = {
  initials: 'DJ',
  name: 'Dawson Johnson',
  handle: '@dawsonj',
  location: "Mililani, O'ahu",
  bio: 'Freediver, spearo, and ocean-data nerd. Building KaiCast.',
  stats: [
    { label: 'Dives',     value: '147' },
    { label: 'Spots',     value: '23' },
    { label: 'Species',   value: '34' },
    { label: 'Followers', value: '218' },
    { label: 'Following', value: '94' },
  ],
};

const TABS = ['Dashboard', 'Dive Reports', 'Friends', 'Settings'] as const;

const STAT_CARDS = [
  { icon: '🤿', value: '147', unit: '',   label: 'Dives logged' },
  { icon: '📏', value: '110', unit: 'ft', label: 'Personal depth record' },
  { icon: '⏱',  value: '38',  unit: 'h',  label: 'Total bottom time' },
];

const DIVE_LIST = [
  { spot: 'Electric Beach', meta: "O'ahu · Leeward · Apr 14, 2024 · 9:12am",      type: '🤿 Scuba',         depth: 68,  duration: 52, vis: 60, stars: 5 },
  { spot: "Shark's Cove",   meta: "O'ahu · North Shore · Apr 12, 2024 · 7:30am",  type: '🧜 Freediving',    depth: 42,  duration: 38, vis: 48, stars: 5 },
  { spot: 'Molokini Crater',meta: 'Maui · South · Apr 6, 2024 · 8:00am',          type: '🤿 Scuba',         depth: 110, duration: 44, vis: 80, stars: 5 },
  { spot: 'Electric Beach', meta: "O'ahu · Leeward · Apr 4, 2024 · 6:45am",       type: '🎣 Spearfishing',  depth: 35,  duration: 62, vis: 50, stars: 5 },
];

const FAVORITES = [
  { name: 'Electric Beach',  region: "O'AHU · LEEWARD",     rating: 'excellent' as ConditionTier, vis: 56, water: 79, current: 1 },
  { name: "Shark's Cove",    region: "O'AHU · NORTH SHORE", rating: 'great'     as ConditionTier, vis: 48, water: 77, current: 2 },
  { name: 'Molokini Crater', region: 'MAUI · SOUTH',        rating: 'excellent' as ConditionTier, vis: 80, water: 77, current: 1 },
];

const SPECIES: Array<{ emoji: string; name: string; rare?: boolean }> = [
  { emoji: '🐢', name: 'Green Turtle' },
  { emoji: '🦈', name: 'Reef Shark' },
  { emoji: '🐠', name: 'Reef Fish' },
  { emoji: '🦭', name: 'Monk Seal', rare: true },
  { emoji: '🐬', name: 'Dolphin' },
  { emoji: '🌊', name: 'Eagle Ray' },
  { emoji: '🐙', name: 'Octopus' },
  { emoji: '🐋', name: 'Humpback', rare: true },
  { emoji: '🦑', name: 'Squid' },
  { emoji: '🐍', name: 'Moray Eel' },
];

const ACHIEVEMENTS: Array<{ emoji: string; title: string; desc: string; tier?: 'gold' | 'silver' }> = [
  { emoji: '🏆', title: 'Century Club',    desc: '100 dives logged',  tier: 'gold' },
  { emoji: '👁',  title: 'Glass-off',       desc: '60ft+ visibility',  tier: 'gold' },
  { emoji: '🗺️', title: 'Archipelago',     desc: '4 islands dived',    tier: 'silver' },
  { emoji: '🧜', title: 'Breath-holder',    desc: '50 freedives',       tier: 'silver' },
  { emoji: '🎣', title: 'Spearfisherman',   desc: '25 spear dives' },
];

// 12×12 heatmap grid
const HEATMAP = Array.from({ length: 52 }, () =>
  Array.from({ length: 7 }, () => Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4),
);

const FORECASTER_BADGE = {
  label: 'FORECASTER',
  sub: 'Top 5% accuracy',
};

const PERSONAL_RECORD = {
  label: 'PERSONAL RECORD',
  depthFt: 110,
  spot: 'Molokini Crater',
  date: 'APR 6, 2024',
};

// ─── Screen ───────────────────────────────────────────────────────────────

export interface ProfileScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
}

export function ProfileScreen({ activeNav = 'dashboard' }: ProfileScreenProps) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>('Dashboard');

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} />

      <View style={styles.maxWidth}>
        <ProfileHeader />
        <TabBar value={tab} onTab={setTab} />
        <DashboardTabBody />
      </View>
    </ScrollView>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────

function ProfileHeader() {
  return (
    <View style={styles.header}>
      {/* Ocean background placeholder */}
      <View style={styles.headerBg} />
      <View style={styles.headerOverlay} />

      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{USER.initials}</Text>
            </View>
          </View>

          <View style={styles.headerNameWrap}>
            <Text style={styles.headerName}>{USER.name}</Text>
            <View style={styles.headerHandleRow}>
              <Text style={styles.headerHandle}>{USER.handle}</Text>
              <View style={styles.headerHandleDot} />
              <Text style={styles.headerHandle}>{USER.location}</Text>
            </View>
            <Text style={styles.headerBio}>{USER.bio}</Text>

            <View style={styles.headerStatsRow}>
              {USER.stats.map((s) => (
                <View key={s.label} style={styles.headerStat}>
                  <Text style={styles.headerStatValue}>{s.value}</Text>
                  <Text style={styles.headerStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.headerButtonRow}>
              <Pressable style={[styles.headerBtn, styles.headerBtnPrimary]}>
                <Text style={styles.headerBtnPrimaryText}>Follow</Text>
              </Pressable>
              <Pressable style={styles.headerBtn}>
                <Text style={styles.headerBtnText}>Message</Text>
              </Pressable>
              <Pressable style={styles.headerBtnIcon}>
                <Text style={styles.headerBtnIconText}>⋯</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.forecasterBadge}>
            <Text style={styles.forecasterEmoji}>🔮</Text>
            <Text style={styles.forecasterLabel}>{FORECASTER_BADGE.label}</Text>
            <Text style={styles.forecasterSub}>{FORECASTER_BADGE.sub}</Text>
          </View>

          <View style={styles.prCard}>
            <Text style={styles.prLabel}>{PERSONAL_RECORD.label}</Text>
            <View style={styles.prValueRow}>
              <Text style={styles.prValue}>{PERSONAL_RECORD.depthFt}</Text>
              <Text style={styles.prUnit}>ft</Text>
            </View>
            <Text style={styles.prSpot}>{PERSONAL_RECORD.spot}</Text>
            <Text style={styles.prDate}>{PERSONAL_RECORD.date}</Text>
          </View>
        </View>
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

function DashboardTabBody() {
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
        <FavoriteSpotsSidebar />
        <SpeciesBlock />
        <AchievementsBlock />
      </View>
    </View>
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

function FavoriteSpotsSidebar() {
  return (
    <View style={styles.sideBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Favorite spots</Text>
        <Text style={styles.sectionLink}>See all →</Text>
      </View>
      <View style={styles.favList}>
        {FAVORITES.map((f) => (
          <View key={f.name} style={styles.favCard}>
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
          </View>
        ))}
      </View>
    </View>
  );
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a3a4d',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,16,21,0.55)',
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
  bodySidebar: { width: 340, gap: 24 },

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
