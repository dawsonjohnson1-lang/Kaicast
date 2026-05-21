import React from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import forecastHeroBg from './assets/figma/backgrounds/forecast-hero.png';
import {
  colors,
  fonts,
  radius,
  spacing,
  DESKTOP_MAX_WIDTH,
  TIER_COLORS,
  type ConditionTier,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { ConditionPill } from './components/ConditionPill';
import { DiveReportCard, type DiveReportCardProps } from './components/DiveReportCard';
import { KaiCastMap } from './components/maps/KaiCastMap';
import type { NavigateFn } from './router';

// Electric Beach mock — used by the mini-map in the Spot Info tab.
// When SPOT is upgraded to dynamic data, these come from there.
const SPOT_LAT = 21.354;
const SPOT_LNG = -158.118;

/**
 * Spot Detail / Forecast — desktop screen.
 *
 * Layout (top→bottom):
 *   - DesktopNav (shared)
 *   - Breadcrumb
 *   - Hero: title + meta + AI summary, satellite image on the right
 *   - 7-day forecast strip
 *   - Tab bar
 *   - 2-col main grid: left (hourly / swells / tide) | right (sidebar)
 *
 * Mock data matches the Figma reference (Electric Beach, O'ahu).
 */

// ─── Mock data ────────────────────────────────────────────────────────────

const SPOT = {
  name: 'Electric Beach',
  region: "O'ahu · Leeward Coast",
  coords: '21.354°N, 158.118°W',
  distance: '4.2 mi away',
  updatedAt: 'Updated 2 min ago',
  rating: 'excellent' as ConditionTier,
  summary:
    'Crystal clear visibility with a building WNW groundswell makes for ideal afternoon conditions. Light trades hold through 5pm, then a midnight wind shift cleans up the surface for an early dawn patrol.',
  bestWindow: '2pm – 5pm',
  activities: ['Freedive', 'Snorkel', 'Scuba'],
  currentLevel: 'Light · 0.4 kt',
  runoff: 'No runoff risk',
};

type ForecastDay = {
  label: string;
  date: string;
  rating: ConditionTier;
  waveLo: number;
  waveHi: number;
  vis: string;
  bars: ConditionTier[]; // 8 colored bars representing 3-hour conditions across the day
};

const FORECAST_DAYS: ForecastDay[] = [
  { label: 'Wed', date: 'Apr 15', rating: 'excellent', waveLo: 2, waveHi: 4, vis: '50–60FT',
    bars: ['great', 'great', 'excellent', 'excellent', 'excellent', 'excellent', 'great', 'good'] },
  { label: 'Thu', date: 'Apr 16', rating: 'excellent', waveLo: 3, waveHi: 5, vis: '55–65FT',
    bars: ['good', 'great', 'great', 'excellent', 'excellent', 'excellent', 'excellent', 'great'] },
  { label: 'Fri', date: 'Apr 17', rating: 'great',     waveLo: 3, waveHi: 5, vis: '45–55FT',
    bars: ['good', 'good', 'great', 'great', 'great', 'great', 'great', 'good'] },
  { label: 'Sat', date: 'Apr 18', rating: 'good',      waveLo: 4, waveHi: 6, vis: '35–45FT',
    bars: ['fair', 'fair', 'good', 'good', 'good', 'good', 'fair', 'fair'] },
  { label: 'Sun', date: 'Apr 19', rating: 'fair',      waveLo: 5, waveHi: 7, vis: '25–35FT',
    bars: ['no-go', 'no-go', 'fair', 'fair', 'fair', 'fair', 'no-go', 'no-go'] },
  { label: 'Mon', date: 'Apr 20', rating: 'good',      waveLo: 3, waveHi: 5, vis: '35–45FT',
    bars: ['fair', 'good', 'good', 'good', 'great', 'good', 'good', 'fair'] },
  { label: 'Tue', date: 'Apr 21', rating: 'great',     waveLo: 2, waveHi: 4, vis: '45–55FT',
    bars: ['good', 'great', 'great', 'great', 'great', 'great', 'great', 'good'] },
];

type HourRow = {
  time: string;
  rating: ConditionTier;
  stars: number; // 0–5
  wave: string;
  vis: string;
  wind: string;
  tide: string;
  swell: string;
};

const HOURLY: HourRow[] = [
  { time: '2 PM', rating: 'excellent', stars: 5, wave: '3.1 FT @ 9s', vis: '58 FT', wind: '7 KT NE', tide: '+1.4 FT', swell: '295° WNW' },
  { time: '3 PM', rating: 'excellent', stars: 5, wave: '3.2 FT @ 9s', vis: '60 FT', wind: '8 KT NE', tide: '+0.9 FT', swell: '295° WNW' },
  { time: '4 PM', rating: 'excellent', stars: 5, wave: '3.4 FT @ 9s', vis: '58 FT', wind: '9 KT NE', tide: '+0.5 FT', swell: '295° WNW' },
  { time: '5 PM', rating: 'great',     stars: 4, wave: '3.4 FT @ 9s', vis: '55 FT', wind: '11 KT NE', tide: '+0.3 FT', swell: '295° WNW' },
  { time: '6 PM', rating: 'great',     stars: 4, wave: '3.3 FT @ 9s', vis: '52 FT', wind: '11 KT NE', tide: '+0.5 FT', swell: '300° WNW' },
  { time: '7 PM', rating: 'good',      stars: 3, wave: '3.1 FT @ 8s', vis: '48 FT', wind: '10 KT NE', tide: '+0.9 FT', swell: '300° WNW' },
  { time: '8 PM', rating: 'good',      stars: 3, wave: '3.0 FT @ 8s', vis: '45 FT', wind: '8 KT NE',  tide: '+1.4 FT', swell: '300° WNW' },
];

const NEARBY = [
  { name: 'Three Tables',  region: 'North Shore',  dist: '12.4 MI', rating: 'great'     as ConditionTier, swell: '3.2 FT' },
  { name: "Shark's Cove",  region: 'North Shore',  dist: '12.8 MI', rating: 'great'     as ConditionTier, swell: '3.0 FT' },
  { name: 'Magic Island',  region: 'South Shore',  dist: '18.1 MI', rating: 'good'      as ConditionTier, swell: '1.8 FT' },
  { name: 'Hanauma Bay',   region: 'East Shore',   dist: '24.6 MI', rating: 'good'      as ConditionTier, swell: '1.2 FT' },
];

const BUOYS = [
  { id: '51212', name: 'Pearl Harbor', dist: '8.4 MI',  height: '3.1' },
  { id: '51201', name: 'Waimea Bay',   dist: '21.6 MI', height: '3.4' },
  { id: '51001', name: 'NW Hawaii',    dist: '27.2 MI', height: '4.2' },
];

const TABS = ['Forecast', 'Conditions', 'Buoys', 'Reports', 'Photos', 'Spot Info', 'Hazards'];

// ─── Main screen ──────────────────────────────────────────────────────────

export interface SpotDetailScreenProps {
  /** Currently-selected primary nav tab. Defaults to Forecast (this screen IS the forecast). */
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
  onNavigate?: NavigateFn;
}

export function SpotDetailScreen({ activeNav = 'forecast', onNavigate }: SpotDetailScreenProps) {
  const [tab, setTab] = React.useState('Forecast');

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <Breadcrumb onNavigate={onNavigate} />
        <Hero />
        <ForecastStrip />
        <TabBar tab={tab} onTab={setTab} />
        {tab === 'Forecast'   ? <ForecastTabBody  onNavigate={onNavigate} /> : null}
        {tab === 'Spot Info'  ? <SpotInfoTabBody  /> : null}
        {tab === 'Hazards'    ? <HazardsTabBody /> : null}
        {tab === 'Reports'    ? <ReportsTabBody onNavigate={onNavigate} /> : null}
        {tab === 'Buoys'      ? <BuoysTabBody /> : null}
        {tab === 'Photos'     ? <PhotosTabBody onNavigate={onNavigate} /> : null}
        {tab === 'Conditions' ? <ConditionsTabBody /> : null}
      </View>
    </ScrollView>
  );
}

function TabComingSoon({ name }: { name: string }) {
  return (
    <View style={styles.comingSoonWrap}>
      <Text style={styles.comingSoonIcon}>◇</Text>
      <Text style={styles.comingSoonTitle}>{name} tab</Text>
      <Text style={styles.comingSoonSub}>Coming soon — building one tab per turn.</Text>
    </View>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────

function Breadcrumb({ onNavigate }: { onNavigate?: NavigateFn }) {
  // First parts navigate up; last is the current location and stays inert.
  const parts: Array<{ label: string; to?: () => void }> = [
    { label: 'Hawaiian Islands', to: () => onNavigate?.('spots-map') },
    { label: "O'ahu",             to: () => onNavigate?.('spots-map') },
    { label: 'Leeward Coast',     to: () => onNavigate?.('conditions') },
    { label: 'Electric Beach' },
  ];
  return (
    <View style={styles.breadcrumb}>
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        const content = (
          <Text style={[styles.breadcrumbItem, isLast && styles.breadcrumbItemActive]}>
            {p.label}
          </Text>
        );
        return (
          <React.Fragment key={p.label}>
            {p.to ? <Pressable onPress={p.to}>{content}</Pressable> : content}
            {!isLast ? <Text style={styles.breadcrumbSep}>›</Text> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <View style={styles.heroOuter}>
      <View style={styles.heroInner}>
        <View style={styles.heroHeaderRow}>
          <Text style={styles.heroTitle}>{SPOT.name}</Text>
          <Stars n={5} size={22} />
          <View style={styles.heroBadgesRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <ConditionPill tier={SPOT.rating} size="md" />
          </View>
        </View>

        <View style={styles.heroMetaRow}>
          <MetaItem text={SPOT.coords} />
          <MetaDot />
          <MetaItem text={SPOT.distance} />
          <MetaDot />
          <MetaItem text="Leeward Coast" />
          <MetaDot />
          <MetaItem text={SPOT.updatedAt} />
        </View>

        <View style={styles.heroBody}>
          <View style={styles.heroBodyLeft}>
            <Text style={styles.heroSummary}>{SPOT.summary}</Text>

            <View style={styles.heroInlineFacts}>
              <InlineFact label="Best window" value={SPOT.bestWindow} />
              <InlineFact label="Activities" value={SPOT.activities.join(' · ')} />
              <InlineFact label="Current" value={SPOT.currentLevel} />
              <InlineFact label="Runoff" value={SPOT.runoff} />
            </View>
          </View>

          <Image
            source={{ uri: forecastHeroBg }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>
  );
}

function MetaItem({ text }: { text: string }) {
  return <Text style={styles.heroMeta}>{text}</Text>;
}
function MetaDot() {
  return <View style={styles.heroMetaDot} />;
}
function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inlineFact}>
      <Text style={styles.inlineFactLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.inlineFactValue}>{value}</Text>
    </View>
  );
}

// ─── 7-day forecast strip ─────────────────────────────────────────────────

function ForecastStrip() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.cardHeaderDot} />
          <Text style={styles.cardHeaderTitle}>7-day forecast · WNW swell building Thursday</Text>
        </View>
        <View style={styles.unitToggle}>
          <View style={[styles.unitToggleBtn, styles.unitToggleBtnActive]}>
            <Text style={[styles.unitToggleText, styles.unitToggleTextActive]}>FT</Text>
          </View>
          <View style={styles.unitToggleBtn}>
            <Text style={styles.unitToggleText}>M</Text>
          </View>
        </View>
      </View>

      <View style={styles.forecastRow}>
        {FORECAST_DAYS.map((d, i) => (
          <ForecastDayCard key={d.label} day={d} isFirst={i === 0} />
        ))}
      </View>
    </View>
  );
}

function ForecastDayCard({ day, isFirst }: { day: ForecastDay; isFirst: boolean }) {
  return (
    <View style={[styles.forecastCell, isFirst && styles.forecastCellFirst]}>
      <View style={[styles.forecastTopAccent, { backgroundColor: TIER_COLORS[day.rating] }]} />

      <View style={styles.forecastRowTop}>
        <Text style={styles.forecastDayLabel}>{day.label}</Text>
        <Text style={styles.forecastDate}>{day.date}</Text>
      </View>

      <Stars n={day.rating === 'excellent' ? 5 : day.rating === 'great' ? 4 : day.rating === 'good' ? 3 : day.rating === 'fair' ? 2 : 1} size={11} />

      <View style={styles.forecastWaveRow}>
        <Text style={styles.forecastWaveNum}>{day.waveLo}–{day.waveHi}</Text>
        <Text style={styles.forecastWaveUnit}>FT</Text>
      </View>

      <Text style={styles.forecastVis}>VIS {day.vis}</Text>

      <View style={styles.forecastBars}>
        {day.bars.map((tier, idx) => (
          <View key={idx} style={[styles.forecastBar, { backgroundColor: TIER_COLORS[tier] }]} />
        ))}
      </View>

      <View style={styles.forecastTimeRow}>
        <Text style={styles.forecastTimeLabel}>AM</Text>
        <Text style={styles.forecastTimeLabel}>PM</Text>
        <Text style={styles.forecastTimeLabel}>EVE</Text>
      </View>
    </View>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────

function TabBar({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const isActive = t === tab;
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

// ─── Main grid (2-col) ────────────────────────────────────────────────────

function ForecastTabBody({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <HourlyCard />
        <SwellsCard />
        <TideCard />
      </View>
      <View style={styles.mainRight}>
        <SpotInfoCard />
        <BuoysCard />
        <NearbyCard onNavigate={onNavigate} />
        <ReportsCard />
        <ProCTACard />
      </View>
    </View>
  );
}

// ─── Spot Info tab body ──────────────────────────────────────────────────

const ABOUT_PARAGRAPHS = [
  'Electric Beach takes its name from the AES Hawai\'i Power Plant\'s warm-water outflow at the south end of the bay. The plume draws in pelagics — spinner dolphins, monk seals, eagle rays, and the occasional manta — making it one of the most reliable wildlife dives on O\'ahu year-round.',
  'The site is a shore dive over a mostly sandy bottom with scattered lava patches and the famous concrete pipes at 35–45 ft. Entry is from the boulder beach at the southern parking lot; experienced divers can swim straight out to the pipes, while newer divers can stay shallower and still see the dolphins.',
];

const ACCESS_FACTS = [
  { label: 'Parking',     value: 'Free lot at Kahe Point Beach Park · 30 spots' },
  { label: 'Walk',        value: '~100 ft over boulders to entry — wear booties' },
  { label: 'Restrooms',   value: 'Yes, at the park entrance' },
  { label: 'Showers',     value: 'Cold-water rinse on-site' },
  { label: 'Cell signal', value: '5G on the beach (Verizon / T-Mobile / AT&T)' },
  { label: 'Lifeguard',   value: 'No' },
];

const DIVE_PROFILE = [
  { label: 'Site type',    value: 'Shore dive · open ocean' },
  { label: 'Max depth',    value: '45 ft / 14 m (the pipes)' },
  { label: 'Typical depth', value: '25–35 ft / 8–11 m' },
  { label: 'Bottom type',  value: 'Lava reef · sand patches · concrete pipes' },
  { label: 'Skill level',  value: 'Intermediate (current at the plume)' },
  { label: 'Activities',   value: 'Scuba · Freediving · Snorkel' },
];

const MARINE_LIFE_LIST = [
  { emoji: '🐬', name: 'Spinner Dolphins',  season: 'Year-round · most active mornings' },
  { emoji: '🦭', name: 'Hawaiian Monk Seal', season: 'Rare · don\'t approach within 50ft' },
  { emoji: '🐢', name: 'Green Sea Turtle',  season: 'Year-round' },
  { emoji: '🌊', name: 'Eagle Ray',         season: 'Common · usually solo cruising' },
  { emoji: '🦈', name: 'Whitetip Reef Shark', season: 'Resting in lava arches' },
  { emoji: '🐋', name: 'Manta Ray',         season: 'Rare · plankton blooms only' },
];

const TIPS = [
  {
    author: 'Kai M.',
    initials: 'KM',
    role: 'PADI Divemaster · 240 dives here',
    body: 'Get there by 7am for the dolphins. The current at the plume picks up after 10am — be ready to swim against it back to shore.',
  },
  {
    author: 'Leilani S.',
    initials: 'LS',
    role: 'Open Water · 18 dives here',
    body: 'Wear thick-soled booties for the entry — those boulders are SHARP and slippery. Walk straight out past the small surf, then descend in 8ft of water.',
  },
  {
    author: 'Marcus H.',
    initials: 'MH',
    role: 'Freediver · 60 dives here',
    body: 'For freediving, go straight to the southern pipe — it sits at 35ft and the bait fish stack there in the afternoon. Easy hangout depth.',
  },
];

const PERMITS = [
  { label: 'Fee',         value: 'Free' },
  { label: 'Permit',      value: 'None required' },
  { label: 'Group limit', value: 'Not enforced — keep groups small' },
  { label: 'Spearfishing', value: 'Allowed outside the marine reserve buffer (50yd from plant)' },
  { label: 'Drones',      value: 'Permit required (city park rules)' },
];

const BEST_SEASON = [
  { month: 'Jan', score: 3 }, { month: 'Feb', score: 3 }, { month: 'Mar', score: 4 },
  { month: 'Apr', score: 5 }, { month: 'May', score: 5 }, { month: 'Jun', score: 4 },
  { month: 'Jul', score: 3 }, { month: 'Aug', score: 3 }, { month: 'Sep', score: 4 },
  { month: 'Oct', score: 4 }, { month: 'Nov', score: 3 }, { month: 'Dec', score: 2 },
];

const AT_A_GLANCE = [
  { label: 'Difficulty',  value: 'Intermediate' },
  { label: 'Max depth',   value: '45 FT' },
  { label: 'Avg vis',     value: '50 FT' },
  { label: 'Water temp',  value: '74–80 °F' },
];

const HISTORY_FACTS = [
  { label: 'First documented dive', value: '1987' },
  { label: 'Logged dives (all-time)', value: '34,221' },
  { label: 'Logged this month',     value: '218' },
  { label: 'In KaiCast database since', value: '2024' },
];

function SpotInfoTabBody() {
  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <InfoSection title="About this spot">
          {ABOUT_PARAGRAPHS.map((p, i) => (
            <Text key={i} style={styles.infoBodyText}>{p}</Text>
          ))}
        </InfoSection>

        <InfoSection title="Location">
          <View style={styles.spotInfoMapWrap}>
            <KaiCastMap
              markers={[{ id: SPOT.name, lng: SPOT_LNG, lat: SPOT_LAT, tier: SPOT.rating, label: SPOT.name }]}
              center={[SPOT_LNG, SPOT_LAT]}
              zoom={11.5}
              selectedId={SPOT.name}
              showZoomControls
            />
          </View>
        </InfoSection>

        <InfoSection title="Access & parking">
          {ACCESS_FACTS.map((f, i) => (
            <FactRow key={f.label} label={f.label} value={f.value} isLast={i === ACCESS_FACTS.length - 1} />
          ))}
        </InfoSection>

        <InfoSection title="Entry & exit">
          <Text style={styles.infoBodyText}>
            From the parking lot, walk south along the boulder beach roughly 100 feet to the entry point. The shoreline is rocky and slippery — wear hard-soled booties and time your entry between sets. Wade out to chest depth (about 8 ft) before descending so you clear the inside reef. Exit at the same point; if the surf is up, swim a few hundred feet south to the smaller sand pocket which is calmer.
          </Text>
        </InfoSection>

        <InfoSection title="Dive profile">
          {DIVE_PROFILE.map((f, i) => (
            <FactRow key={f.label} label={f.label} value={f.value} isLast={i === DIVE_PROFILE.length - 1} />
          ))}
        </InfoSection>

        <InfoSection title="Marine life">
          <View style={styles.marineList}>
            {MARINE_LIFE_LIST.map((m) => (
              <View key={m.name} style={styles.marineItem}>
                <Text style={styles.marineEmoji}>{m.emoji}</Text>
                <View style={styles.marineTextWrap}>
                  <Text style={styles.marineName}>{m.name}</Text>
                  <Text style={styles.marineSeason}>{m.season}</Text>
                </View>
              </View>
            ))}
          </View>
        </InfoSection>

        <InfoSection title="Tips from divers" subtitle="Community-contributed">
          {TIPS.map((t, i) => (
            <View
              key={i}
              style={[styles.tipRow, i < TIPS.length - 1 && styles.tipRowDivider]}
            >
              <View style={styles.tipAvatar}>
                <Text style={styles.tipAvatarText}>{t.initials}</Text>
              </View>
              <View style={styles.tipBody}>
                <View style={styles.tipHeaderRow}>
                  <Text style={styles.tipAuthor}>{t.author}</Text>
                  <Text style={styles.tipRole}>{t.role}</Text>
                </View>
                <Text style={styles.tipText}>{t.body}</Text>
              </View>
            </View>
          ))}
          <AddTipCta />
        </InfoSection>

        <InfoSection title="Permits & rules">
          {PERMITS.map((f, i) => (
            <FactRow key={f.label} label={f.label} value={f.value} isLast={i === PERMITS.length - 1} />
          ))}
        </InfoSection>
      </View>

      <View style={styles.mainRight}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>At a glance</Text>
          </View>
          <View style={styles.glanceGrid}>
            {AT_A_GLANCE.map((g, i) => (
              <View
                key={g.label}
                style={[
                  styles.glanceCell,
                  i % 2 === 0 && styles.glanceCellRight,
                  i < 2 && styles.glanceCellBottom,
                ]}
              >
                <Text style={styles.glanceLabel}>{g.label.toUpperCase()}</Text>
                <Text style={styles.glanceValue}>{g.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Best season</Text>
            <Text style={styles.cardHeaderMono}>BASED ON 5-YR HISTORY</Text>
          </View>
          <View style={styles.seasonBody}>
            <View style={styles.seasonBarRow}>
              {BEST_SEASON.map((m) => (
                <View key={m.month} style={styles.seasonBarCol}>
                  <View
                    style={[
                      styles.seasonBar,
                      { height: m.score * 16, backgroundColor: tierForScore(m.score) },
                    ]}
                  />
                  <Text style={styles.seasonMonth}>{m.month}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.seasonCaption}>
              Peak window: <Text style={{ color: colors.text1, fontWeight: '600' }}>April – June</Text> · gentlest swell + best visibility
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Spot history</Text>
          </View>
          {HISTORY_FACTS.map((f, i) => (
            <View
              key={f.label}
              style={[styles.historyRow, i < HISTORY_FACTS.length - 1 && styles.historyRowDivider]}
            >
              <Text style={styles.historyLabel}>{f.label}</Text>
              <Text style={styles.historyValue}>{f.value}</Text>
            </View>
          ))}
        </View>

        <ProCTACard />
      </View>
    </View>
  );
}

function InfoSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoSectionHeader}>
        <Text style={styles.infoSectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.infoSectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.infoSectionBody}>{children}</View>
    </View>
  );
}

function FactRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.factRow, !isLast && styles.factRowDivider]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function tierForScore(score: number): string {
  if (score >= 5) return colors.excellent;
  if (score >= 4) return colors.great;
  if (score >= 3) return colors.good;
  if (score >= 2) return colors.fair;
  return colors.nogo;
}

// ─── Hazards tab body ────────────────────────────────────────────────────

type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';

const RISK_TONES: Record<RiskLevel, { color: string; label: string }> = {
  low:      { color: colors.great, label: 'LOW' },
  moderate: { color: colors.good,  label: 'MODERATE' },
  high:     { color: colors.fair,  label: 'HIGH' },
  extreme:  { color: colors.nogo,  label: 'EXTREME' },
};

const TODAYS_RISK = {
  level: 'low' as RiskLevel,
  headline: 'Conditions are favorable today',
  body:
    'No active warnings for Electric Beach. Light onshore wind, calm surface, normal tidal range. Standing hazards (boat traffic from the plant, sharp boulder entry) remain in effect — see below.',
};

const ACTIVE_ALERTS: Array<{
  level: RiskLevel;
  title: string;
  body: string;
  issued: string;
  source: string;
}> = [
  {
    level: 'moderate',
    title: 'Box jellyfish window opens Saturday',
    body:
      "Last full moon was April 9. Box jellyfish typically arrive at south & leeward O'ahu shores 8–10 days after — expect peak presence Sat Apr 17 → Mon Apr 19. Wear a full suit or stay shallow.",
    issued: 'Updated 2h ago',
    source: 'KaiCast model · Waikiki Aquarium',
  },
  {
    level: 'low',
    title: 'Power plant maintenance — Apr 18',
    body:
      'Brief outflow shutdown 5 AM – 9 AM means temperature plume + nutrient flow stops. Wildlife typically disperses for ~24h after.',
    issued: 'Posted 1d ago',
    source: 'AES Hawai\'i public notice',
  },
];

const STANDING_HAZARDS = [
  {
    icon: '⚠',
    title: 'Sharp boulder entry',
    detail: 'Lava boulders at the entry are sharp and slippery. Mandatory hard-soled booties; time entry between sets.',
    severity: 'moderate' as RiskLevel,
  },
  {
    icon: '🌀',
    title: 'Plume current',
    detail: 'Outflow current runs offshore at 1–2 kts near the pipe. Stay aware of your position; swim back along the bottom contour rather than against the current.',
    severity: 'moderate' as RiskLevel,
  },
  {
    icon: '🚤',
    title: 'Boat traffic',
    detail: 'Service boats access the plant intake. Stay close to the bottom in the channel; use surface markers when ascending.',
    severity: 'low' as RiskLevel,
  },
  {
    icon: '🌊',
    title: 'Northwest swell exposure',
    detail: 'Site is exposed to NW wraps. Avoid when NW swell > 6 ft — entry becomes dangerous and visibility crashes.',
    severity: 'high' as RiskLevel,
  },
];

const MARINE_CAUTIONS = [
  {
    emoji: '🪼',
    name: 'Box jellyfish',
    rule: '8–12 day window after full moon. Sting can be severe — full suit + hood.',
    severity: 'high' as RiskLevel,
  },
  {
    emoji: '🦭',
    name: 'Hawaiian monk seal',
    rule: 'Federally protected. Do not approach within 150 ft. Exit water if a seal hauls out on entry.',
    severity: 'moderate' as RiskLevel,
  },
  {
    emoji: '🦈',
    name: 'Tiger / whitetip sharks',
    rule: 'Whitetips common, usually resting. Tigers rare but seen — stay calm, do not splash, surface slowly with eye contact.',
    severity: 'low' as RiskLevel,
  },
  {
    emoji: '🐡',
    name: 'Crown-of-thorns sea star',
    rule: 'Don\'t touch. Spines cause prolonged pain. Common on the deeper reef shelves.',
    severity: 'low' as RiskLevel,
  },
  {
    emoji: '🦂',
    name: 'Hawaiian lionfish (nohu)',
    rule: 'Venomous spines on dorsal fin. Often camouflaged on rubble — watch your hands when stabilizing.',
    severity: 'moderate' as RiskLevel,
  },
];

const RECENT_INCIDENTS = [
  {
    when: 'APR 8',
    severity: 'low' as RiskLevel,
    body: 'Diver lost a fin on the rocky entry — recovered by a teammate. Reminder to secure heel straps.',
  },
  {
    when: 'MAR 28',
    severity: 'moderate' as RiskLevel,
    body: "Group swept ~200 yd offshore by stronger-than-forecast current. All surfaced safely; called the Coast Guard to be safe.",
  },
  {
    when: 'MAR 15',
    severity: 'high' as RiskLevel,
    body: "Box jellyfish sting on a snorkeler — required EMS. Window was published but the visitor wasn't aware.",
  },
];

const EMERGENCY_CONTACTS = [
  { label: 'EMS / 911',                  value: '911 (or 808-723-7777)', primary: true },
  { label: 'Coast Guard rescue',         value: '808-535-3333' },
  { label: 'Nearest ER',                 value: "Pali Momi · 7 mi" },
  { label: 'Hyperbaric chamber',         value: 'Kuakini · 22 mi' },
  { label: 'DAN insurance hotline',      value: '1-919-684-9111' },
  { label: 'Marine mammal hotline',      value: '888-256-9840' },
];

// 14-day jellyfish risk forecast based on the lunar cycle around April 15.
// Full moon = day 0 of risk window opening; risk peaks days 8-10.
const JELLY_FORECAST: Array<{ day: string; risk: RiskLevel }> = [
  { day: 'TUE 4/15', risk: 'low' },
  { day: 'WED 4/16', risk: 'low' },
  { day: 'THU 4/17', risk: 'low' },
  { day: 'FRI 4/18', risk: 'moderate' },
  { day: 'SAT 4/19', risk: 'high' },
  { day: 'SUN 4/20', risk: 'high' },
  { day: 'MON 4/21', risk: 'high' },
  { day: 'TUE 4/22', risk: 'moderate' },
  { day: 'WED 4/23', risk: 'low' },
  { day: 'THU 4/24', risk: 'low' },
  { day: 'FRI 4/25', risk: 'low' },
  { day: 'SAT 4/26', risk: 'low' },
  { day: 'SUN 4/27', risk: 'low' },
  { day: 'MON 4/28', risk: 'low' },
];

function HazardsTabBody() {
  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <TodaysRiskCard />

        <InfoSection title="Active alerts" subtitle="Time-sensitive warnings for this spot">
          {ACTIVE_ALERTS.map((a, i) => (
            <View
              key={i}
              style={[
                styles.alertItem,
                i < ACTIVE_ALERTS.length - 1 && styles.alertItemDivider,
              ]}
            >
              <View style={styles.alertItemHeader}>
                <RiskPill level={a.level} />
                <Text style={styles.alertItemTitle}>{a.title}</Text>
              </View>
              <Text style={styles.alertItemBody}>{a.body}</Text>
              <View style={styles.alertItemMeta}>
                <Text style={styles.alertItemMetaText}>{a.issued}</Text>
                <Text style={styles.alertItemMetaDot}>·</Text>
                <Text style={styles.alertItemMetaText}>{a.source}</Text>
              </View>
            </View>
          ))}
        </InfoSection>

        <InfoSection title="Standing hazards" subtitle="Always present at this spot">
          {STANDING_HAZARDS.map((h, i) => (
            <View
              key={h.title}
              style={[
                styles.standingRow,
                i < STANDING_HAZARDS.length - 1 && styles.standingRowDivider,
              ]}
            >
              <View style={styles.standingIconWrap}>
                <Text style={styles.standingIconText}>{h.icon}</Text>
              </View>
              <View style={styles.standingTextWrap}>
                <View style={styles.standingTitleRow}>
                  <Text style={styles.standingTitle}>{h.title}</Text>
                  <RiskPill level={h.severity} />
                </View>
                <Text style={styles.standingDetail}>{h.detail}</Text>
              </View>
            </View>
          ))}
        </InfoSection>

        <InfoSection title="Marine life cautions">
          {MARINE_CAUTIONS.map((m, i) => (
            <View
              key={m.name}
              style={[
                styles.cautionRow,
                i < MARINE_CAUTIONS.length - 1 && styles.cautionRowDivider,
              ]}
            >
              <Text style={styles.cautionEmoji}>{m.emoji}</Text>
              <View style={styles.cautionTextWrap}>
                <View style={styles.cautionTitleRow}>
                  <Text style={styles.cautionName}>{m.name}</Text>
                  <RiskPill level={m.severity} />
                </View>
                <Text style={styles.cautionRule}>{m.rule}</Text>
              </View>
            </View>
          ))}
        </InfoSection>

        <InfoSection title="Recent incidents" subtitle="Community-reported · last 30 days">
          {RECENT_INCIDENTS.map((r, i) => (
            <View
              key={i}
              style={[
                styles.incidentRow,
                i < RECENT_INCIDENTS.length - 1 && styles.incidentRowDivider,
              ]}
            >
              <Text style={styles.incidentDate}>{r.when}</Text>
              <RiskPill level={r.severity} />
              <Text style={styles.incidentBody}>{r.body}</Text>
            </View>
          ))}
        </InfoSection>
      </View>

      <View style={styles.mainRight}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Emergency contacts</Text>
            <Text style={styles.cardHeaderMono}>SAVE BEFORE YOU DIVE</Text>
          </View>
          {EMERGENCY_CONTACTS.map((c, i) => (
            <View
              key={c.label}
              style={[
                styles.contactRow,
                i < EMERGENCY_CONTACTS.length - 1 && styles.contactRowDivider,
              ]}
            >
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={[styles.contactValue, c.primary && styles.contactValuePrimary]}>
                {c.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Jellyfish 14-day</Text>
            <Text style={styles.cardHeaderMono}>LUNAR CYCLE MODEL</Text>
          </View>
          <View style={styles.jellyBody}>
            {JELLY_FORECAST.map((d, i) => (
              <View key={i} style={styles.jellyRow}>
                <Text style={styles.jellyDay}>{d.day}</Text>
                <View style={styles.jellyTrack}>
                  <View
                    style={[
                      styles.jellyFill,
                      {
                        backgroundColor: RISK_TONES[d.risk].color,
                        width:
                          d.risk === 'low'      ? '15%' :
                          d.risk === 'moderate' ? '45%' :
                          d.risk === 'high'     ? '80%' : '100%',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.jellyLevel, { color: RISK_TONES[d.risk].color }]}>
                  {RISK_TONES[d.risk].label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Closest evacuation</Text>
          </View>
          <View style={styles.evacBody}>
            <Text style={styles.evacRouteTitle}>Kahe Point Beach Park exit</Text>
            <Text style={styles.evacRouteBody}>
              Drive south on Farrington Hwy (93) toward Honolulu. Pali Momi Medical Center is 7 mi (12 min in normal traffic) at the Ko Olina exit.
            </Text>
            <View style={styles.evacFactRow}>
              <View style={styles.evacFact}>
                <Text style={styles.evacFactValue}>7</Text>
                <Text style={styles.evacFactUnit}>MI TO ER</Text>
              </View>
              <View style={styles.evacFactDivider} />
              <View style={styles.evacFact}>
                <Text style={styles.evacFactValue}>12</Text>
                <Text style={styles.evacFactUnit}>MIN DRIVE</Text>
              </View>
              <View style={styles.evacFactDivider} />
              <View style={styles.evacFact}>
                <Text style={styles.evacFactValue}>22</Text>
                <Text style={styles.evacFactUnit}>MI TO CHAMBER</Text>
              </View>
            </View>
          </View>
        </View>

        <ProCTACard />
      </View>
    </View>
  );
}

function TodaysRiskCard() {
  const tone = RISK_TONES[TODAYS_RISK.level];
  return (
    <View
      style={[
        styles.todaysRiskCard,
        { borderColor: hexAlpha(tone.color, 0.35), backgroundColor: hexAlpha(tone.color, 0.06) },
      ]}
    >
      <View style={styles.todaysRiskHeader}>
        <View style={[styles.todaysRiskDot, { backgroundColor: tone.color }]} />
        <Text style={styles.todaysRiskLabel}>TODAY'S RISK</Text>
        <View style={[styles.todaysRiskPill, { backgroundColor: hexAlpha(tone.color, 0.18) }]}>
          <Text style={[styles.todaysRiskPillText, { color: tone.color }]}>{tone.label}</Text>
        </View>
      </View>
      <Text style={styles.todaysRiskHeadline}>{TODAYS_RISK.headline}</Text>
      <Text style={styles.todaysRiskBody}>{TODAYS_RISK.body}</Text>
    </View>
  );
}

function RiskPill({ level }: { level: RiskLevel }) {
  const tone = RISK_TONES[level];
  return (
    <View
      style={[
        styles.riskPill,
        { borderColor: hexAlpha(tone.color, 0.35), backgroundColor: hexAlpha(tone.color, 0.10) },
      ]}
    >
      <View style={[styles.riskPillDot, { backgroundColor: tone.color }]} />
      <Text style={[styles.riskPillText, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Reports tab body ────────────────────────────────────────────────────

const COMMUNITY_REPORTS: DiveReportCardProps[] = [
  {
    author: 'Kai M.', authorInitials: 'KM', whenAgo: '2H AGO',
    date: 'Apr 15, 2024', time: '12:14 PM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🤿 Scuba', rating: 'excellent',
    depthFt: 42, durationMin: 48, vizFt: 60, waterTempF: 79, airTempF: 82,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
    wildlife: ['Green Turtle', 'Spinner Dolphin', 'Eagle Ray'],
    notes:
      'Spinner pod circled the dive boat for 20 min before we even got in the water. Once down, vis was clean to 60ft and the pipes were swarming with life. Turtle cleaning station active near the southern pipe.',
    photoCount: 8, stars: 5, recommend: 'Definitely', showSpot: false,
  },
  {
    author: 'Leilani S.', authorInitials: 'LS', whenAgo: 'YESTERDAY',
    date: 'Apr 14, 2024', time: '7:30 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🧜 Freediving', rating: 'great',
    depthFt: 38, durationMin: 65, vizFt: 55, waterTempF: 78,
    conditions: { current: 'None', surface: 'Calm', surge: 'Mild' },
    wildlife: ['Reef Fish', 'Whitetip Reef Shark'],
    notes:
      'Glass-off dawn session. Got down to 38ft on a comfortable hangout, watched a whitetip cruise the deeper rubble. Mellow current today, easy back to shore.',
    photoCount: 4, stars: 5, recommend: 'Definitely', showSpot: false,
  },
  {
    author: 'Marcus H.', authorInitials: 'MH', whenAgo: 'YESTERDAY',
    date: 'Apr 14, 2024', time: '4:45 PM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🎣 Spearfishing', rating: 'good',
    depthFt: 32, durationMin: 70, vizFt: 45, waterTempF: 79,
    conditions: { current: 'Moderate', surface: 'Light chop', surge: 'Mild' },
    wildlife: ['Reef Fish'],
    notes:
      'Afternoon trades picked up — vis dropped to about 40ft in the shallows but stayed cleaner deeper. Got one nice ulua near the southern shelf. Current was real on the swim back.',
    photoCount: 2, stars: 4, recommend: 'Yes', showSpot: false,
  },
  {
    author: 'Alana T.', authorInitials: 'AT', whenAgo: '2D AGO',
    date: 'Apr 13, 2024', time: '8:15 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🤿 Scuba', rating: 'great',
    depthFt: 45, durationMin: 52, vizFt: 50, waterTempF: 78, airTempF: 80,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
    wildlife: ['Green Turtle', 'Eagle Ray', 'Reef Fish'],
    notes:
      'Beautiful morning dive. Two eagle rays cruised through during the safety stop. The pipes are looking like the wildlife is back to normal after last week\'s outflow shutdown.',
    photoCount: 6, stars: 5, recommend: 'Definitely', showSpot: false,
  },
  {
    author: 'Ryan P.', authorInitials: 'RP', whenAgo: '3D AGO',
    date: 'Apr 12, 2024', time: '6:00 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🧜 Freediving', rating: 'excellent',
    depthFt: 50, durationMin: 75, vizFt: 65, waterTempF: 78,
    conditions: { current: 'None', surface: 'Calm', surge: 'None' },
    wildlife: ['Spinner Dolphin', 'Reef Fish', 'Octopus'],
    notes:
      'Personal best on a freedive here — 50ft on a 2:10 hold. Spinner pod stuck around for the whole session. The viz cleaned up to 65ft after the morning sun hit the bottom.',
    photoCount: 11, stars: 5, recommend: 'Definitely', showSpot: false,
  },
  {
    author: 'Jordan K.', authorInitials: 'JK', whenAgo: '4D AGO',
    date: 'Apr 11, 2024', time: '2:00 PM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🐠 Snorkel', rating: 'good',
    depthFt: 15, durationMin: 90, vizFt: 35, waterTempF: 79,
    conditions: { current: 'Mild', surface: 'Light chop', surge: 'Mild' },
    wildlife: ['Green Turtle', 'Reef Fish', 'Pufferfish'],
    notes:
      'Brought the in-laws out for a chill snorkel. Turtle popped up next to us and totally chilled out. Easy day, good for introducing newer folks.',
    photoCount: 3, stars: 4, recommend: 'Yes', showSpot: false,
  },
  {
    author: 'Sam W.', authorInitials: 'SW', whenAgo: '5D AGO',
    date: 'Apr 10, 2024', time: '7:00 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🤿 Scuba', rating: 'fair',
    depthFt: 35, durationMin: 38, vizFt: 25, waterTempF: 77,
    conditions: { current: 'Moderate', surface: 'Choppy', surge: 'Moderate' },
    wildlife: ['Reef Fish'],
    notes:
      'NW swell wrapped in and crashed vis. Brown water at the entry from yesterday\'s rain. Bailed early at 38min. Wait a day or two after rain.',
    photoCount: 0, stars: 2, recommend: 'With caveats', showSpot: false,
  },
  {
    author: 'Nina O.', authorInitials: 'NO', whenAgo: '6D AGO',
    date: 'Apr 9, 2024', time: '9:30 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🤿 Scuba', rating: 'excellent',
    depthFt: 44, durationMin: 55, vizFt: 70, waterTempF: 78, airTempF: 81,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'None' },
    wildlife: ['Spinner Dolphin', 'Green Turtle', 'Eagle Ray', 'Whitetip Reef Shark'],
    notes:
      'One of the best dives I have done here in years. Viz absolutely cracking, calm everything, full house of wildlife. Worth the early call.',
    photoCount: 14, stars: 5, recommend: 'Definitely', showSpot: false,
  },
  {
    author: 'Tina B.', authorInitials: 'TB', whenAgo: 'A WEEK AGO',
    date: 'Apr 8, 2024', time: '11:00 AM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🧜 Freediving', rating: 'great',
    depthFt: 40, durationMin: 80, vizFt: 50, waterTempF: 78,
    conditions: { current: 'None', surface: 'Calm', surge: 'Mild' },
    wildlife: ['Reef Fish', 'Octopus', 'Eagle Ray'],
    notes:
      'Octopus changed colors as I approached, then darted into a cave. Watched eagle rays glide across the sand at 35ft. Best mid-day session in months.',
    photoCount: 5, stars: 5, recommend: 'Definitely', showSpot: false,
  },
  {
    author: 'Devin C.', authorInitials: 'DC', whenAgo: 'A WEEK AGO',
    date: 'Apr 7, 2024', time: '5:00 PM',
    spot: 'Electric Beach', region: "O'AHU · LEEWARD COAST",
    diveType: '🎣 Spearfishing', rating: 'good',
    depthFt: 28, durationMin: 60, vizFt: 40, waterTempF: 79,
    conditions: { current: 'Mild', surface: 'Calm', surge: 'Mild' },
    wildlife: ['Reef Fish'],
    notes:
      'Sunset spear session. Quiet conditions, mostly schooling fish at the shallow shelf. Took one omilu for dinner. Beautiful light through the water as the sun dropped.',
    photoCount: 1, stars: 4, recommend: 'Yes', showSpot: false,
  },
];

const TOP_CONTRIBUTORS = [
  { name: 'Kai M.',     initials: 'KM', dives: 32, badge: 'Local expert' },
  { name: 'Leilani S.', initials: 'LS', dives: 28, badge: 'Freediver' },
  { name: 'Marcus H.',  initials: 'MH', dives: 24, badge: 'Spearo' },
  { name: 'Alana T.',   initials: 'AT', dives: 19, badge: 'Divemaster' },
  { name: 'Ryan P.',    initials: 'RP', dives: 17 },
];

const CONDITIONS_SUMMARY = {
  visAvg: 52,
  visRange: '25–80',
  topRating: 'great' as ConditionTier,
  reportCount: 47,
  // Last 14 days tier distribution for the bar chart
  history: [
    'excellent', 'great', 'good', 'great', 'good', 'fair', 'good',
    'great', 'excellent', 'excellent', 'great', 'fair', 'good', 'great',
  ] as ConditionTier[],
};

function ReportsTabBody({ onNavigate }: { onNavigate?: NavigateFn }) {
  type Filter = 'All' | 'Scuba' | 'Freediving' | 'Spearfishing' | 'Snorkel';
  type Sort = 'recent' | 'top' | 'deepest';
  const [filter, setFilter] = React.useState<Filter>('All');
  const [sort, setSort] = React.useState<Sort>('recent');

  const filtered = React.useMemo(() => {
    let list = filter === 'All'
      ? COMMUNITY_REPORTS
      : COMMUNITY_REPORTS.filter((r) => r.diveType.toLowerCase().includes(filter.toLowerCase()));
    if (sort === 'top') {
      list = [...list].sort((a, b) => b.stars - a.stars);
    } else if (sort === 'deepest') {
      list = [...list].sort((a, b) => b.depthFt - a.depthFt);
    }
    return list;
  }, [filter, sort]);

  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <View style={styles.reportsHeader}>
          <View style={styles.reportsHeaderLeft}>
            <Text style={styles.reportsHeaderTitle}>Community reports</Text>
            <Text style={styles.reportsHeaderSub}>
              {COMMUNITY_REPORTS.length} reports in the last 30 days · 8 unique divers
            </Text>
          </View>
          <Pressable
            style={styles.reportsHeaderBtn}
            onPress={() => onNavigate?.('log-dive')}
          >
            <Text style={styles.reportsHeaderBtnText}>+ Post a report</Text>
          </Pressable>
        </View>

        <View style={styles.reportsFilterRow}>
          <View style={styles.reportsFilterChips}>
            {(['All', 'Scuba', 'Freediving', 'Spearfishing', 'Snorkel'] as Filter[]).map((f) => {
              const active = f === filter;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.repFilterChip, active && styles.repFilterChipActive]}
                >
                  <Text style={[styles.repFilterText, active && styles.repFilterTextActive]}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.reportsSortWrap}>
            {(['recent', 'top', 'deepest'] as Sort[]).map((s) => {
              const active = s === sort;
              return (
                <Pressable key={s} onPress={() => setSort(s)} style={styles.repSortBtn}>
                  <Text style={[styles.repSortText, active && styles.repSortTextActive]}>
                    {s === 'recent' ? 'Most recent' : s === 'top' ? 'Top rated' : 'Deepest'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.reportsList}>
          {filtered.map((r, i) => <DiveReportCard key={i} {...r} />)}
          {filtered.length === 0 ? (
            <View style={styles.reportsEmpty}>
              <Text style={styles.reportsEmptyTitle}>No reports match "{filter}"</Text>
              <Text style={styles.reportsEmptySub}>
                Try a different filter or be the first to post one.
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.mainRight}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>30-day conditions</Text>
            <Text style={styles.cardHeaderMono}>FROM REPORTS</Text>
          </View>
          <View style={styles.condSummaryBody}>
            <View style={styles.condSummaryStatRow}>
              <View style={styles.condSummaryStat}>
                <Text style={styles.condSummaryValue}>{CONDITIONS_SUMMARY.visAvg}</Text>
                <Text style={styles.condSummaryUnit}>FT AVG VIS</Text>
              </View>
              <View style={styles.condSummaryStatDivider} />
              <View style={styles.condSummaryStat}>
                <Text style={styles.condSummaryValue}>{CONDITIONS_SUMMARY.reportCount}</Text>
                <Text style={styles.condSummaryUnit}>REPORTS</Text>
              </View>
            </View>
            <Text style={styles.condSummaryRange}>Range: {CONDITIONS_SUMMARY.visRange} ft</Text>

            <Text style={styles.condSummarySectionLabel}>LAST 14 DAYS</Text>
            <View style={styles.condHistoryRow}>
              {CONDITIONS_SUMMARY.history.map((tier, i) => (
                <View
                  key={i}
                  style={[styles.condHistoryBar, { backgroundColor: TIER_COLORS[tier] }]}
                />
              ))}
            </View>
            <View style={styles.condHistoryTickRow}>
              <Text style={styles.condHistoryTick}>14d ago</Text>
              <Text style={styles.condHistoryTick}>Today</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Top contributors</Text>
            <Text style={styles.cardHeaderMono}>30 DAYS</Text>
          </View>
          {TOP_CONTRIBUTORS.map((c, i) => (
            <View
              key={c.name}
              style={[
                styles.contribRow,
                i < TOP_CONTRIBUTORS.length - 1 && styles.contribRowDivider,
              ]}
            >
              <Text style={styles.contribRank}>{i + 1}</Text>
              <View style={styles.contribAvatar}>
                <Text style={styles.contribAvatarText}>{c.initials}</Text>
              </View>
              <View style={styles.contribTextWrap}>
                <Text style={styles.contribName}>{c.name}</Text>
                {c.badge ? <Text style={styles.contribBadge}>{c.badge}</Text> : null}
              </View>
              <Text style={styles.contribDives}>{c.dives}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Photo highlights</Text>
            <Text style={styles.cardHeaderMono}>FROM REPORTS</Text>
          </View>
          <View style={styles.photoHighlightGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.photoHighlightTile}>
                <Text style={styles.photoHighlightIcon}>◇</Text>
              </View>
            ))}
          </View>
          <View style={styles.photoHighlightFooter}>
            <Text style={styles.photoHighlightCaption}>56 photos shared this month</Text>
            <Text style={styles.photoHighlightLink}>View all →</Text>
          </View>
        </View>

        <ProCTACard />
      </View>
    </View>
  );
}

// ─── Buoys tab body ──────────────────────────────────────────────────────

type BuoyStatus = 'live' | 'delayed' | 'offline';

type Buoy = {
  id: string;
  name: string;
  distMi: number;
  status: BuoyStatus;
  lastUpdated: string;       // 'NOW' | '12M AGO' | '3H AGO'
  waveHeightFt: number;
  waveHeightM: number;
  dominantPeriodS: number;
  meanPeriodS: number;
  directionDeg: number;
  directionCompass: string;
  waterTempF: number;
  waterTempC: number;
  windSpeedMph: number;
  windDirCompass: string;
  windGustMph: number;
  airPressureMb: number;
  airPressureTrend: 'rising' | 'falling' | 'steady';
};

const BUOYS_FULL: Buoy[] = [
  {
    id: '51212', name: 'Pearl Harbor Entrance',
    distMi: 8.4, status: 'live', lastUpdated: 'NOW',
    waveHeightFt: 3.1, waveHeightM: 0.95,
    dominantPeriodS: 9.4, meanPeriodS: 7.8,
    directionDeg: 295, directionCompass: 'WNW',
    waterTempF: 78.4, waterTempC: 25.8,
    windSpeedMph: 8, windDirCompass: 'NE', windGustMph: 12,
    airPressureMb: 1018.2, airPressureTrend: 'steady',
  },
  {
    id: '51201', name: 'Waimea Bay',
    distMi: 21.6, status: 'live', lastUpdated: '12M AGO',
    waveHeightFt: 3.4, waveHeightM: 1.04,
    dominantPeriodS: 10.1, meanPeriodS: 8.3,
    directionDeg: 305, directionCompass: 'WNW',
    waterTempF: 77.9, waterTempC: 25.5,
    windSpeedMph: 11, windDirCompass: 'NE', windGustMph: 17,
    airPressureMb: 1017.8, airPressureTrend: 'falling',
  },
  {
    id: '51001', name: 'NW Hawaii (Lihue)',
    distMi: 27.2, status: 'live', lastUpdated: '24M AGO',
    waveHeightFt: 4.2, waveHeightM: 1.28,
    dominantPeriodS: 11.6, meanPeriodS: 9.1,
    directionDeg: 300, directionCompass: 'WNW',
    waterTempF: 76.8, waterTempC: 24.9,
    windSpeedMph: 14, windDirCompass: 'NE', windGustMph: 22,
    airPressureMb: 1017.2, airPressureTrend: 'falling',
  },
  {
    id: '51002', name: 'SW Hawaii',
    distMi: 38.1, status: 'delayed', lastUpdated: '3H AGO',
    waveHeightFt: 3.8, waveHeightM: 1.16,
    dominantPeriodS: 12.4, meanPeriodS: 9.6,
    directionDeg: 290, directionCompass: 'WNW',
    waterTempF: 77.2, waterTempC: 25.1,
    windSpeedMph: 9, windDirCompass: 'ENE', windGustMph: 13,
    airPressureMb: 1018.0, airPressureTrend: 'steady',
  },
];

// 24-hour wave height series (ft) for the primary buoy
const PRIMARY_WAVE_HISTORY = [
  2.7, 2.8, 2.9, 2.9, 3.0, 3.1, 3.0, 3.0,
  2.9, 2.8, 2.8, 2.9, 2.9, 3.0, 3.0, 3.1,
  3.2, 3.2, 3.1, 3.1, 3.0, 3.0, 3.1, 3.1,
];

// Wave-energy spectrum bands (energy in m²/Hz, simplified)
const WAVE_SPECTRUM = [
  { period: '4s',  energy: 0.04, band: 'wind' as const },
  { period: '5s',  energy: 0.08, band: 'wind' as const },
  { period: '6s',  energy: 0.12, band: 'wind' as const },
  { period: '7s',  energy: 0.18, band: 'mid' as const },
  { period: '8s',  energy: 0.32, band: 'mid' as const },
  { period: '9s',  energy: 0.58, band: 'mid' as const },
  { period: '10s', energy: 0.71, band: 'ground' as const },
  { period: '11s', energy: 0.46, band: 'ground' as const },
  { period: '12s', energy: 0.28, band: 'ground' as const },
  { period: '14s', energy: 0.14, band: 'ground' as const },
  { period: '16s', energy: 0.06, band: 'ground' as const },
  { period: '18s+', energy: 0.02, band: 'ground' as const },
];

const SPECTRUM_BAND_COLORS = {
  wind:   colors.fair,
  mid:    colors.good,
  ground: colors.accent,
};

const WIND_HISTORY = [
  6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12,
  11, 10, 9, 9, 8, 8, 8, 9, 9, 9, 10, 10,
];

const PRESSURE_HISTORY = [
  1019.1, 1019.0, 1019.0, 1018.9, 1018.8, 1018.7, 1018.6, 1018.5,
  1018.4, 1018.3, 1018.3, 1018.2, 1018.2, 1018.2, 1018.1, 1018.2,
  1018.2, 1018.2, 1018.3, 1018.3, 1018.2, 1018.2, 1018.2, 1018.2,
];

function BuoysTabBody() {
  const primary = BUOYS_FULL[0];
  const others = BUOYS_FULL.slice(1);

  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <View style={styles.buoysHeader}>
          <View style={styles.buoysHeaderLeft}>
            <Text style={styles.buoysHeaderTitle}>NDBC buoys near Electric Beach</Text>
            <Text style={styles.buoysHeaderSub}>
              4 stations within 40 mi · 3 live · 1 delayed · updated every 30 min
            </Text>
          </View>
          <View style={styles.buoysHeaderLegend}>
            <View style={styles.buoysLegendItem}>
              <View style={[styles.buoysLegendDot, { backgroundColor: colors.great }]} />
              <Text style={styles.buoysLegendText}>LIVE</Text>
            </View>
            <View style={styles.buoysLegendItem}>
              <View style={[styles.buoysLegendDot, { backgroundColor: colors.good }]} />
              <Text style={styles.buoysLegendText}>DELAYED</Text>
            </View>
            <View style={styles.buoysLegendItem}>
              <View style={[styles.buoysLegendDot, { backgroundColor: colors.text4 }]} />
              <Text style={styles.buoysLegendText}>OFFLINE</Text>
            </View>
          </View>
        </View>

        <PrimaryBuoyCard buoy={primary} />

        <SpectrumCard />

        <WaveHistoryCard />

        <View style={styles.otherBuoysSection}>
          <View style={styles.otherBuoysHeader}>
            <Text style={styles.otherBuoysTitle}>Other nearby buoys</Text>
            <Text style={styles.otherBuoysCount}>{others.length} stations</Text>
          </View>
          <View style={styles.otherBuoysList}>
            {others.map((b) => <OtherBuoyRow key={b.id} buoy={b} />)}
          </View>
        </View>
      </View>

      <View style={styles.mainRight}>
        <BuoyStatusSummary />
        <WindHistoryCard />
        <PressureCard />
        <BuoySourcesCard />
      </View>
    </View>
  );
}

function PrimaryBuoyCard({ buoy }: { buoy: Buoy }) {
  return (
    <View style={[styles.card, styles.primaryBuoyCard]}>
      <View style={styles.primaryBuoyHeader}>
        <View style={styles.primaryBuoyTitleWrap}>
          <View style={styles.primaryBuoyTitleRow}>
            <Text style={styles.primaryBuoyId}>{buoy.id}</Text>
            <Text style={styles.primaryBuoyName}>{buoy.name}</Text>
          </View>
          <Text style={styles.primaryBuoyDist}>{buoy.distMi} MI · 21.30°N, 157.97°W</Text>
        </View>
        <View style={styles.primaryBuoyStatusWrap}>
          <View style={[styles.primaryBuoyStatusDot, { backgroundColor: colors.great }]} />
          <Text style={[styles.primaryBuoyStatusText, { color: colors.great }]}>{buoy.status.toUpperCase()}</Text>
          <Text style={styles.primaryBuoyUpdated}>{buoy.lastUpdated}</Text>
        </View>
      </View>

      <View style={styles.primaryBuoyMetricsGrid}>
        <BuoyMetricCell label="Wave height" primaryValue={String(buoy.waveHeightFt)} primaryUnit="FT" secondary={`${buoy.waveHeightM} m`} accent />
        <BuoyMetricCell label="Dominant period" primaryValue={String(buoy.dominantPeriodS)} primaryUnit="S" secondary={`Mean ${buoy.meanPeriodS}s`} />
        <BuoyMetricCell label="Direction" primaryValue={`${buoy.directionDeg}°`} primaryUnit="" secondary={buoy.directionCompass} />

        <BuoyMetricCell label="Water temp" primaryValue={String(buoy.waterTempF)} primaryUnit="°F" secondary={`${buoy.waterTempC} °C`} />
        <BuoyMetricCell label="Wind" primaryValue={String(buoy.windSpeedMph)} primaryUnit="MPH" secondary={`${buoy.windDirCompass} · ${buoy.windGustMph} gust`} />
        <BuoyMetricCell label="Air pressure" primaryValue={String(buoy.airPressureMb)} primaryUnit="MB" secondary={pressureTrendLabel(buoy.airPressureTrend)} />
      </View>
    </View>
  );
}

function pressureTrendLabel(t: Buoy['airPressureTrend']): string {
  if (t === 'rising') return '↑ Rising';
  if (t === 'falling') return '↓ Falling';
  return '— Steady';
}

function BuoyMetricCell({
  label,
  primaryValue,
  primaryUnit,
  secondary,
  accent,
}: {
  label: string;
  primaryValue: string;
  primaryUnit: string;
  secondary: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.buoyMetricCell}>
      <Text style={styles.buoyMetricLabel}>{label.toUpperCase()}</Text>
      <View style={styles.buoyMetricValueRow}>
        <Text style={[styles.buoyMetricValue, accent && styles.buoyMetricValueAccent]}>{primaryValue}</Text>
        {primaryUnit ? <Text style={styles.buoyMetricUnit}>{primaryUnit}</Text> : null}
      </View>
      <Text style={styles.buoyMetricSecondary}>{secondary}</Text>
    </View>
  );
}

function SpectrumCard() {
  const max = Math.max(...WAVE_SPECTRUM.map((b) => b.energy));
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Wave energy spectrum · primary buoy</Text>
        <Text style={styles.cardHeaderMono}>m² / Hz · LIVE</Text>
      </View>
      <View style={styles.spectrumBody}>
        <View style={styles.spectrumBars}>
          {WAVE_SPECTRUM.map((b) => (
            <View key={b.period} style={styles.spectrumBarCol}>
              <View
                style={[
                  styles.spectrumBar,
                  {
                    height: `${(b.energy / max) * 100}%`,
                    backgroundColor: SPECTRUM_BAND_COLORS[b.band],
                  },
                ]}
              />
              <Text style={styles.spectrumPeriod}>{b.period}</Text>
            </View>
          ))}
        </View>
        <View style={styles.spectrumLegend}>
          <View style={styles.spectrumLegendItem}>
            <View style={[styles.spectrumLegendSwatch, { backgroundColor: SPECTRUM_BAND_COLORS.wind }]} />
            <Text style={styles.spectrumLegendText}>WIND CHOP &lt; 7s</Text>
          </View>
          <View style={styles.spectrumLegendItem}>
            <View style={[styles.spectrumLegendSwatch, { backgroundColor: SPECTRUM_BAND_COLORS.mid }]} />
            <Text style={styles.spectrumLegendText}>MID 7–10s</Text>
          </View>
          <View style={styles.spectrumLegendItem}>
            <View style={[styles.spectrumLegendSwatch, { backgroundColor: SPECTRUM_BAND_COLORS.ground }]} />
            <Text style={styles.spectrumLegendText}>GROUNDSWELL ≥ 10s</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.spectrumPeakNote}>Peak at 10s · 71% energy in groundswell band</Text>
        </View>
      </View>
    </View>
  );
}

function WaveHistoryCard() {
  const max = Math.max(...PRIMARY_WAVE_HISTORY);
  const min = Math.min(...PRIMARY_WAVE_HISTORY);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>24h wave height · {BUOYS_FULL[0].id}</Text>
        <Text style={styles.cardHeaderMono}>FT · TRENDING UP</Text>
      </View>
      <View style={styles.waveHistoryBody}>
        <View style={styles.waveHistoryStats}>
          <View style={styles.waveHistoryStat}>
            <Text style={styles.waveHistoryStatValue}>{max.toFixed(1)}</Text>
            <Text style={styles.waveHistoryStatLabel}>24H HIGH</Text>
          </View>
          <View style={styles.waveHistoryStat}>
            <Text style={styles.waveHistoryStatValue}>{min.toFixed(1)}</Text>
            <Text style={styles.waveHistoryStatLabel}>24H LOW</Text>
          </View>
          <View style={styles.waveHistoryStat}>
            <Text style={styles.waveHistoryStatValue}>{PRIMARY_WAVE_HISTORY[PRIMARY_WAVE_HISTORY.length - 1].toFixed(1)}</Text>
            <Text style={styles.waveHistoryStatLabel}>NOW</Text>
          </View>
          <View style={styles.waveHistoryStat}>
            <Text style={[styles.waveHistoryStatValue, { color: colors.great }]}>+0.4</Text>
            <Text style={styles.waveHistoryStatLabel}>24H Δ</Text>
          </View>
        </View>
        <View style={styles.waveHistoryChart}>
          {PRIMARY_WAVE_HISTORY.map((h, i) => {
            const pct = ((h - 2) / (max - 2 + 0.1)) * 100;
            return (
              <View key={i} style={styles.waveHistoryBarCol}>
                <View style={[styles.waveHistoryBar, { height: `${Math.max(8, pct)}%` }]} />
              </View>
            );
          })}
        </View>
        <View style={styles.waveHistoryTickRow}>
          {['24h', '18h', '12h', '6h', 'now'].map((t) => (
            <Text key={t} style={styles.waveHistoryTick}>{t}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function OtherBuoyRow({ buoy }: { buoy: Buoy }) {
  const statusTone = buoy.status === 'live' ? colors.great : buoy.status === 'delayed' ? colors.good : colors.text4;
  return (
    <View style={styles.otherBuoyRow}>
      <View style={styles.otherBuoyHeader}>
        <Text style={styles.otherBuoyId}>{buoy.id}</Text>
        <Text style={styles.otherBuoyName}>{buoy.name}</Text>
        <View style={styles.otherBuoyStatusWrap}>
          <View style={[styles.otherBuoyStatusDot, { backgroundColor: statusTone }]} />
          <Text style={[styles.otherBuoyStatusText, { color: statusTone }]}>{buoy.status.toUpperCase()}</Text>
        </View>
        <Text style={styles.otherBuoyUpdated}>{buoy.lastUpdated}</Text>
        <Text style={styles.otherBuoyDist}>{buoy.distMi} MI</Text>
      </View>
      <View style={styles.otherBuoyMetricsRow}>
        <OtherMetric label="Wave"   value={`${buoy.waveHeightFt} ft`} />
        <OtherMetric label="Period" value={`${buoy.dominantPeriodS}s`} />
        <OtherMetric label="Dir"    value={`${buoy.directionDeg}° ${buoy.directionCompass}`} />
        <OtherMetric label="Water"  value={`${buoy.waterTempF}°F`} />
        <OtherMetric label="Wind"   value={`${buoy.windSpeedMph} ${buoy.windDirCompass}`} />
        <OtherMetric label="Pressure" value={`${buoy.airPressureMb} mb`} />
      </View>
    </View>
  );
}

function OtherMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.otherMetric}>
      <Text style={styles.otherMetricLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.otherMetricValue}>{value}</Text>
    </View>
  );
}

function BuoyStatusSummary() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Buoy fleet status</Text>
      </View>
      <View style={styles.statusBody}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.great }]} />
          <Text style={styles.statusLabel}>Live</Text>
          <Text style={styles.statusCount}>3</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.good }]} />
          <Text style={styles.statusLabel}>Delayed</Text>
          <Text style={styles.statusCount}>1</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: colors.text4 }]} />
          <Text style={styles.statusLabel}>Offline</Text>
          <Text style={styles.statusCount}>0</Text>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusFootnote}>
          <Text style={styles.statusFootnoteText}>NDBC stations within 40 mi</Text>
          <Text style={styles.statusFootnoteText}>Refreshed every 30 min</Text>
        </View>
      </View>
    </View>
  );
}

function WindHistoryCard() {
  const max = Math.max(...WIND_HISTORY);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Wind · 24h</Text>
        <Text style={styles.cardHeaderMono}>MPH</Text>
      </View>
      <View style={styles.miniChartBody}>
        <View style={styles.miniChartRow}>
          {WIND_HISTORY.map((w, i) => (
            <View key={i} style={styles.miniChartCol}>
              <View
                style={[styles.miniChartBar, { height: `${(w / max) * 100}%`, backgroundColor: colors.accent }]}
              />
            </View>
          ))}
        </View>
        <View style={styles.miniChartFootRow}>
          <Text style={styles.miniChartStat}>NOW <Text style={styles.miniChartStatValue}>10 MPH NE</Text></Text>
          <Text style={styles.miniChartStat}>HIGH <Text style={styles.miniChartStatValue}>{max} MPH</Text></Text>
        </View>
      </View>
    </View>
  );
}

function PressureCard() {
  const max = Math.max(...PRESSURE_HISTORY);
  const min = Math.min(...PRESSURE_HISTORY);
  const range = max - min + 0.001;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Air pressure · 24h</Text>
        <Text style={styles.cardHeaderMono}>MB</Text>
      </View>
      <View style={styles.miniChartBody}>
        <View style={styles.miniChartRow}>
          {PRESSURE_HISTORY.map((p, i) => {
            const pct = ((p - min) / range) * 100;
            return (
              <View key={i} style={styles.miniChartCol}>
                <View
                  style={[
                    styles.miniChartBar,
                    {
                      height: `${Math.max(10, pct)}%`,
                      backgroundColor: pct > 50 ? colors.great : colors.fair,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.miniChartFootRow}>
          <Text style={styles.miniChartStat}>NOW <Text style={styles.miniChartStatValue}>1018.2 MB</Text></Text>
          <Text style={styles.miniChartStat}>24H Δ <Text style={[styles.miniChartStatValue, { color: colors.fair }]}>−0.9</Text></Text>
        </View>
      </View>
    </View>
  );
}

// ─── Photos tab body ─────────────────────────────────────────────────────

type Photo = {
  id: string;
  author: string;
  authorInitials: string;
  whenAgo: string;
  diveType: '🤿 Scuba' | '🧜 Freediving' | '🎣 Spearfishing' | '🐠 Snorkel';
  caption: string;
  depthFt: number;
  // Stylized tint so each placeholder reads as a different "photo"
  tintFrom: string;
  tintTo: string;
  /** Roughly portrait, square, or landscape — drives row span in the grid. */
  shape: 'square' | 'portrait' | 'landscape';
  liked?: boolean;
  likeCount: number;
};

const PHOTO_TINTS: Array<[string, string]> = [
  ['#0a3a4d', '#04111e'],
  ['#0b5a6f', '#082030'],
  ['#1a3850', '#04111e'],
  ['#0e4a52', '#062028'],
  ['#072438', '#020a14'],
  ['#0d4860', '#031624'],
  ['#1c3a48', '#04141e'],
  ['#1a4860', '#062028'],
];

function tintFor(i: number) { return PHOTO_TINTS[i % PHOTO_TINTS.length]; }

const PHOTOS: Photo[] = [
  { id: 'p01', author: 'Kai M.',      authorInitials: 'KM', whenAgo: '2H AGO',     diveType: '🤿 Scuba',        caption: 'Spinner pod cruising at 30ft',                depthFt: 30, ...tintAt(0), shape: 'landscape', liked: true,  likeCount: 47 },
  { id: 'p02', author: 'Ryan P.',     authorInitials: 'RP', whenAgo: '3D AGO',     diveType: '🧜 Freediving',   caption: '50ft PB freedive — looking up at the surface', depthFt: 50, ...tintAt(1), shape: 'portrait',                likeCount: 89 },
  { id: 'p03', author: 'Nina O.',     authorInitials: 'NO', whenAgo: '6D AGO',     diveType: '🤿 Scuba',        caption: 'Eagle ray glide near the pipes',              depthFt: 38, ...tintAt(2), shape: 'square',                  likeCount: 124 },
  { id: 'p04', author: 'Leilani S.',  authorInitials: 'LS', whenAgo: 'YESTERDAY',  diveType: '🧜 Freediving',   caption: 'Whitetip resting in a lava arch',             depthFt: 35, ...tintAt(3), shape: 'landscape',               likeCount: 56 },
  { id: 'p05', author: 'Alana T.',    authorInitials: 'AT', whenAgo: '2D AGO',     diveType: '🤿 Scuba',        caption: 'Cleaning station — turtle + 6 wrasses',        depthFt: 35, ...tintAt(4), shape: 'square',                  likeCount: 73 },
  { id: 'p06', author: 'Kai M.',      authorInitials: 'KM', whenAgo: '5D AGO',     diveType: '🤿 Scuba',        caption: 'Glass-off dawn descent',                       depthFt: 12, ...tintAt(5), shape: 'portrait', liked: true,   likeCount: 38 },
  { id: 'p07', author: 'Marcus H.',   authorInitials: 'MH', whenAgo: 'A WEEK AGO', diveType: '🎣 Spearfishing', caption: 'Omilu hunting the shelf at 28ft',              depthFt: 28, ...tintAt(6), shape: 'landscape',               likeCount: 41 },
  { id: 'p08', author: 'Tina B.',     authorInitials: 'TB', whenAgo: 'A WEEK AGO', diveType: '🧜 Freediving',   caption: 'Octopus mid color-change',                     depthFt: 22, ...tintAt(7), shape: 'square',                  likeCount: 152 },
  { id: 'p09', author: 'Ryan P.',     authorInitials: 'RP', whenAgo: 'A WEEK AGO', diveType: '🧜 Freediving',   caption: 'Schooling jacks near the outflow',             depthFt: 18, ...tintAt(0), shape: 'landscape',               likeCount: 29 },
  { id: 'p10', author: 'Devin C.',    authorInitials: 'DC', whenAgo: 'A WEEK AGO', diveType: '🎣 Spearfishing', caption: 'Sunset spear — beam through the water',        depthFt: 25, ...tintAt(1), shape: 'square',                  likeCount: 67 },
  { id: 'p11', author: 'Jordan K.',   authorInitials: 'JK', whenAgo: '2W AGO',     diveType: '🐠 Snorkel',      caption: 'Turtle close pass',                            depthFt: 8,  ...tintAt(2), shape: 'portrait',                likeCount: 22 },
  { id: 'p12', author: 'Sam W.',      authorInitials: 'SW', whenAgo: '2W AGO',     diveType: '🤿 Scuba',        caption: 'Pipe interior — 35ft entry',                   depthFt: 35, ...tintAt(3), shape: 'square',                  likeCount: 18 },
  { id: 'p13', author: 'Kai M.',      authorInitials: 'KM', whenAgo: '2W AGO',     diveType: '🤿 Scuba',        caption: 'Monk seal hauled out — kept distance',         depthFt: 0,  ...tintAt(4), shape: 'landscape', liked: true,  likeCount: 211 },
  { id: 'p14', author: 'Nina O.',     authorInitials: 'NO', whenAgo: '3W AGO',     diveType: '🤿 Scuba',        caption: 'Coral bleaching check — patches at 25ft',      depthFt: 25, ...tintAt(5), shape: 'square',                  likeCount: 12 },
  { id: 'p15', author: 'Leilani S.',  authorInitials: 'LS', whenAgo: '3W AGO',     diveType: '🧜 Freediving',   caption: 'Down-time on a 1:55 hangout',                  depthFt: 28, ...tintAt(6), shape: 'portrait',                likeCount: 44 },
  { id: 'p16', author: 'Alana T.',    authorInitials: 'AT', whenAgo: '3W AGO',     diveType: '🤿 Scuba',        caption: 'Frogfish camouflaged on the rubble',           depthFt: 32, ...tintAt(7), shape: 'square',                  likeCount: 96 },
];

function tintAt(i: number) {
  const [a, b] = tintFor(i);
  return { tintFrom: a, tintTo: b };
}

const PHOTO_FILTERS = ['All', 'Featured', 'This week', 'By me', 'Scuba', 'Freediving'] as const;
const TOP_PHOTOGRAPHERS = [
  { name: 'Kai M.',     initials: 'KM', count: 28 },
  { name: 'Nina O.',    initials: 'NO', count: 22 },
  { name: 'Leilani S.', initials: 'LS', count: 18 },
  { name: 'Ryan P.',    initials: 'RP', count: 15 },
  { name: 'Alana T.',   initials: 'AT', count: 11 },
];

function PhotosTabBody({ onNavigate }: { onNavigate?: NavigateFn }) {
  const [filter, setFilter] = React.useState<(typeof PHOTO_FILTERS)[number]>('All');

  const filtered = React.useMemo(() => {
    if (filter === 'All' || filter === 'Featured') return PHOTOS;
    if (filter === 'This week') return PHOTOS.slice(0, 6);
    if (filter === 'By me') return PHOTOS.filter((p) => p.author === 'Kai M.');
    return PHOTOS.filter((p) => p.diveType.toLowerCase().includes(filter.toLowerCase()));
  }, [filter]);

  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <View style={styles.photosHeader}>
          <View style={styles.photosHeaderLeft}>
            <Text style={styles.photosHeaderTitle}>Photos & video</Text>
            <Text style={styles.photosHeaderSub}>
              {PHOTOS.length} photos from {TOP_PHOTOGRAPHERS.length}+ divers · last 30 days
            </Text>
          </View>
          <Pressable
            style={styles.photosUploadBtn}
            onPress={() => onNavigate?.('log-dive')}
          >
            <Text style={styles.photosUploadBtnIcon}>↑</Text>
            <Text style={styles.photosUploadBtnText}>Upload</Text>
          </Pressable>
        </View>

        <View style={styles.photosFilterRow}>
          {PHOTO_FILTERS.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.photoFilterChip, active && styles.photoFilterChipActive]}
              >
                <Text style={[styles.photoFilterText, active && styles.photoFilterTextActive]}>{f}</Text>
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Text style={styles.photosSort}>Sort: Newest ▾</Text>
        </View>

        {/* Featured row — first 3 photos rendered large */}
        {filter === 'All' || filter === 'Featured' ? (
          <View style={styles.featuredRow}>
            {filtered.slice(0, 3).map((p, i) => (
              <PhotoTile key={p.id} photo={p} variant={i === 0 ? 'featured' : 'standard'} />
            ))}
          </View>
        ) : null}

        {/* Main masonry grid (5 cols) */}
        <View style={styles.photoGrid}>
          {(filter === 'All' || filter === 'Featured' ? filtered.slice(3) : filtered).map((p) => (
            <PhotoTile key={p.id} photo={p} variant="grid" />
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.photosEmpty}>
            <Text style={styles.photosEmptyTitle}>No photos match "{filter}"</Text>
            <Text style={styles.photosEmptySub}>Be the first to upload one.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mainRight}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>This week</Text>
            <Text style={styles.cardHeaderMono}>HIGHLIGHTS</Text>
          </View>
          <View style={styles.weekHighlightsBody}>
            <View style={styles.weekHighlightTile}>
              <View style={[styles.weekHighlightImage, { backgroundColor: tintFor(0)[0] }]} />
              <View style={[styles.weekHighlightOverlay, { backgroundColor: 'rgba(0,0,0,0.30)' }]} />
              <View style={styles.weekHighlightCaption}>
                <Text style={styles.weekHighlightTitle}>Spinner pod</Text>
                <Text style={styles.weekHighlightAuthor}>Kai M. · ♥ 47</Text>
              </View>
            </View>
            <View style={styles.weekHighlightStats}>
              <View style={styles.weekHighlightStat}>
                <Text style={styles.weekHighlightStatValue}>56</Text>
                <Text style={styles.weekHighlightStatLabel}>NEW PHOTOS</Text>
              </View>
              <View style={styles.weekHighlightStatDivider} />
              <View style={styles.weekHighlightStat}>
                <Text style={styles.weekHighlightStatValue}>1,247</Text>
                <Text style={styles.weekHighlightStatLabel}>LIKES</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Top photographers</Text>
            <Text style={styles.cardHeaderMono}>30 DAYS</Text>
          </View>
          {TOP_PHOTOGRAPHERS.map((p, i) => (
            <View
              key={p.name}
              style={[
                styles.topPhotographerRow,
                i < TOP_PHOTOGRAPHERS.length - 1 && styles.topPhotographerRowDivider,
              ]}
            >
              <Text style={styles.topPhotographerRank}>{i + 1}</Text>
              <View style={styles.topPhotographerAvatar}>
                <Text style={styles.topPhotographerAvatarText}>{p.initials}</Text>
              </View>
              <Text style={styles.topPhotographerName}>{p.name}</Text>
              <Text style={styles.topPhotographerCount}>{p.count}</Text>
            </View>
          ))}
        </View>

        <View style={styles.uploadCtaCard}>
          <Text style={styles.uploadCtaIcon}>📷</Text>
          <Text style={styles.uploadCtaTitle}>Share your shots</Text>
          <Text style={styles.uploadCtaBody}>
            Upload from your last dive — JPG, RAW, or MP4 up to 100MB. Auto-tagged with conditions from your log.
          </Text>
          <Pressable
            style={styles.uploadCtaBtn}
            onPress={() => onNavigate?.('log-dive')}
          >
            <Text style={styles.uploadCtaBtnText}>Upload photos</Text>
          </Pressable>
        </View>

        <ProCTACard />
      </View>
    </View>
  );
}

// ─── Conditions tab body ─────────────────────────────────────────────────

// Mirrors the layers in functions/abyss/abyss.js: satellite baseline →
// wave energy → tidal flushing → runoff → bloom → light → final.
// Values are in meters and percentages.
const VISIBILITY_LAYERS = [
  { label: 'Satellite baseline', source: 'KD490 model · noaa-coastwatch-viirs', delta: 0,    runningM: 56,   tone: 'neutral' as const, note: '70m Secchi · KD490 = 0.0242 m⁻¹' },
  { label: 'Wave / sediment',    source: 'NDBC 51212 + Open-Meteo Marine',     delta: -3,   runningM: 53,   tone: 'down'    as const, note: '3ft swell · low resuspension on lava' },
  { label: 'Tidal flushing',     source: 'NOAA tides · station 1612340',       delta: 5,    runningM: 56,   tone: 'up'      as const, note: 'Rising tide · +10% multiplier' },
  { label: 'Runoff',             source: 'OpenWeather rain rollups',           delta: 0,    runningM: 56,   tone: 'neutral' as const, note: 'No rain in 48h · plume risk 0' },
  { label: 'Bloom (chlorophyll)', source: 'NOAA CoastWatch CHL · 0.07 mg/m³',  delta: 0,    runningM: 56,   tone: 'neutral' as const, note: 'Well below 2.0 mg/m³ threshold' },
  { label: 'Solar / shadow',     source: 'Astro calc + horizon profile',       delta: -8,   runningM: 48,   tone: 'down'    as const, note: 'Sun at 38° · partial east-ridge shadow' },
  { label: 'Wind chop',          source: 'OpenWeather hourly',                 delta: -8,   runningM: 40,   tone: 'down'    as const, note: 'NE 8kt onshore · sandy substrate' },
];

const SUBSURFACE_PROFILE = [
  { depth: 0.25, temp: 25.70 },
  { depth: 1,    temp: 25.70 },
  { depth: 2,    temp: 25.70 },
  { depth: 5,    temp: 25.69 },
  { depth: 10,   temp: 25.68 },
  { depth: 20,   temp: 25.50 },
  { depth: 40,   temp: 24.10 },
  { depth: 60,   temp: 22.00 },
  { depth: 100,  temp: 18.40 },
  { depth: 150,  temp: 16.10 },
  { depth: 200,  temp: 15.10 },
];

const CONFIDENCE_BREAKDOWN = [
  { label: 'OpenWeather',          status: 'live' as const, lastUpdate: '4m ago' },
  { label: 'NDBC Buoy 51212',      status: 'live' as const, lastUpdate: 'NOW' },
  { label: 'NOAA Tides 1612340',   status: 'live' as const, lastUpdate: '7m ago' },
  { label: 'Open-Meteo Marine',    status: 'live' as const, lastUpdate: '12m ago' },
  { label: 'NOAA CoastWatch KD490', status: 'live' as const, lastUpdate: '13 days lag (normal)' },
  { label: 'PacIOOS subsurface',   status: 'live' as const, lastUpdate: '1h ago' },
];

const TREND_6H = {
  vis:   [44, 46, 47, 48, 49, 50, 50],   // ft, last 6 readings + now
  wave:  [3.0, 3.1, 3.0, 3.1, 3.2, 3.1, 3.1],
  wind:  [6, 7, 7, 8, 8, 8, 8],
  temp:  [78.9, 79.0, 79.1, 79.1, 79.2, 79.2, 79.3],
};

const BASELINE_COMPARISON = [
  { label: 'Visibility',  today: 40, baseline: 32, unit: 'ft', better: true },
  { label: 'Wave height', today: 3.1, baseline: 3.6, unit: 'ft', better: true },
  { label: 'Wind',        today: 8,  baseline: 11, unit: 'mph', better: true },
  { label: 'Water temp',  today: 79.2, baseline: 78.0, unit: '°F', better: true },
];

function ConditionsTabBody() {
  return (
    <View style={styles.mainGrid}>
      <View style={styles.mainLeft}>
        <RightNowHero />
        <VisibilityModelCard />
        <SubsurfaceCard />
        <TrendsCard />
      </View>
      <View style={styles.mainRight}>
        <DataConfidenceCard />
        <BaselineCompareCard />
        <ModelSourcesCard />
        <ProCTACard />
      </View>
    </View>
  );
}

function RightNowHero() {
  return (
    <View style={[styles.card, styles.condHeroCard]}>
      <View style={styles.condHeroLeft}>
        <Text style={styles.condHeroLabel}>RIGHT NOW · 2:47 PM HST</Text>
        <View style={styles.condHeroTitleRow}>
          <ConditionPill tier="excellent" size="md" />
          <Text style={styles.condHeroEstimate}>40<Text style={styles.condHeroEstimateUnit}>FT VIS</Text></Text>
        </View>
        <Text style={styles.condHeroBody}>
          All upstream sources live and agreeing. Visibility model running on real satellite KD490 (not heuristic fallback). 7 of 7 layers contributing — see the breakdown below.
        </Text>
      </View>
      <View style={styles.condHeroDivider} />
      <View style={styles.condHeroRight}>
        <View style={styles.condHeroStat}>
          <Text style={styles.condHeroStatValue}>0.85</Text>
          <Text style={styles.condHeroStatLabel}>CONFIDENCE</Text>
        </View>
        <View style={styles.condHeroStat}>
          <Text style={styles.condHeroStatValue}>6/6</Text>
          <Text style={styles.condHeroStatLabel}>SOURCES LIVE</Text>
        </View>
      </View>
    </View>
  );
}

function VisibilityModelCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Visibility model · how we got to 40 ft</Text>
        <Text style={styles.cardHeaderMono}>7 LAYERS</Text>
      </View>
      <View style={styles.layerCascadeBody}>
        {VISIBILITY_LAYERS.map((l, i) => (
          <View
            key={l.label}
            style={[styles.layerRow, i < VISIBILITY_LAYERS.length - 1 && styles.layerRowDivider]}
          >
            <View style={styles.layerIndex}>
              <Text style={styles.layerIndexText}>{String(i + 1).padStart(2, '0')}</Text>
            </View>
            <View style={styles.layerTextWrap}>
              <Text style={styles.layerLabel}>{l.label}</Text>
              <Text style={styles.layerSource}>{l.source}</Text>
              <Text style={styles.layerNote}>{l.note}</Text>
            </View>
            <View style={styles.layerDeltaWrap}>
              {l.delta === 0 ? (
                <Text style={[styles.layerDelta, { color: colors.text3 }]}>—</Text>
              ) : (
                <Text
                  style={[
                    styles.layerDelta,
                    { color: l.tone === 'up' ? colors.great : colors.fair },
                  ]}
                >
                  {l.delta > 0 ? '+' : ''}{l.delta} ft
                </Text>
              )}
            </View>
            <View style={styles.layerRunning}>
              <Text style={styles.layerRunningValue}>{l.runningM}</Text>
              <Text style={styles.layerRunningUnit}>FT</Text>
            </View>
          </View>
        ))}
        <View style={styles.layerFinalRow}>
          <Text style={styles.layerFinalLabel}>FINAL ESTIMATE</Text>
          <View style={styles.layerFinalValueRow}>
            <Text style={styles.layerFinalValue}>40</Text>
            <Text style={styles.layerFinalUnit}>FT</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SubsurfaceCard() {
  const surface = SUBSURFACE_PROFILE[0];
  const bottom = SUBSURFACE_PROFILE[SUBSURFACE_PROFILE.length - 1];
  const tempRange = surface.temp - bottom.temp;
  const depthMax = bottom.depth;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Subsurface temperature · PacIOOS</Text>
        <Text style={styles.cardHeaderMono}>ROMS HIIG · 11 LEVELS</Text>
      </View>

      <View style={styles.subsurfaceBody}>
        <View style={styles.subsurfaceFactsRow}>
          <View style={styles.subsurfaceFact}>
            <Text style={styles.subsurfaceFactValue}>{surface.temp.toFixed(1)}</Text>
            <Text style={styles.subsurfaceFactUnit}>°C SURFACE</Text>
          </View>
          <View style={styles.subsurfaceFactDivider} />
          <View style={styles.subsurfaceFact}>
            <Text style={styles.subsurfaceFactValue}>{bottom.temp.toFixed(1)}</Text>
            <Text style={styles.subsurfaceFactUnit}>°C AT {depthMax}M</Text>
          </View>
          <View style={styles.subsurfaceFactDivider} />
          <View style={styles.subsurfaceFact}>
            <Text style={styles.subsurfaceFactValue}>{tempRange.toFixed(1)}</Text>
            <Text style={styles.subsurfaceFactUnit}>°C TOTAL Δ</Text>
          </View>
          <View style={styles.subsurfaceFactDivider} />
          <View style={styles.subsurfaceFact}>
            <Text style={[styles.subsurfaceFactValue, { color: colors.great }]}>NONE</Text>
            <Text style={styles.subsurfaceFactUnit}>THERMOCLINE</Text>
          </View>
        </View>

        <Text style={styles.subsurfaceCaption}>
          Upper 10 m is well-mixed (≈ 25.7°C top-to-bottom in your dive range). Real stratification starts around 40 m — outside typical dive depths here.
        </Text>

        <View style={styles.subsurfaceTableHead}>
          <Text style={styles.subsurfaceColHead}>DEPTH</Text>
          <Text style={styles.subsurfaceColHead}>TEMP</Text>
          <Text style={styles.subsurfaceColHeadBar}>PROFILE</Text>
        </View>
        {SUBSURFACE_PROFILE.map((p, i) => {
          // Map temp to a 0-1 position across the visible range
          const pos = (p.temp - bottom.temp) / (surface.temp - bottom.temp);
          return (
            <View
              key={p.depth}
              style={[styles.subsurfaceRow, i < SUBSURFACE_PROFILE.length - 1 && styles.subsurfaceRowDivider]}
            >
              <Text style={styles.subsurfaceDepth}>{p.depth} m</Text>
              <Text style={styles.subsurfaceTemp}>{p.temp.toFixed(2)} °C</Text>
              <View style={styles.subsurfaceBarTrack}>
                <View
                  style={[
                    styles.subsurfaceBarFill,
                    {
                      width: `${pos * 100}%`,
                      backgroundColor: pos > 0.75 ? colors.fair : pos > 0.4 ? colors.good : colors.accent,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TrendsCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Last 6 hours · sparklines</Text>
        <Text style={styles.cardHeaderMono}>30-MIN RESOLUTION</Text>
      </View>
      <View style={styles.trendsBody}>
        <TrendRow label="Visibility"  unit="ft"  data={TREND_6H.vis}  delta="+6"   deltaTone="up" />
        <TrendRow label="Wave height" unit="ft"  data={TREND_6H.wave} delta="+0.1" deltaTone="up" />
        <TrendRow label="Wind"        unit="mph" data={TREND_6H.wind} delta="+2"   deltaTone="down" />
        <TrendRow label="Water temp"  unit="°F"  data={TREND_6H.temp} delta="+0.4" deltaTone="up" />
      </View>
    </View>
  );
}

function TrendRow({ label, unit, data, delta, deltaTone }: { label: string; unit: string; data: number[]; delta: string; deltaTone: 'up' | 'down' | 'flat' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(0.01, max - min);
  return (
    <View style={styles.trendRow}>
      <View style={styles.trendLabelWrap}>
        <Text style={styles.trendLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.trendNow}>
          {data[data.length - 1]}
          <Text style={styles.trendUnit}> {unit}</Text>
        </Text>
      </View>
      <View style={styles.trendBars}>
        {data.map((v, i) => {
          const pct = ((v - min) / range) * 90 + 10;
          return (
            <View key={i} style={styles.trendBarCol}>
              <View style={[styles.trendBar, { height: `${pct}%` }]} />
            </View>
          );
        })}
      </View>
      <Text style={[styles.trendDelta, { color: deltaTone === 'up' ? colors.great : deltaTone === 'down' ? colors.fair : colors.text3 }]}>
        {delta}
      </Text>
    </View>
  );
}

function DataConfidenceCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Data freshness</Text>
        <Text style={styles.cardHeaderMono}>{CONFIDENCE_BREAKDOWN.length} SOURCES</Text>
      </View>
      <View style={styles.confidenceBody}>
        {CONFIDENCE_BREAKDOWN.map((c, i) => (
          <View
            key={c.label}
            style={[
              styles.confidenceRow,
              i < CONFIDENCE_BREAKDOWN.length - 1 && styles.confidenceRowDivider,
            ]}
          >
            <View style={[styles.confidenceDot, { backgroundColor: colors.great }]} />
            <Text style={styles.confidenceLabel}>{c.label}</Text>
            <Text style={styles.confidenceUpdate}>{c.lastUpdate}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BaselineCompareCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Vs 30-day baseline</Text>
        <Text style={styles.cardHeaderMono}>ABOVE NORMAL</Text>
      </View>
      <View style={styles.baselineBody}>
        {BASELINE_COMPARISON.map((b, i) => {
          const pct = ((b.today - b.baseline) / b.baseline) * 100;
          return (
            <View
              key={b.label}
              style={[
                styles.baselineRow,
                i < BASELINE_COMPARISON.length - 1 && styles.baselineRowDivider,
              ]}
            >
              <Text style={styles.baselineLabel}>{b.label}</Text>
              <View style={styles.baselineValueWrap}>
                <Text style={styles.baselineToday}>{b.today}<Text style={styles.baselineUnit}> {b.unit}</Text></Text>
                <Text style={styles.baselineAvg}>avg {b.baseline}</Text>
              </View>
              <Text style={[styles.baselineDelta, { color: b.better ? colors.great : colors.fair }]}>
                {pct > 0 ? '+' : ''}{pct.toFixed(0)}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ModelSourcesCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Model & sources</Text>
      </View>
      <View style={styles.sourcesBody}>
        <Text style={styles.sourcesText}>
          KaiCast Abyss visibility model v1.2 · 7-layer cascade.
        </Text>
        <Text style={styles.sourcesText}>
          Primary baseline from NOAA CoastWatch VIIRS-NPP DINEOF KD490 (2 km daily composites). Subsurface profile from PacIOOS ROMS HIIG (Hawaiian Islands regional model).
        </Text>
        <Text style={styles.sourcesText}>
          Real-time observation feeds: NDBC buoys (wave height + period), NOAA Tides API, OpenWeather One Call (wind + air temp + rain), Open-Meteo Marine (open-ocean wave reference).
        </Text>
        <Text style={styles.sourcesLink}>How the model works →</Text>
      </View>
    </View>
  );
}

function PhotoTile({ photo, variant }: { photo: Photo; variant: 'featured' | 'standard' | 'grid' }) {
  const aspect =
    variant === 'featured' ? 1.5
    : variant === 'standard' ? 0.85
    : photo.shape === 'portrait' ? 0.75
    : photo.shape === 'landscape' ? 1.5
    : 1;

  const tileStyle =
    variant === 'featured' ? styles.featuredFirst
    : variant === 'standard' ? styles.featuredOther
    : styles.gridTile;

  return (
    <View style={[tileStyle, { aspectRatio: aspect }]}>
      <View style={[styles.photoTileBg, { backgroundColor: photo.tintFrom }]} />
      <View
        style={[
          styles.photoTileOverlay,
          {
            backgroundColor: photo.tintTo,
            opacity: 0.45,
          },
        ]}
      />
      <View style={styles.photoTileChrome}>
        <View style={styles.photoTileTopRow}>
          <View style={styles.photoTileTypeChip}>
            <Text style={styles.photoTileTypeText}>{photo.diveType}</Text>
          </View>
          {photo.depthFt > 0 ? (
            <View style={styles.photoTileDepthChip}>
              <Text style={styles.photoTileDepthText}>{photo.depthFt} FT</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.photoTileBottomRow}>
          <View style={styles.photoTileTextWrap}>
            <Text style={styles.photoTileCaption} numberOfLines={2}>{photo.caption}</Text>
            <View style={styles.photoTileMetaRow}>
              <View style={styles.photoTileAvatar}>
                <Text style={styles.photoTileAvatarText}>{photo.authorInitials}</Text>
              </View>
              <Text style={styles.photoTileAuthor}>{photo.author}</Text>
              <Text style={styles.photoTileWhen}>· {photo.whenAgo}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.photoTileLike, photo.liked && { color: colors.nogo }]}>
                {photo.liked ? '♥' : '♡'} {photo.likeCount}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function BuoySourcesCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>About NDBC data</Text>
      </View>
      <View style={styles.sourcesBody}>
        <Text style={styles.sourcesText}>
          Buoy data comes from the National Data Buoy Center (NDBC), a NOAA program. Each station reports significant wave height, dominant period, direction, water temp, wind, and barometric pressure every 30 minutes.
        </Text>
        <Text style={styles.sourcesText}>
          Wave height is measured as the average of the highest one-third of waves over a 20-minute window. Direction is "from" (where the swell originated).
        </Text>
        <Text style={styles.sourcesLink}>NDBC station catalog →</Text>
      </View>
    </View>
  );
}

// ─── Hourly table ─────────────────────────────────────────────────────────

function HourlyCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Hourly forecast · today</Text>
        <Text style={styles.cardHeaderMono}>SHOWING 12 HRS · 2P → 2A</Text>
      </View>

      <View style={styles.hourlyTable}>
        <View style={styles.hourlyHeader}>
          <HourlyCell text="Time" header width={80} />
          <HourlyCell text="Rating" header width={110} />
          <HourlyCell text="Stars" header width={162} />
          <HourlyCell text="Wave" header width={110} />
          <HourlyCell text="Vis" header width={90} />
          <HourlyCell text="Wind" header width={110} />
          <HourlyCell text="Tide" header width={90} />
          <HourlyCell text="Swell" header flex />
        </View>

        {HOURLY.map((row, i) => (
          <View key={i} style={[styles.hourlyRow, i === HOURLY.length - 1 && styles.hourlyRowLast]}>
            <HourlyCell text={row.time} width={80} />
            <View style={[styles.hourlyCell, { width: 110 }]}>
              <ConditionPill tier={row.rating} size="sm" />
            </View>
            <View style={[styles.hourlyCell, { width: 162 }]}>
              <Stars n={row.stars} size={11} />
            </View>
            <HourlyCell text={row.wave} width={110} />
            <HourlyCell text={row.vis} width={90} />
            <HourlyCell text={row.wind} width={110} />
            <HourlyCell text={row.tide} width={90} />
            <HourlyCell text={row.swell} flex />
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>
          SOURCES: NOAA Wave Watch III · NDBC Buoy 51201 · OpenWeather · KaiCast visibility model · Updated every 30 min
        </Text>
      </View>
    </View>
  );
}

function HourlyCell({
  text,
  header,
  width,
  flex,
}: {
  text: string;
  header?: boolean;
  width?: number;
  flex?: boolean;
}) {
  return (
    <View style={[styles.hourlyCell, width != null && { width }, flex && { flex: 1 }]}>
      <Text style={[styles.hourlyCellText, header && styles.hourlyHeaderText]}>{text}</Text>
    </View>
  );
}

// ─── Swell breakdown ──────────────────────────────────────────────────────

const SWELLS = [
  { label: 'PRIMARY',    height: '3.0', period: '9.4s', interval: 'LONG INTERVAL',   deg: '295°', dir: 'WNW', impact: 'IMPACT HIGH · clean lines, well-spaced sets' },
  { label: 'SECONDARY',  height: '0.8', period: '7.2s', interval: 'MID INTERVAL',    deg: '205°', dir: 'SSW', impact: 'IMPACT LOW · adds minor texture' },
  { label: 'WINDSWELL',  height: '0.5', period: '4.8s', interval: 'SHORT INTERVAL',  deg: '050°', dir: 'NE',  impact: 'IMPACT SURFACE · light chop at top' },
];

function SwellsCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Swell breakdown · live</Text>
        <Text style={styles.cardHeaderMono}>3 ACTIVE SOURCES</Text>
      </View>
      <View style={styles.swellRow}>
        {SWELLS.map((s, i) => (
          <View key={s.label} style={[styles.swellCell, i < SWELLS.length - 1 && styles.swellCellDivider]}>
            <View style={styles.swellLabelChip}>
              <Text style={styles.swellLabelText}>
                {s.label === 'PRIMARY' ? '★ ' : ''}{s.label}
              </Text>
            </View>
            <View style={styles.swellHeightRow}>
              <Text style={styles.swellHeightNum}>{s.height}</Text>
              <Text style={styles.swellHeightUnit}>FT</Text>
            </View>
            <Text style={styles.swellSubLabel}>PERIOD {s.period} · {s.interval}</Text>

            <View style={styles.swellCompassRow}>
              <View style={styles.swellCompass}>
                <Text style={styles.swellCompassN}>N</Text>
                <View style={styles.swellCompassArrow} />
              </View>
              <View>
                <Text style={styles.swellDeg}>{s.deg}</Text>
                <Text style={styles.swellDirLabel}>{s.dir}</Text>
              </View>
            </View>

            <View style={styles.swellImpactRow}>
              <Text style={styles.swellImpactText}>{s.impact}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Tide / moon ──────────────────────────────────────────────────────────

const TIDE_EVENTS = [
  { kind: '▲', label: 'High', value: '2.3', time: '02:38 AM' },
  { kind: '▼', label: 'Low',  value: '0.2', time: '08:24 AM' },
  { kind: '▲', label: 'High', value: '2.7', time: '04:55 PM' },
  { kind: '▼', label: 'Low',  value: '0.4', time: '10:48 PM' },
];

function TideCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Tide · sunrise · moon</Text>
        <Text style={styles.cardHeaderMono}>NEW MOON IN 3 DAYS</Text>
      </View>

      <View style={styles.tideChartPlaceholder}>
        <Text style={styles.tideChartLabel}>TIDE CURVE</Text>
      </View>

      <View style={styles.tideEventsRow}>
        {TIDE_EVENTS.map((e, i) => (
          <View
            key={i}
            style={[styles.tideEvent, i < TIDE_EVENTS.length - 1 && styles.tideEventDivider]}
          >
            <View style={styles.tideEventLabelRow}>
              <Text style={styles.tideEventKind}>{e.kind}</Text>
              <Text style={styles.tideEventLabel}>{e.label}</Text>
            </View>
            <View style={styles.tideEventValueRow}>
              <Text style={styles.tideEventValue}>{e.value}</Text>
              <Text style={styles.tideEventUnit}>FT</Text>
            </View>
            <Text style={styles.tideEventTime}>{e.time}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Spot info (right sidebar) ────────────────────────────────────────────

const SPOT_INFO_ROWS = [
  { label: 'Type',        value: 'Shore dive · Open ocean' },
  { label: 'Skill level', value: 'Intermediate' },
  { label: 'Max depth',   value: '45 FT', sub: '14 M' },
  { label: 'Bottom',      value: 'Lava reef · sand patches' },
  { label: 'Entry',       value: 'Sand · easy', sub: 'Park at lot, 100ft walk' },
  { label: 'Marine life', value: 'Turtles · reef fish · monk seal' },
  { label: 'Hazards',     value: 'None today' },
  { label: 'Activities',  value: 'Freedive · Snorkel · Scuba' },
];

function SpotInfoCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Spot info</Text>
      </View>
      {SPOT_INFO_ROWS.map((r, i) => (
        <View key={r.label} style={[styles.infoRow, i < SPOT_INFO_ROWS.length - 1 && styles.infoRowDivider]}>
          <Text style={styles.infoRowLabel}>{r.label}</Text>
          <View style={styles.infoRowValueWrap}>
            <Text style={styles.infoRowValue}>{r.value}</Text>
            {r.sub ? <Text style={styles.infoRowSub}>{r.sub}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Nearest buoys ────────────────────────────────────────────────────────

function BuoysCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Nearest buoys</Text>
        <Text style={styles.cardHeaderMono}>NDBC · LIVE</Text>
      </View>
      {BUOYS.map((b, i) => (
        <View
          key={b.id}
          style={[styles.buoyRow, i < BUOYS.length - 1 && styles.buoyRowDivider]}
        >
          <View style={styles.buoyTextWrap}>
            <Text style={styles.buoyName}>{b.name}</Text>
            <Text style={styles.buoyMeta}>{b.id} · {b.dist}</Text>
          </View>
          <View style={styles.buoyValueRow}>
            <Text style={styles.buoyValue}>{b.height}</Text>
            <Text style={styles.buoyUnit}>FT</Text>
          </View>
          <View style={styles.buoyLiveDot} />
        </View>
      ))}
    </View>
  );
}

// ─── Nearby spots ─────────────────────────────────────────────────────────

function NearbyCard({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Nearby spots</Text>
        <Text style={styles.cardHeaderMono}>RANKED BY TODAY'S RATING</Text>
      </View>
      {NEARBY.map((n, i) => (
        <Pressable
          key={n.name}
          onPress={() => onNavigate?.('spot-detail', { spotId: slugify(n.name) })}
          style={[styles.nearbyRow, i < NEARBY.length - 1 && styles.nearbyRowDivider]}
        >
          <View style={styles.nearbyTextWrap}>
            <Text style={styles.nearbyName}>{n.name}</Text>
            <Text style={styles.nearbyMeta}>{n.region} · {n.dist}</Text>
          </View>
          <ConditionPill tier={n.rating} size="sm" />
          <Text style={styles.nearbySwell}>{n.swell}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Recent reports ───────────────────────────────────────────────────────

const REPORTS = [
  {
    initials: 'KM',
    name: 'Kai M.',
    when: '2H AGO',
    tags: ['EXCELLENT', 'FREEDIVE'],
    body: "Crystal clear today! Turtle at 40ft, glassy surface. Best vis I've seen since spring.",
    stars: 5,
  },
  {
    initials: 'LS',
    name: 'Lena S.',
    when: 'YESTERDAY',
    tags: ['EXCELLENT', 'SCUBA · 35FT'],
    body: 'Easy 50ft vis, no current, turtle cleaning station active.',
    stars: 5,
  },
];

function ReportsCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Recent reports</Text>
        <Text style={styles.cardHeaderMono}>12 THIS WEEK</Text>
      </View>
      {REPORTS.map((r, i) => (
        <View
          key={i}
          style={[styles.reportRow, i < REPORTS.length - 1 && styles.reportRowDivider]}
        >
          <View style={styles.reportTopRow}>
            <View style={styles.reportAvatar}>
              <Text style={styles.reportAvatarText}>{r.initials}</Text>
            </View>
            <Text style={styles.reportName}>{r.name}</Text>
            <View style={styles.reportSpacer} />
            <Text style={styles.reportWhen}>{r.when}</Text>
          </View>
          <View style={styles.reportTagsRow}>
            {r.tags.map((t, j) => (
              <View key={j} style={styles.reportTag}>
                <Text style={styles.reportTagText}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.reportBody}>{r.body}</Text>
          <Stars n={r.stars} size={11} />
        </View>
      ))}
    </View>
  );
}

// ─── Pro CTA ──────────────────────────────────────────────────────────────

function ProCTACard() {
  // Pro upgrade flow isn't wired (no billing in the desktop preview); for now
  // the CTA acknowledges the intent inline so testers see something happen.
  const [tapped, setTapped] = React.useState(false);
  return (
    <View style={styles.proCard}>
      <View style={styles.proGlow} />
      <Text style={styles.proHeading}>Go Pro for 16-day forecasts</Text>
      <Text style={styles.proBody}>
        Unlock long-range LOLA-grade visibility models, custom alerts, and ad-free spot pages.
      </Text>
      <Pressable style={styles.proButton} onPress={() => setTapped(true)}>
        <Text style={styles.proButtonText}>
          {tapped ? 'Thanks — we\'ll email when billing is live' : 'Try free for 7 days →'}
        </Text>
      </Pressable>
    </View>
  );
}

function AddTipCta() {
  // Inline "thanks" feedback — there's no tip-submission backend yet on the
  // desktop preview. The real flow will route into LogDive's notes step.
  const [submitted, setSubmitted] = React.useState(false);
  return (
    <Pressable style={styles.tipsCta} onPress={() => setSubmitted(true)}>
      <Text style={styles.tipsCtaText}>
        {submitted ? '✓ Noted — add the rest in your next dive log' : '+ Add a tip after your next dive'}
      </Text>
    </Pressable>
  );
}

// ─── Star rating (inline) ─────────────────────────────────────────────────

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: size <= 11 ? 1 : 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Text
          key={i}
          style={{
            fontSize: size,
            color: i < n ? colors.accent : colors.text4,
            lineHeight: size + 2,
          }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pageContent: {
    alignItems: 'center',
  },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    paddingHorizontal: 28,
    paddingBottom: 64,
  },

  // ── Breadcrumb ──
  breadcrumb: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breadcrumbItem: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  breadcrumbItemActive: {
    color: colors.text1,
  },
  breadcrumbSep: {
    fontSize: 12,
    color: colors.text4,
  },

  // ── Hero ──
  heroOuter: {
    marginTop: 8,
  },
  heroInner: {
    paddingVertical: 28,
    gap: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 44,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(247,55,38,0.4)',
    backgroundColor: 'rgba(247,55,38,0.1)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.nogo,
  },
  liveText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.nogo,
  },

  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text3,
  },
  heroMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text4,
  },

  heroBody: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 16,
  },
  heroBodyLeft: {
    flex: 1,
    gap: 24,
  },
  heroSummary: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 28,
    color: colors.text2,
    maxWidth: 720,
  },
  heroInlineFacts: {
    flexDirection: 'row',
    gap: 32,
    flexWrap: 'wrap',
  },
  inlineFact: {
    gap: 4,
  },
  inlineFactLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
  },
  inlineFactValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    fontWeight: '500',
  },
  heroImage: {
    width: 540,
    height: 318,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImagePlaceholder: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text4,
  },

  // ── Generic card ──
  card: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    marginTop: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    height: 48,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  cardHeaderTitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
    flex: 1,
  },
  cardHeaderMono: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
  },
  cardFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  cardFooterText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // ── Forecast strip ──
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    padding: 2,
    gap: 2,
  },
  unitToggleBtn: {
    paddingHorizontal: 12,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm - 2,
  },
  unitToggleBtnActive: {
    backgroundColor: colors.surface2,
  },
  unitToggleText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  unitToggleTextActive: {
    color: colors.text1,
  },
  forecastRow: {
    flexDirection: 'row',
  },
  forecastCell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
    position: 'relative',
  },
  forecastCellFirst: {
    borderLeftWidth: 0,
  },
  forecastTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  forecastRowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  forecastDayLabel: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  forecastDate: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    marginLeft: 'auto',
  },
  forecastWaveRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  forecastWaveNum: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '600',
    color: colors.text1,
  },
  forecastWaveUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  forecastVis: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  forecastBars: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
  },
  forecastBar: {
    flex: 1,
    borderRadius: 1,
  },
  forecastTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastTimeLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text4,
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  tabBtn: {
    paddingHorizontal: 18,
    height: 48,
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

  // ── Main grid ──
  mainGrid: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  mainLeft: {
    flex: 1,
    gap: 16,
  },
  mainRight: {
    width: 360,
    gap: 16,
  },

  // ── Hourly table ──
  hourlyTable: {},
  hourlyHeader: {
    flexDirection: 'row',
    height: 38,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  hourlyHeaderText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  hourlyRow: {
    flexDirection: 'row',
    height: 62,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  hourlyRowLast: {
    borderBottomWidth: 0,
  },
  hourlyCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  hourlyCellText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },

  // ── Swells ──
  swellRow: {
    flexDirection: 'row',
  },
  swellCell: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  swellCellDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  swellLabelChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.surface2,
    justifyContent: 'center',
  },
  swellLabelText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text2,
  },
  swellHeightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  swellHeightNum: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '600',
    color: colors.text1,
  },
  swellHeightUnit: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text3,
  },
  swellSubLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  swellCompassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  swellCompass: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  swellCompassN: {
    position: 'absolute',
    top: 4,
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.text3,
  },
  swellCompassArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.accent,
  },
  swellDeg: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text1,
  },
  swellDirLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  swellImpactRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  swellImpactText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },

  // ── Tide ──
  tideChartPlaceholder: {
    height: 160,
    margin: 20,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tideChartLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text4,
  },
  tideEventsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  tideEvent: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  tideEventDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  tideEventLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tideEventKind: {
    fontSize: 11,
    color: colors.accent,
  },
  tideEventLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text2,
  },
  tideEventValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tideEventValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text1,
  },
  tideEventUnit: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text3,
  },
  tideEventTime: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },

  // ── Spot info rows ──
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 16,
  },
  infoRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  infoRowLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text3,
    width: 90,
  },
  infoRowValueWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoRowValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    textAlign: 'right',
  },
  infoRowSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    marginTop: 4,
    textAlign: 'right',
  },

  // ── Buoys ──
  buoyRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 12,
  },
  buoyRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  buoyTextWrap: {
    flex: 1,
    gap: 4,
  },
  buoyName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  buoyMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  buoyValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  buoyValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text1,
  },
  buoyUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  buoyLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.great,
  },

  // ── Nearby ──
  nearbyRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 12,
  },
  nearbyRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  nearbyTextWrap: {
    flex: 1,
    gap: 4,
  },
  nearbyName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  nearbyMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  nearbySwell: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text2,
    width: 50,
    textAlign: 'right',
  },

  // ── Reports ──
  reportRow: {
    padding: 20,
    gap: 12,
  },
  reportRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  reportTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportAvatar: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.text1,
  },
  reportName: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  reportSpacer: { flex: 1 },
  reportWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  reportTagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reportTag: {
    paddingHorizontal: 7,
    height: 15,
    borderRadius: 3,
    backgroundColor: colors.surface2,
    justifyContent: 'center',
  },
  reportTagText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.9,
    color: colors.text2,
  },
  reportBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text2,
  },

  // ── Pro CTA ──
  proCard: {
    marginTop: 16,
    padding: 21,
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  proGlow: {
    position: 'absolute',
    top: -39,
    right: -39,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.accentDim,
  },
  proHeading: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text1,
  },
  proBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text2,
  },
  proButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proButtonText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },

  // ── Spot Info tab ──
  infoSection: {
    marginTop: 16,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  infoSectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 4,
  },
  infoSectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  infoSectionSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  infoSectionBody: {
    padding: 24,
    gap: 14,
  },
  infoBodyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text2,
  },

  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 16,
  },
  factRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  factLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.text3,
    width: 130,
    textTransform: 'uppercase',
    paddingTop: 1,
  },
  factValue: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    lineHeight: 20,
  },

  spotInfoMapWrap: {
    height: 320,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface0,
  },

  marineList: {
    gap: 12,
  },
  marineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  marineEmoji: {
    fontSize: 24,
    width: 32,
  },
  marineTextWrap: {
    flex: 1,
    gap: 2,
  },
  marineName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  marineSeason: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },

  tipRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  tipRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  tipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  tipBody: { flex: 1, gap: 6 },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  tipAuthor: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  tipRole: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text3,
  },
  tipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },
  tipsCta: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  tipsCtaText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },

  // At a glance grid (2×2)
  glanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  glanceCell: {
    width: '50%',
    padding: 18,
    gap: 6,
  },
  glanceCellRight: {
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
  },
  glanceCellBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  glanceLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
  },
  glanceValue: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },

  // Best season bars
  seasonBody: {
    padding: 16,
    gap: 12,
  },
  seasonBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 100,
  },
  seasonBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  seasonBar: {
    width: '100%',
    borderRadius: 2,
  },
  seasonMonth: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
  },
  seasonCaption: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    lineHeight: 17,
  },

  // History rows
  historyRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  historyRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  historyLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  historyValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },

  // ── Hazards tab ──
  todaysRiskCard: {
    marginTop: 16,
    padding: 24,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  todaysRiskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todaysRiskDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  todaysRiskLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text3,
    fontWeight: '700',
  },
  todaysRiskPill: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 4,
    justifyContent: 'center',
  },
  todaysRiskPillText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  todaysRiskHeadline: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  todaysRiskBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text2,
  },

  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    gap: 5,
  },
  riskPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  riskPillText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },

  alertItem: {
    paddingVertical: 14,
    gap: 8,
  },
  alertItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  alertItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertItemTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  alertItemBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },
  alertItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  alertItemMetaText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  alertItemMetaDot: {
    color: colors.text4,
    fontSize: 10,
  },

  standingRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  standingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  standingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standingIconText: {
    fontSize: 16,
  },
  standingTextWrap: { flex: 1, gap: 6 },
  standingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  standingTitle: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  standingDetail: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },

  cautionRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  cautionRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  cautionEmoji: {
    fontSize: 22,
    width: 32,
  },
  cautionTextWrap: { flex: 1, gap: 6 },
  cautionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cautionName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  cautionRule: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },

  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  incidentRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  incidentDate: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
    width: 56,
  },
  incidentBody: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },

  // Emergency contacts
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    gap: 14,
  },
  contactRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  contactLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  contactValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text1,
    fontWeight: '500',
    textAlign: 'right',
  },
  contactValuePrimary: {
    color: colors.nogo,
    fontWeight: '700',
  },

  // Jellyfish 14-day
  jellyBody: {
    padding: 12,
    gap: 4,
  },
  jellyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  jellyDay: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
    width: 60,
  },
  jellyTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  jellyFill: {
    height: 6,
    borderRadius: 3,
  },
  jellyLevel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    width: 52,
    textAlign: 'right',
  },

  // Evacuation
  evacBody: {
    padding: 16,
    gap: 12,
  },
  evacRouteTitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  evacRouteBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text3,
  },
  evacFactRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: 4,
  },
  evacFact: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  evacFactDivider: {
    width: 1,
    backgroundColor: colors.hairline,
  },
  evacFactValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  evacFactUnit: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // ── Reports tab ──
  reportsHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reportsHeaderLeft: { flex: 1, gap: 4 },
  reportsHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  reportsHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  reportsHeaderBtn: {
    paddingHorizontal: 18,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsHeaderBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },

  reportsFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 12,
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  reportsFilterChips: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  repFilterChip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  repFilterChipActive: {
    backgroundColor: colors.surface1,
    borderColor: colors.hairlineStrong,
  },
  repFilterText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    fontWeight: '500',
  },
  repFilterTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  reportsSortWrap: {
    flexDirection: 'row',
    gap: 14,
  },
  repSortBtn: {},
  repSortText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  repSortTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  reportsList: {
    gap: 14,
    marginTop: 16,
  },
  reportsEmpty: {
    padding: 32,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 6,
  },
  reportsEmptyTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  reportsEmptySub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },

  // 30-day conditions summary card
  condSummaryBody: { padding: 16, gap: 10 },
  condSummaryStatRow: {
    flexDirection: 'row',
    paddingBottom: 8,
  },
  condSummaryStat: { flex: 1, gap: 4 },
  condSummaryStatDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 12,
  },
  condSummaryValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text1,
  },
  condSummaryUnit: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  condSummaryRange: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  condSummarySectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
    marginTop: 8,
  },
  condHistoryRow: {
    flexDirection: 'row',
    gap: 3,
    height: 24,
  },
  condHistoryBar: {
    flex: 1,
    borderRadius: 2,
  },
  condHistoryTickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  condHistoryTick: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
  },

  // Top contributors
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  contribRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  contribRank: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    width: 16,
  },
  contribAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contribAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: colors.text1,
  },
  contribTextWrap: { flex: 1, gap: 2 },
  contribName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text1,
  },
  contribBadge: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.accent,
  },
  contribDives: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
  },

  // Photo highlights
  photoHighlightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 6,
  },
  photoHighlightTile: {
    width: 'calc(33.33% - 4px)' as unknown as number,
    aspectRatio: 1,
    backgroundColor: colors.surface1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHighlightIcon: {
    fontSize: 18,
    color: colors.text4,
  },
  photoHighlightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  photoHighlightCaption: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  photoHighlightLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
  },

  // ── Buoys tab ──
  buoysHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  buoysHeaderLeft: { flex: 1, gap: 4 },
  buoysHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  buoysHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  buoysHeaderLegend: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 4,
  },
  buoysLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buoysLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  buoysLegendText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
  },

  primaryBuoyCard: {
    marginTop: 16,
  },
  primaryBuoyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 14,
  },
  primaryBuoyTitleWrap: { flex: 1, gap: 4 },
  primaryBuoyTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  primaryBuoyId: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.6,
  },
  primaryBuoyName: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text1,
  },
  primaryBuoyDist: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  primaryBuoyStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBuoyStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  primaryBuoyStatusText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  primaryBuoyUpdated: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    marginLeft: 4,
  },

  primaryBuoyMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  buoyMetricCell: {
    width: '33.333%',
    padding: 20,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: colors.hairline,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  buoyMetricLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  buoyMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  buoyMetricValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  buoyMetricValueAccent: {
    color: colors.accent,
  },
  buoyMetricUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  buoyMetricSecondary: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },

  // Spectrum
  spectrumBody: {
    padding: 20,
    gap: 16,
  },
  spectrumBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 160,
  },
  spectrumBarCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  spectrumBar: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  spectrumPeriod: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  spectrumLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  spectrumLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spectrumLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  spectrumLegendText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  spectrumPeakNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    fontStyle: 'italic',
  },

  // Wave 24h history
  waveHistoryBody: {
    padding: 20,
    gap: 16,
  },
  waveHistoryStats: {
    flexDirection: 'row',
    gap: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  waveHistoryStat: { gap: 4 },
  waveHistoryStatValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text1,
  },
  waveHistoryStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  waveHistoryChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 80,
  },
  waveHistoryBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  waveHistoryBar: {
    width: '100%',
    backgroundColor: colors.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  waveHistoryTickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  waveHistoryTick: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
  },

  // Other buoys list
  otherBuoysSection: {
    marginTop: 16,
  },
  otherBuoysHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  otherBuoysTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  otherBuoysCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  otherBuoysList: {
    gap: 10,
  },
  otherBuoyRow: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  otherBuoyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  otherBuoyId: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  otherBuoyName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  otherBuoyStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  otherBuoyStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  otherBuoyStatusText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  otherBuoyUpdated: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  otherBuoyDist: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text2,
    fontWeight: '600',
  },
  otherBuoyMetricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  otherMetric: { flex: 1, gap: 2 },
  otherMetricLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  otherMetricValue: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
    fontWeight: '500',
  },

  // Right rail
  statusBody: { padding: 16, gap: 10 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  statusCount: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '700',
  },
  statusDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 4,
  },
  statusFootnote: { gap: 2 },
  statusFootnoteText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  miniChartBody: { padding: 14, gap: 10 },
  miniChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 60,
  },
  miniChartCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  miniChartBar: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  miniChartFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  miniChartStat: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  miniChartStatValue: {
    color: colors.text1,
    fontWeight: '700',
  },

  sourcesBody: { padding: 16, gap: 10 },
  sourcesText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text3,
  },
  sourcesLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
    marginTop: 4,
  },

  // ── Photos tab ──
  photosHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  photosHeaderLeft: { flex: 1, gap: 4 },
  photosHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  photosHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  photosUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  photosUploadBtnIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.bg,
  },
  photosUploadBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },

  photosFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  photoFilterChip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  photoFilterChipActive: {
    backgroundColor: colors.surface1,
    borderColor: colors.hairlineStrong,
  },
  photoFilterText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    fontWeight: '500',
  },
  photoFilterTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  photosSort: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },

  // Featured row: 1 big + 2 smaller
  featuredRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  featuredFirst: {
    flex: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredOther: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },

  // Main grid — 4 cols
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 10,
  },
  gridTile: {
    width: 'calc(25% - 8px)' as unknown as number,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },

  photoTileBg: {
    ...StyleSheet.absoluteFillObject,
  },
  photoTileOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  photoTileChrome: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  photoTileTopRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  photoTileTypeChip: {
    paddingHorizontal: 8,
    height: 20,
    backgroundColor: 'rgba(12,16,21,0.65)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  photoTileTypeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text1,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  photoTileDepthChip: {
    paddingHorizontal: 8,
    height: 20,
    backgroundColor: 'rgba(12,16,21,0.65)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  photoTileDepthText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  photoTileBottomRow: {
    gap: 6,
  },
  photoTileTextWrap: { gap: 6 },
  photoTileCaption: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
    lineHeight: 18,
  },
  photoTileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoTileAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTileAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: colors.text1,
  },
  photoTileAuthor: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text1,
    fontWeight: '600',
  },
  photoTileWhen: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text2,
  },
  photoTileLike: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text1,
    fontWeight: '600',
  },

  photosEmpty: {
    marginTop: 16,
    padding: 32,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 6,
  },
  photosEmptyTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text1,
  },
  photosEmptySub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },

  // ── Right rail: week highlights ──
  weekHighlightsBody: {
    padding: 12,
    gap: 12,
  },
  weekHighlightTile: {
    aspectRatio: 1.4,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  weekHighlightImage: { ...StyleSheet.absoluteFillObject },
  weekHighlightOverlay: { ...StyleSheet.absoluteFillObject },
  weekHighlightCaption: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 2,
  },
  weekHighlightTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  weekHighlightAuthor: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text2,
    letterSpacing: 0.4,
  },
  weekHighlightStats: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  weekHighlightStat: { flex: 1, gap: 4 },
  weekHighlightStatDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 12,
  },
  weekHighlightStatValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  weekHighlightStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // Top photographers
  topPhotographerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  topPhotographerRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  topPhotographerRank: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    width: 16,
  },
  topPhotographerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topPhotographerAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: colors.text1,
  },
  topPhotographerName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '500',
  },
  topPhotographerCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
  },

  // Upload CTA card
  uploadCtaCard: {
    padding: 18,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    alignItems: 'flex-start',
    gap: 10,
  },
  uploadCtaIcon: {
    fontSize: 24,
  },
  uploadCtaTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  uploadCtaBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text2,
  },
  uploadCtaBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  uploadCtaBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },

  // ── Conditions tab ──
  condHeroCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 0,
  },
  condHeroLeft: {
    flex: 1,
    padding: 24,
    gap: 12,
  },
  condHeroLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
  },
  condHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
  },
  condHeroEstimate: {
    fontFamily: fonts.display,
    fontSize: 48,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -1,
  },
  condHeroEstimateUnit: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text3,
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  condHeroBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text2,
  },
  condHeroDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginVertical: 24,
  },
  condHeroRight: {
    width: 180,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  condHeroStat: { gap: 4 },
  condHeroStatValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  condHeroStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },

  // Layer cascade
  layerCascadeBody: {
    padding: 4,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  layerRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  layerIndex: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerIndexText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text2,
  },
  layerTextWrap: { flex: 1, gap: 2 },
  layerLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  layerSource: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text3,
  },
  layerNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    marginTop: 4,
  },
  layerDeltaWrap: {
    width: 64,
    alignItems: 'flex-end',
  },
  layerDelta: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  layerRunning: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 3,
  },
  layerRunningValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  layerRunningUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  layerFinalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginTop: 4,
    backgroundColor: colors.surface1,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  layerFinalLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  layerFinalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  layerFinalValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  layerFinalUnit: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text3,
  },

  // Subsurface
  subsurfaceBody: {
    padding: 20,
    gap: 14,
  },
  subsurfaceFactsRow: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  subsurfaceFact: { flex: 1, gap: 4 },
  subsurfaceFactDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 12,
  },
  subsurfaceFactValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  subsurfaceFactUnit: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  subsurfaceCaption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
    fontStyle: 'italic',
  },
  subsurfaceTableHead: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    gap: 12,
    alignItems: 'center',
  },
  subsurfaceColHead: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
    width: 76,
  },
  subsurfaceColHeadBar: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  subsurfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 12,
  },
  subsurfaceRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  subsurfaceDepth: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text2,
    width: 76,
  },
  subsurfaceTemp: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text1,
    width: 76,
    fontWeight: '600',
  },
  subsurfaceBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: colors.surface2,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  subsurfaceBarFill: {
    height: 5,
    borderRadius: 2.5,
  },

  // Trends (6h sparklines)
  trendsBody: {
    padding: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  trendLabelWrap: {
    width: 130,
    gap: 4,
  },
  trendLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  trendNow: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
  },
  trendUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    fontWeight: '400',
  },
  trendBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 40,
  },
  trendBarCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    backgroundColor: colors.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  trendDelta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
  },

  // Confidence
  confidenceBody: {},
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  confidenceRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
  },
  confidenceUpdate: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  // Baseline comparison
  baselineBody: {},
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  baselineRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  baselineLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  baselineValueWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  baselineToday: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  baselineUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '400',
  },
  baselineAvg: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text4,
  },
  baselineDelta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
  },

  // Coming-soon placeholder for unbuilt tabs
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
});
