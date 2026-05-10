import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Tag } from '@/components/Tag';
import { Card } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { RatingBar } from '@/components/RatingBar';
import { TideChart } from '@/components/TideChart';
import { Button } from '@/components/Button';
import { DiveReportCard } from '@/components/DiveReportCard';
import { Icon } from '@/components/Icon';
import { MoonInfoCard } from './overview/MoonInfoCard';
import { DirectionalReadingCard } from '@/components/DirectionalReadingCard';
import { colors, radius, spacing, typography, RATING_COLORS } from '@/theme';
import { diveReports, exploreSpots, featuredSpot } from '@/api/mockData';
import { useSpotReport } from '@/hooks/useSpotReport';
import type { BackendReport, BackendVisibility } from '@/api/kaicast';
import type { RootNav, RootStackParamList } from '@/navigation/types';
import type { Spot, SpotReport } from '@/types';
import { ForecastTab as ForecastTabRebuild } from './forecast/ForecastTab';
import { HazardsTab as HazardsTabRebuild } from './hazards/HazardsTab';
import { GuideTab as GuideTabRebuild } from './guide/GuideTab';
import { satelliteUrl } from '@/api/satellite';
import { useSpotDiveLogs, diveLogToReport } from '@/hooks/useDiveLogs';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { addFavorite, removeFavorite } from '@/api/favorites';

function findSpot(id: string): Spot {
  return exploreSpots.find((s) => s.id === id) ?? featuredSpot;
}

type SpotTab = 'Overview' | 'Hazards' | 'Forecast' | 'Guide';

const TABS: SpotTab[] = ['Overview', 'Hazards', 'Forecast', 'Guide'];

export function SpotDetailScreen() {
  const nav = useNavigation<RootNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SpotDetail'>>();
  const [tab, setTab] = useState<SpotTab>('Overview');

  const spot = findSpot(route.params.spotId);
  const { user } = useAuth();
  const { isFavorite } = useFavorites(user?.id);
  const favorited = isFavorite(spot.id);
  const onToggleFavorite = () => {
    if (!user) return;
    if (favorited) removeFavorite(user.id, spot.id);
    else addFavorite(user.id, spot.id);
  };
  const reportState = useSpotReport(spot);
  const r = reportState.data;
  const { logs: spotLogs } = useSpotDiveLogs(spot.id);
  // Live community feed for this spot. When nobody's logged a dive
  // here yet, fall back to the mock list so the UI doesn't go blank.
  const friendsReports = spotLogs.length
    ? spotLogs.map((l) => diveLogToReport(l, 'Diver', spot.name))
    : diveReports;
  const heroSatelliteUri = satelliteUrl(spot.lat, spot.lon, 800, 600, 16);

  return (
    <Screen scroll={false} padding={0} edges={['top', 'left', 'right']}>
      <View style={styles.hero}>
        {heroSatelliteUri ? (
          <Image source={{ uri: heroSatelliteUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[spot.coverColor ?? '#06334a', '#04111e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)']}
          style={StyleSheet.absoluteFill}
        />
        <Header
          transparent
          onBack={() => nav.goBack()}
          rightSlot={
            <Pressable hitSlop={12} style={styles.iconBtn} onPress={onToggleFavorite}>
              <Icon
                name={favorited ? 'heart-filled' : 'heart'}
                size={20}
                color={favorited ? colors.accent : colors.textPrimary}
              />
            </Pressable>
          }
        />
        <View style={styles.heroBody}>
          <Tag variant="freedive" label={spot.region.split('·')[0].trim().toUpperCase()} />
          <Text style={[typography.display, { marginTop: spacing.md }]}>{spot.name}</Text>
          <Text style={styles.heroSub}>Today · Wed, Apr 16 · 2-15 PM</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === 'Overview' && <OverviewTab report={r} source={reportState.source} spot={spot} backend={reportState.backend} />}
        {tab === 'Hazards' && <HazardsTabRebuild spot={spot} report={reportState.backend} />}
        {tab === 'Forecast' && <ForecastTabRebuild spot={spot} spotCoords={{ lat: spot.lat, lon: spot.lon }} />}
        {tab === 'Guide' && <GuideTabRebuild spot={spot} />}

        {tab !== 'Guide' && (
          <>
            <View style={{ height: spacing.xxl }} />
            <Text style={typography.h3}>Friends' Reports</Text>
            <View style={{ height: spacing.md }} />
            {friendsReports.map((rep) => (
              <View key={rep.id} style={{ marginBottom: spacing.md }}>
                <DiveReportCard report={rep} onPress={() => nav.navigate('DiveReportDetail', { reportId: rep.id })} />
              </View>
            ))}

            <View style={{ height: spacing.xxl }} />
            <Button label="Log Your Dive" variant="outline" fullWidth onPress={() => nav.navigate('LogDive')} />
          </>
        )}
        <View style={{ height: tab === 'Guide' ? 100 : spacing.xxxl }} />
      </ScrollView>

      {tab === 'Guide' && (
        <View style={styles.stickyCta}>
          <Button label="Log Your Dive" fullWidth onPress={() => nav.navigate('LogDive')} />
        </View>
      )}
    </Screen>
  );
}

function OverviewTab({
  report: r,
  source,
  spot,
  backend,
}: {
  report: SpotReport;
  source: 'live' | 'mock';
  spot: Spot;
  backend: BackendReport | null;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader report={r} source={source} />

      <Row>
        <MetricCard label="WATER CLARITY" value={String(r.visibilityFt)} unit="FT" sub="VISIBILITY" />
        <MetricCard
          label="WAVE HEIGHT"
          value={String(r.swellHeightFt)}
          unit="FT"
          sub="SWELL HEIGHT"
        />
      </Row>

      {backend?.now?.visibility?.sun?.altitudeDeg != null && (
        <SunShadowCard visibility={backend.now.visibility} />
      )}

      <Card>
        <View style={uvCardStyles.header}>
          <Text style={typography.caption}>UV RATING</Text>
          <Text style={[uvCardStyles.severity, { color: uvSeverityColor(r.uvIndex) }]}>
            {uvSeverityLabel(r.uvIndex)}
          </Text>
        </View>
        <View style={{ height: spacing.md }} />
        <RatingBar value={r.uvIndex} max={11} />
      </Card>

      <Row>
        <MetricCard label="WATER TEMP" value={String(r.waterTempF)} unit="°F" sub="3MM WETSUIT" />
        <MetricCard label="AIR TEMP" value={String(r.airTempF)} unit="°F" sub="AIR TEMP" />
      </Row>

      <DirectionalReadingCard
        label="CURRENT"
        value={r.currentMph}
        unit="MPH"
        descriptor={currentDescriptor(r.currentMph)}
        directionDegrees={CURRENT_DIRECTION_DEG}
        spotCoords={{ lat: spot.lat, lon: spot.lon }}
      />

      <TideChart
        series={r.tide.series}
        trend={r.tide.trend}
        nowFt={r.tide.nowFt}
        nextLabel={r.tide.nextLabel}
        nextFt={r.tide.nextFt}
      />

      <DirectionalReadingCard
        label="WIND"
        value={r.windMph}
        unit="MPH"
        descriptor={windDescriptor(r.windMph)}
        directionDegrees={WIND_DIRECTION_DEG}
        spotCoords={{ lat: spot.lat, lon: spot.lon }}
        footnote={`${r.gustMph} MPH GUST`}
      />

      <MoonInfoCard
        phase={r.moon.phase}
        illumination={r.moon.illumination}
        daysSinceFullMoon={r.moon.daysSinceFullMoon}
      />
    </View>
  );
}

function SunShadowCard({ visibility }: { visibility: BackendVisibility }) {
  const sun = visibility.sun;
  const shadow = visibility.shadow;
  const light = visibility.light;
  if (!sun || sun.altitudeDeg == null || sun.azimuthDeg == null) return null;

  const altDeg = sun.altitudeDeg;
  const azDeg  = sun.azimuthDeg;
  const isNight = altDeg <= 0;
  const inShadow = shadow?.shadowed === true && shadow?.reason === 'terrain';

  // Plot the sun on a half-dome diagram. Compass azimuth → x position
  // (270 = west = left edge, 90 = east = right edge). Altitude → y.
  const SIZE = 140;
  const cx = SIZE / 2;
  const cy = SIZE - 8; // baseline near the bottom
  const r  = SIZE / 2 - 12;
  // Flat at horizon, vertical at zenith. Use altitude → vertical position.
  const altClamped = Math.max(0, Math.min(90, altDeg));
  const azRad = (azDeg - 90) * (Math.PI / 180); // 90° = right, 180° = down (south)
  const sx = cx + r * Math.cos(azRad) * Math.cos(altClamped * Math.PI / 180);
  const sy = cy - r * Math.sin(altClamped * Math.PI / 180);

  const compassDir = (() => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(azDeg / 45) % 8];
  })();

  const lightPct = Math.round((light?.factor ?? 0) * 100);
  const lightLabel =
    isNight ? 'Night' :
    inShadow ? 'In mountain shadow' :
    lightPct >= 80 ? 'Direct sunlight' :
    lightPct >= 50 ? 'Bright but indirect' :
    lightPct >= 25 ? 'Low-light' : 'Twilight';

  const lightColor =
    isNight ? colors.textMuted :
    inShadow ? '#FFB347' :
    lightPct >= 80 ? colors.excellent :
    lightPct >= 50 ? colors.accent :
    colors.textSecondary;

  return (
    <Card>
      <View style={sunStyles.header}>
        <Text style={typography.caption}>SUN POSITION</Text>
        <Text style={[sunStyles.lightLabel, { color: lightColor }]}>{lightLabel}</Text>
      </View>
      <View style={sunStyles.body}>
        <View style={[sunStyles.dome, { width: SIZE, height: SIZE - 8 + 8 }]}>
          {/* Horizon line */}
          <View style={[sunStyles.horizon, { width: SIZE - 16, top: cy }]} />
          {/* Sun position dot */}
          <View
            style={[
              sunStyles.sunDot,
              {
                left: sx - 7,
                top: sy - 7,
                backgroundColor: isNight ? colors.textMuted : (inShadow ? '#FFB347' : '#FFD43B'),
                opacity: isNight ? 0.45 : 1,
              },
            ]}
          />
          {/* Compass tick labels */}
          <Text style={[sunStyles.tick, { left: 0, top: cy + 4 }]}>W</Text>
          <Text style={[sunStyles.tick, { right: 0, top: cy + 4 }]}>E</Text>
          <Text style={[sunStyles.tick, { left: cx - 4, top: cy + 4 }]}>S</Text>
        </View>
        <View style={{ flex: 1, gap: 6, paddingLeft: spacing.md }}>
          <ReadoutRow label="Altitude" value={`${altDeg.toFixed(0)}°`} />
          <ReadoutRow label="Azimuth"  value={`${azDeg.toFixed(0)}° ${compassDir}`} />
          {Number.isFinite(shadow?.horizonDeg) && (shadow?.horizonDeg ?? 0) > 1 && (
            <ReadoutRow
              label="Terrain"
              value={`${shadow!.horizonDeg!.toFixed(0)}° horizon`}
              tint={inShadow ? '#FFB347' : undefined}
            />
          )}
          <ReadoutRow label="Light" value={`${lightPct}%`} tint={lightColor} />
        </View>
      </View>
    </Card>
  );
}

function ReadoutRow({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}</Text>
      <Text style={{ ...typography.body, color: tint ?? colors.textPrimary, fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  );
}

const sunStyles = StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  lightLabel: { ...typography.bodySm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  body:       { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  dome:       { position: 'relative' },
  horizon:    { position: 'absolute', height: 1, backgroundColor: colors.border, left: 8 },
  sunDot:     { position: 'absolute', width: 14, height: 14, borderRadius: 999 },
  tick:       { position: 'absolute', ...typography.caption, color: colors.textMuted, fontSize: 9 },
});

function windDescriptor(mph: number): string {
  if (mph < 3) return 'CALM';
  if (mph < 8) return 'LIGHT';
  if (mph < 13) return 'LIGHT TRADES';
  if (mph < 19) return 'TRADES';
  if (mph < 25) return 'STRONG';
  return 'GALE';
}

function currentDescriptor(mph: number): string {
  if (mph < 0.5) return 'NON-EXISTENT';
  if (mph < 1) return 'LIGHT';
  if (mph < 2) return 'MODERATE';
  return 'STRONG';
}

function uvSeverityLabel(uv: number): string {
  if (uv <= 2) return 'LOW';
  if (uv <= 5) return 'MODERATE';
  if (uv <= 7) return 'HIGH';
  if (uv <= 10) return 'VERY HIGH';
  return 'EXTREME';
}

function uvSeverityColor(uv: number): string {
  if (uv <= 2) return colors.accent;
  if (uv <= 5) return colors.excellent;
  if (uv <= 7) return colors.warn;
  return colors.hazard;
}

// TODO: thread real wind/current direction through the report shape.
// Figma hardcodes the dial bearings; the directional cards read from
// these constants so the icon, dial, and arrow stay in sync.
const WIND_DIRECTION_DEG = 120;
const CURRENT_DIRECTION_DEG = 45;

const uvCardStyles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  severity: { ...typography.caption, fontWeight: '700' },
});

function RatingHeader({ report: r, source }: { report: SpotReport; source: 'live' | 'mock' }) {
  const peak = peakWindowLabel(r);
  return (
    <Card>
      <View style={ratingStyles.headerRow}>
        <View style={ratingStyles.dotWrap}>
          <View style={[ratingStyles.dot, { backgroundColor: RATING_COLORS[r.rating] }]} />
          <View>
            <Text style={[typography.h1, { fontSize: 32 }]}>{r.ratingLabel}</Text>
            {peak ? <Text style={ratingStyles.peakLine}>{peak}</Text> : null}
          </View>
        </View>
        {source === 'live' ? <Tag variant="live" dot /> : <Tag variant="warn" label="DEMO" dot />}
      </View>
      <Text style={[typography.bodySm, { color: colors.textSecondary, marginTop: spacing.sm }]}>{r.hazardSummary}</Text>
      <View style={{ height: spacing.md }} />
      <Text style={typography.caption}>BEST CONDITIONS TODAY</Text>
      <View style={ratingStyles.bar}>
        <View style={[ratingStyles.seg, { backgroundColor: RATING_COLORS.fair }]} />
        <View style={[ratingStyles.seg, { backgroundColor: RATING_COLORS.excellent }]} />
        <View style={[ratingStyles.seg, { backgroundColor: RATING_COLORS.excellent }]} />
        <View style={[ratingStyles.seg, { backgroundColor: RATING_COLORS.fair }]} />
      </View>
    </Card>
  );
}

// TODO(forecast): once hourly conditions land on SpotReport (mirroring
// ForecastDay.ratingSegments), compute this from the highest-scored
// hour. For now we mirror the hardcoded 4-segment bar above — the
// middle two "excellent" bars cover 6 AM – 6 PM, so peak window =
// the centered 9 AM – 3 PM subwindow. Returns "Peak now" when the
// current hour falls inside that window.
function peakWindowLabel(_r: SpotReport): string {
  const peakStart = 9;
  const peakEnd = 15;
  const nowHour = new Date().getHours();
  if (nowHour >= peakStart && nowHour < peakEnd) return 'Peak now';
  return `Peak window ${formatHour12(peakStart)} – ${formatHour12(peakEnd)}`;
}

function formatHour12(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: { height: 230, paddingHorizontal: 0, paddingBottom: spacing.xl },
  heroBody: { paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  heroSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.xs },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, backgroundColor: colors.bg },
  tabs: { gap: spacing.md, marginBottom: spacing.lg },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  tabActive: { backgroundColor: colors.accentSoft },
  tabLabel: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  tabLabelActive: { color: colors.accent },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialOverlay: { position: 'absolute', right: 8, bottom: 8 },
  stickyCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

const ratingStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dotWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 999 },
  bar: { flexDirection: 'row', gap: 4, marginTop: spacing.md, height: 8 },
  seg: { flex: 1, borderRadius: 999 },
  peakLine: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
});

