import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
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
}

export function SpotDetailScreen({ activeNav = 'forecast' }: SpotDetailScreenProps) {
  const [tab, setTab] = React.useState('Forecast');

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} />

      <View style={styles.maxWidth}>
        <Breadcrumb />
        <Hero />
        <ForecastStrip />
        <TabBar tab={tab} onTab={setTab} />
        <MainGrid />
      </View>
    </ScrollView>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────

function Breadcrumb() {
  const parts = ['Hawaiian Islands', "O'ahu", 'Leeward Coast', 'Electric Beach'];
  return (
    <View style={styles.breadcrumb}>
      {parts.map((p, i) => (
        <React.Fragment key={p}>
          <Text
            style={[
              styles.breadcrumbItem,
              i === parts.length - 1 && styles.breadcrumbItemActive,
            ]}
          >
            {p}
          </Text>
          {i < parts.length - 1 ? <Text style={styles.breadcrumbSep}>›</Text> : null}
        </React.Fragment>
      ))}
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

          <View style={styles.heroImage}>
            <Text style={styles.heroImagePlaceholder}>SATELLITE</Text>
          </View>
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

function MainGrid() {
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
        <NearbyCard />
        <ReportsCard />
        <ProCTACard />
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

function NearbyCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTitle}>Nearby spots</Text>
        <Text style={styles.cardHeaderMono}>RANKED BY TODAY'S RATING</Text>
      </View>
      {NEARBY.map((n, i) => (
        <View
          key={n.name}
          style={[styles.nearbyRow, i < NEARBY.length - 1 && styles.nearbyRowDivider]}
        >
          <View style={styles.nearbyTextWrap}>
            <Text style={styles.nearbyName}>{n.name}</Text>
            <Text style={styles.nearbyMeta}>{n.region} · {n.dist}</Text>
          </View>
          <ConditionPill tier={n.rating} size="sm" />
          <Text style={styles.nearbySwell}>{n.swell}</Text>
        </View>
      ))}
    </View>
  );
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
  return (
    <View style={styles.proCard}>
      <View style={styles.proGlow} />
      <Text style={styles.proHeading}>Go Pro for 16-day forecasts</Text>
      <Text style={styles.proBody}>
        Unlock long-range LOLA-grade visibility models, custom alerts, and ad-free spot pages.
      </Text>
      <Pressable style={styles.proButton}>
        <Text style={styles.proButtonText}>Try free for 7 days →</Text>
      </Pressable>
    </View>
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
});
