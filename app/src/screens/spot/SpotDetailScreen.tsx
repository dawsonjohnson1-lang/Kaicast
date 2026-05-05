import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Tag, TagVariant } from '@/components/Tag';
import { Card } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { RatingBar } from '@/components/RatingBar';
import { TideChart } from '@/components/TideChart';
import { CompassDial } from '@/components/CompassDial';
import { Button } from '@/components/Button';
import { DiveReportCard } from '@/components/DiveReportCard';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { electricBeachReport, diveReports as mockDiveReports } from '@/api/mockData';
import { useSpotReport } from '@/hooks/useSpotReport';
import { useSpot } from '@/hooks/useSpot';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import { useAlerts } from '@/hooks/useAlerts';
import {
  cToF,
  cloudCoverLabel,
  ktsToMph,
  mToFt,
  ratingToCondition,
  relativeTime,
  runoffToWaterQuality,
  windDegToDir,
} from '@/utils/transforms';
import type { RootNav, RootStackParamList } from '@/navigation/types';
import type { DiveReport, TidePoint } from '@/types';
import type { SpotReportDoc } from '@/types/report';

type SpotTab = 'Overview' | 'Conditions' | 'Hazards' | 'Forecast' | 'Guide';
const TABS: SpotTab[] = ['Overview', 'Conditions', 'Hazards', 'Forecast', 'Guide'];

type SpotRoute = RouteProp<RootStackParamList, 'SpotDetail'>;

function ratingTagVariant(rating?: string | null): TagVariant {
  switch (ratingToCondition(rating)) {
    case 'excellent': return 'excellent';
    case 'good':      return 'good';
    case 'caution':   return 'warn';
    case 'hazard':    return 'hazard';
  }
}

export function SpotDetailScreen() {
  const nav = useNavigation<RootNav>();
  const route = useRoute<SpotRoute>();
  const spotId = route.params?.spotId;

  const [tab, setTab] = useState<SpotTab>('Conditions');
  const { report } = useSpotReport(spotId);
  const { spot } = useSpot(spotId);
  const { reports: community } = useCommunityReports(spotId);
  const { alerts } = useAlerts(spotId);

  const fallback = electricBeachReport;
  const liveOrFallbackName = report?.spotName ?? spot?.name ?? fallback.spot.name;
  const updatedAgo = report?.generatedAt ? relativeTime(report.generatedAt) : 'Sample data';

  return (
    <Screen scroll={false} padding={0} edges={['top', 'left', 'right']}>
      <View style={styles.hero}>
        <LinearGradient
          colors={['#06334a', '#04111e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Header
          transparent
          onBack={() => nav.goBack()}
          rightSlot={
            <Pressable hitSlop={12} style={styles.iconBtn}>
              <Icon name="heart" size={20} color={colors.textPrimary} />
            </Pressable>
          }
        />
        <View style={styles.heroBody}>
          <Tag variant="freedive" label={spot?.island ?? 'OAHU'} />
          <Text style={[typography.display, { marginTop: spacing.md }]}>{liveOrFallbackName}</Text>
          <Text style={styles.heroSub}>Updated {updatedAgo}</Text>
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

        {tab === 'Overview' && <OverviewTab report={report} />}
        {tab === 'Conditions' && <ConditionsTab report={report} />}
        {tab === 'Hazards' && <HazardsTab report={report} alerts={alerts} />}
        {tab === 'Forecast' && <ForecastTab report={report} />}
        {tab === 'Guide' && <GuideTab spot={spot} />}

        <View style={{ height: spacing.xxl }} />
        <Text style={typography.h3}>Friends' Reports</Text>
        <View style={{ height: spacing.md }} />
        {(community.length ? community : []).map((c) => {
          const adapter: DiveReport = {
            id: c.id ?? `${c.userId}_${c.loggedAt}`,
            authorInitials: (c.displayName || '??').split(' ').map((s) => s[0]).join('').slice(0, 2),
            authorName: c.displayName,
            spotName: c.spotName,
            postedAgo: relativeTime(c.loggedAt),
            diveType: c.diveType,
            depthFt: c.reportedVisibilityFt ?? c.depthFt ?? 0,
            current: (c.reportedCurrent ?? 'NONE') as DiveReport['current'],
            surface: (c.reportedEntryCondition ?? 'SAFE') as DiveReport['surface'],
            visibility: (c.waterQuality ?? 'CLEAN') as DiveReport['visibility'],
            comment: c.notes ?? '',
            likes: c.likesCount ?? 0,
            replies: c.commentsCount ?? 0,
          };
          return (
            <View key={adapter.id} style={{ marginBottom: spacing.md }}>
              <DiveReportCard
                report={adapter}
                onPress={() => nav.navigate('DiveReportDetail', { reportId: adapter.id })}
              />
            </View>
          );
        })}
        {community.length === 0 &&
          mockDiveReports.map((rep) => (
            <View key={rep.id} style={{ marginBottom: spacing.md }}>
              <DiveReportCard
                report={rep}
                onPress={() => nav.navigate('DiveReportDetail', { reportId: rep.id })}
              />
            </View>
          ))}

        <View style={{ height: spacing.xxl }} />
        <Button label="Log Your Dive" variant="outline" fullWidth onPress={() => nav.navigate('LogDive')} />
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function RatingHeader({ report }: { report: SpotReportDoc | null }) {
  const liveRating = report?.now?.rating?.rating ?? electricBeachReport.ratingLabel;
  const cautionNote = report?.now?.rating?.cautionNote ?? electricBeachReport.hazardSummary;
  const ratingDotColor = (() => {
    switch (ratingToCondition(liveRating)) {
      case 'excellent': return colors.excellent;
      case 'good':      return colors.warn;
      case 'caution':   return colors.warn;
      case 'hazard':    return colors.hazard;
    }
  })();
  return (
    <Card>
      <View style={ratingStyles.headerRow}>
        <View style={ratingStyles.dotWrap}>
          <View style={[ratingStyles.dot, { backgroundColor: ratingDotColor }]} />
          <Text style={[typography.h1, { fontSize: 32 }]}>{liveRating?.toUpperCase()}</Text>
        </View>
        <Tag variant="live" dot />
      </View>
      <Text style={[typography.bodySm, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        {cautionNote}
      </Text>
    </Card>
  );
}

function ForecastStrip({ report }: { report: SpotReportDoc | null }) {
  const windows = report?.windows?.slice(0, 4) ?? [];
  if (!windows.length) {
    return null;
  }
  return (
    <View style={forecastStyles.strip}>
      <Text style={typography.caption}>NEXT 12 HOURS</Text>
      <View style={forecastStyles.daysRow}>
        {windows.map((w, i) => {
          const active = i === 0;
          const start = new Date(w.startIso);
          const label = start.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'Pacific/Honolulu' });
          const dotColor = (() => {
            switch (ratingToCondition(w.rating?.rating)) {
              case 'excellent': return colors.excellent;
              case 'good':      return colors.warn;
              case 'caution':   return colors.warn;
              case 'hazard':    return colors.hazard;
            }
          })();
          return (
            <View key={w.startIso} style={[forecastStyles.day, active && forecastStyles.dayActive]}>
              <Text style={[forecastStyles.dayLabel, active && { color: colors.textPrimary }]}>{label}</Text>
              <Text style={[forecastStyles.dayDate, active && { color: colors.textPrimary }]}>
                {Math.round(w.rating?.score ?? 0)}
              </Text>
              <View style={[forecastStyles.dot, { backgroundColor: dotColor }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function OverviewTab({ report }: { report: SpotReportDoc | null }) {
  const m = report?.now?.metrics;
  const visibilityFt = report?.now?.visibility?.estimatedVisibilityFeet ?? electricBeachReport.visibilityFt;
  const swellFt = m?.waveHeightM != null ? mToFt(m.waveHeightM) : electricBeachReport.swellHeightFt;
  const waterTempF = m?.waterTempC != null ? cToF(m.waterTempC) : electricBeachReport.waterTempF;
  const airTempF = m?.airTempC != null ? cToF(m.airTempC) : electricBeachReport.airTempF;
  const windMph = m?.windSpeedKts != null ? ktsToMph(m.windSpeedKts) : electricBeachReport.windMph;
  const gustMph = m?.windGustKts != null ? ktsToMph(m.windGustKts) : electricBeachReport.gustMph;
  const windDir = m?.windDeg != null ? windDegToDir(m.windDeg) : 'NE';
  const tide = report?.now?.tide ?? null;
  const tideSeries: TidePoint[] = electricBeachReport.tide.series; // fallback shape

  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader report={report} />
      <ForecastStrip report={report} />

      <Row>
        <MetricCard label="WATER CLARITY" value={String(Math.round(visibilityFt))} unit="FT" sub="VISIBILITY" />
        <MetricCard label="WAVE HEIGHT" value={swellFt.toFixed(1)} unit="FT" sub="SWELL HEIGHT" />
      </Row>

      <TideChart
        series={tideSeries}
        trend={tide?.currentTideState === 'rising' ? 'rising' : 'falling'}
        nowFt={tide?.currentTideHeight ?? electricBeachReport.tide.nowFt}
        nextLabel={
          tide?.highTideTime
            ? `High at ${new Date(tide.highTideTime).toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'Pacific/Honolulu' })}`
            : electricBeachReport.tide.nextLabel
        }
        nextFt={tide?.highTideHeight ?? electricBeachReport.tide.nextFt}
      />

      <Row>
        <MetricCard label="WATER TEMP" value={String(Math.round(waterTempF))} unit="°F" sub="3MM WETSUIT" />
        <MetricCard label="WIND" value={String(Math.round(windMph))} unit="MPH" sub={`${Math.round(gustMph)} MPH GUST · ${windDir}`}>
          <View style={styles.dialOverlay}>
            <CompassDial size={70} bearing={m?.windDeg ?? 60} />
          </View>
        </MetricCard>
      </Row>

      <Row>
        <MetricCard label="AIR TEMP" value={String(Math.round(airTempF))} unit="°F" sub={cloudCoverLabel(m?.cloudCoverPercent)} />
        <MetricCard
          label="WATER QUALITY"
          value={runoffToWaterQuality(report?.now?.analysis?.runoff?.severity)}
          sub={report?.now?.analysis?.runoff?.healthRisk ?? 'Within normal range'}
        />
      </Row>
    </View>
  );
}

function ConditionsTab({ report }: { report: SpotReportDoc | null }) {
  const m = report?.now?.metrics;
  const visibilityFt = report?.now?.visibility?.estimatedVisibilityFeet ?? electricBeachReport.visibilityFt;
  const swellFt = m?.waveHeightM != null ? mToFt(m.waveHeightM) : electricBeachReport.swellHeightFt;
  const waterTempF = m?.waterTempC != null ? cToF(m.waterTempC) : electricBeachReport.waterTempF;
  const airTempF = m?.airTempC != null ? cToF(m.airTempC) : electricBeachReport.airTempF;
  const windMph = m?.windSpeedKts != null ? ktsToMph(m.windSpeedKts) : electricBeachReport.windMph;
  const moon = report?.now?.analysis?.moon;

  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader report={report} />
      <ForecastStrip report={report} />

      <Row>
        <MetricCard label="WATER CLARITY" value={String(Math.round(visibilityFt))} unit="FT" sub="VISIBILITY" />
        <MetricCard label="WAVE HEIGHT" value={swellFt.toFixed(1)} unit="FT" sub={`${m?.wavePeriodS ? Math.round(m.wavePeriodS) : '–'}s period`} />
      </Row>

      <Row>
        <MetricCard label="WATER TEMP" value={String(Math.round(waterTempF))} unit="°F" sub="3MM WETSUIT" />
        <MetricCard label="AIR TEMP" value={String(Math.round(airTempF))} unit="°F" sub={cloudCoverLabel(m?.cloudCoverPercent)} />
      </Row>

      <Card>
        <Text style={typography.caption}>MOON INFO</Text>
        <View style={moonStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { marginTop: spacing.sm }]}>
              {moon?.moonPhase ?? electricBeachReport.moon.phase}
            </Text>
            <View style={moonStyles.metricsRow}>
              <View>
                <Text style={typography.h2}>
                  {moon ? Math.round(moon.moonIllumination * 100) : Math.round(electricBeachReport.moon.illumination * 100)}%
                </Text>
                <Text style={moonStyles.cap}>ILLUMINATION</Text>
              </View>
              <View>
                <Text style={typography.h2}>
                  {moon?.daysSinceFullMoon ?? electricBeachReport.moon.daysSinceFullMoon}
                </Text>
                <Text style={moonStyles.cap}>DAYS SINCE FULL MOON</Text>
              </View>
            </View>
            <Text style={moonStyles.note}>
              {report?.now?.analysis?.jellyfish?.nightDiveNote ??
                'Night diving not recommended based on current conditions'}
            </Text>
          </View>
          <View style={moonStyles.moon}>
            <Icon name="moon" size={56} color={colors.textPrimary} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={typography.caption}>CONFIDENCE</Text>
        <View style={{ height: spacing.md }} />
        <RatingBar value={(report?.now?.confidenceScore ?? 0.7) * 10} max={10} caption="Data quality" />
      </Card>

      {report?.now?.rating?.cautionNote && (
        <Card>
          <Text style={typography.caption}>CAUTION</Text>
          <Text style={[typography.body, { marginTop: spacing.sm, color: colors.textSecondary }]}>
            {report.now.rating.cautionNote}
          </Text>
        </Card>
      )}

      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
        Wind: {Math.round(windMph)} MPH · {m?.windDeg != null ? windDegToDir(m.windDeg) : '–'}
      </Text>
    </View>
  );
}

function HazardsTab({ report, alerts }: { report: SpotReportDoc | null; alerts: ReturnType<typeof useAlerts>['alerts'] }) {
  const runoff = report?.now?.analysis?.runoff;
  const jelly = report?.now?.analysis?.jellyfish;
  const swellFt = report?.now?.metrics?.waveHeightM != null
    ? mToFt(report.now.metrics.waveHeightM)
    : null;

  const items: { label: string; status: 'low' | 'mod' | 'high'; note?: string }[] = [
    {
      label: 'Runoff / Brown Water',
      status:
        runoff?.severity === 'high' || runoff?.severity === 'extreme' ? 'high'
          : runoff?.severity === 'moderate' ? 'mod'
          : 'low',
      note: runoff?.drivers?.join(' · '),
    },
    {
      label: 'Strong Current',
      status: report?.now?.metrics?.windSpeedKts != null && report.now.metrics.windSpeedKts * 0.04 > 1.5 ? 'high' : 'low',
    },
    {
      label: 'Jellyfish',
      status: jelly?.jellyfishWarning ? 'mod' : 'low',
      note: jelly?.jellyfishNote,
    },
    {
      label: 'High Swell',
      status: swellFt != null && swellFt > 5 ? 'high' : swellFt != null && swellFt > 3 ? 'mod' : 'low',
      note: swellFt != null ? `${swellFt.toFixed(1)} ft` : undefined,
    },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader report={report} />
      <Card>
        <Text style={typography.caption}>HAZARD CHECK</Text>
        <View style={{ height: spacing.md }} />
        {items.map((h) => (
          <View key={h.label} style={hazardStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{h.label}</Text>
              {h.note ? <Text style={[typography.bodySm, { color: colors.textSecondary }]}>{h.note}</Text> : null}
            </View>
            <Tag
              variant={h.status === 'low' ? 'excellent' : h.status === 'mod' ? 'warn' : 'hazard'}
              label={h.status === 'low' ? 'LOW' : h.status === 'mod' ? 'MODERATE' : 'HIGH'}
              dot
            />
          </View>
        ))}
      </Card>
      {alerts.length > 0 && (
        <Card>
          <Text style={typography.caption}>ACTIVE ADVISORIES</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {alerts.map((a) => (
              <Text key={a.id} style={[typography.body, { color: colors.textPrimary }]}>
                • {a.message}
              </Text>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

function ForecastTab({ report }: { report: SpotReportDoc | null }) {
  const windows = report?.windows ?? [];
  if (!windows.length) {
    return (
      <View style={{ gap: spacing.md }}>
        <Card>
          <Text style={typography.caption}>FORECAST</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            No forecast available for this spot yet. Pull-to-refresh once the pipeline has run.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={typography.caption}>NEXT 24 HOURS</Text>
        <View style={{ height: spacing.md }} />
        {windows.map((w) => {
          const start = new Date(w.startIso);
          const label = start.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'Pacific/Honolulu' });
          const ratingVar = ratingTagVariant(w.rating?.rating);
          const score = Math.round(w.rating?.score ?? 0);
          return (
            <View key={w.startIso} style={forecastStyles.row}>
              <Text style={[typography.h3, { width: 60 }]}>{label}</Text>
              <Text style={[typography.body, { width: 50 }]}>
                {w.avg?.airTempC != null ? `${Math.round(cToF(w.avg.airTempC))}°` : '–'}
              </Text>
              <Text style={[typography.body, { width: 60 }]}>
                {w.avg?.waveHeightM != null ? `${mToFt(w.avg.waveHeightM).toFixed(1)} ft` : '–'}
              </Text>
              <Text style={[typography.body, { width: 60 }]}>
                {w.avg?.windSpeedKts != null ? `${Math.round(ktsToMph(w.avg.windSpeedKts))} mph` : '–'}
              </Text>
              <View style={{ flex: 1 }}>
                <View style={forecastStyles.bar}>
                  <View
                    style={[
                      forecastStyles.barFill,
                      {
                        width: `${Math.min(100, Math.max(8, score))}%`,
                        backgroundColor:
                          ratingVar === 'excellent' ? colors.excellent
                            : ratingVar === 'good'  ? colors.good
                            : ratingVar === 'warn'  ? colors.warn
                            : colors.hazard,
                      },
                    ]}
                  />
                </View>
              </View>
              <Tag variant={ratingVar} dot />
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function GuideTab({ spot }: { spot: ReturnType<typeof useSpot>['spot'] }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={typography.caption}>SPOT GUIDE</Text>
        <Text style={[typography.h3, { marginTop: spacing.sm }]}>{spot?.name ?? 'Spot details'}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
          {spot?.guideText ??
            'A warm-water outflow channel from the Kahe power plant attracts pelagic species year-round. Best in the morning before tradewinds pick up.'}
        </Text>
      </Card>

      <Card>
        <Text style={typography.caption}>IDEAL CONDITIONS</Text>
        <Text style={[typography.body, { marginTop: spacing.sm }]}>
          {spot?.idealConditionsText ?? 'Best in calm summer swells under 2 ft with offshore wind.'}
        </Text>
      </Card>

      <Card>
        <Text style={typography.caption}>QUICK FACTS</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Fact label="Entry" value={spot?.entryType ?? 'Shore'} />
          <Fact label="Ability" value={spot?.abilityLevel ?? 'Intermediate'} />
          <Fact label="Max depth" value={spot?.maxDepthFt ? `${spot.maxDepthFt} ft` : '45 ft'} />
          <Fact label="Best time" value={spot?.bestTimeOfDay ?? 'Early morning'} />
          {spot?.parkingNotes ? <Fact label="Parking" value={spot.parkingNotes} /> : null}
        </View>
      </Card>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[typography.bodySm, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: { paddingBottom: spacing.xl, paddingHorizontal: 0, minHeight: 230 },
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
});

const ratingStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dotWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 999 },
});

const moonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: spacing.xxl, marginTop: spacing.md },
  cap: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  note: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.md, lineHeight: 18 },
  moon: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const hazardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
});

const forecastStyles = StyleSheet.create({
  strip: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.sm },
  day: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  dayActive: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  dayLabel: { ...typography.caption, color: colors.textMuted },
  dayDate: { ...typography.h3, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 999, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  bar: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
});
