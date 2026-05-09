import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Tag } from '@/components/Tag';
import { Card } from '@/components/Card';
import { MetricCard } from '@/components/MetricCard';
import { RatingBar } from '@/components/RatingBar';
import { TideChart } from '@/components/TideChart';
import { CompassDial } from '@/components/CompassDial';
import { Button } from '@/components/Button';
import { DiveReportCard } from '@/components/DiveReportCard';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography, RATING_COLORS } from '@/theme';
import { electricBeachReport, diveReports } from '@/api/mockData';
import type { RootNav } from '@/navigation/types';
import type { ConditionRating } from '@/types';

type SpotTab = 'Overview' | 'Conditions' | 'Hazards' | 'Forecast' | 'Guide';

const TABS: SpotTab[] = ['Overview', 'Conditions', 'Hazards', 'Forecast', 'Guide'];

export function SpotDetailScreen() {
  const nav = useNavigation<RootNav>();
  const [tab, setTab] = useState<SpotTab>('Overview');

  const r = electricBeachReport;

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
          <Tag variant="freedive" label="OAHU" />
          <Text style={[typography.display, { marginTop: spacing.md }]}>{r.spot.name}</Text>
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

        {tab === 'Overview' && <OverviewTab />}
        {tab === 'Conditions' && <ConditionsTab />}
        {tab === 'Hazards' && <HazardsTab />}
        {tab === 'Forecast' && <ForecastTab />}
        {tab === 'Guide' && <GuideTab />}

        <View style={{ height: spacing.xxl }} />
        <Text style={typography.h3}>Friends' Reports</Text>
        <View style={{ height: spacing.md }} />
        {diveReports.map((rep) => (
          <View key={rep.id} style={{ marginBottom: spacing.md }}>
            <DiveReportCard report={rep} onPress={() => nav.navigate('DiveReportDetail', { reportId: rep.id })} />
          </View>
        ))}

        <View style={{ height: spacing.xxl }} />
        <Button label="Log Your Dive" variant="outline" fullWidth onPress={() => nav.navigate('LogDive')} />
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </Screen>
  );
}

function OverviewTab() {
  const r = electricBeachReport;
  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader />
      <ForecastStrip />

      <Row>
        <MetricCard label="WATER CLARITY" value={String(r.visibilityFt)} unit="FT" sub="VISIBILITY" />
        <MetricCard label="WAVE HEIGHT" value={String(r.swellHeightFt)} unit="FT" sub="SWELL HEIGHT" />
      </Row>

      <TideChart series={r.tide.series} trend={r.tide.trend} nowFt={r.tide.nowFt} nextLabel={r.tide.nextLabel} nextFt={r.tide.nextFt} />

      <Row>
        <MetricCard label="WATER TEMP" value={String(r.waterTempF)} unit="°F" sub="3MM WETSUIT" />
        <MetricCard label="CURRENT" value={String(r.currentMph)} unit="MPH" sub="NON-EXISTENT">
          <View style={styles.dialOverlay}>
            <CompassDial size={70} bearing={45} />
          </View>
        </MetricCard>
      </Row>

      <Card>
        <Text style={typography.caption}>UV RATING</Text>
        <View style={{ height: spacing.md }} />
        <RatingBar value={r.uvIndex} max={11} />
      </Card>

      <Row>
        <MetricCard label="AIR TEMP" value={String(r.airTempF)} unit="°F" sub="AIR TEMP" />
        <MetricCard label="WIND" value={String(r.windMph)} unit="MPH" sub={`${r.gustMph} MPH GUST`}>
          <View style={styles.dialOverlay}>
            <CompassDial size={70} bearing={120} />
          </View>
        </MetricCard>
      </Row>
    </View>
  );
}

function ConditionsTab() {
  const r = electricBeachReport;
  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader />
      <ForecastStrip />

      <Row>
        <MetricCard label="WATER CLARITY" value={String(r.visibilityFt)} unit="FT" sub="VISIBILITY" />
        <MetricCard label="WAVE HEIGHT" value={String(r.swellHeightFt)} unit="FT" sub="SWELL HEIGHT" />
      </Row>

      <Card>
        <Text style={typography.caption}>UV RATING</Text>
        <View style={{ height: spacing.md }} />
        <RatingBar value={r.uvIndex} max={11} />
      </Card>

      <Row>
        <MetricCard label="WATER TEMP" value={String(r.waterTempF)} unit="°F" sub="3MM WETSUIT" />
        <MetricCard label="CURRENT" value={String(r.currentMph)} unit="MPH" sub="NON-EXISTENT" />
      </Row>

      <TideChart series={r.tide.series} trend={r.tide.trend} nowFt={r.tide.nowFt} nextLabel={r.tide.nextLabel} nextFt={r.tide.nextFt} />

      <Row>
        <MetricCard label="AIR TEMP" value={String(r.airTempF)} unit="°F" sub="AIR TEMP" />
        <MetricCard label="WIND" value={String(r.windMph)} unit="MPH" sub={`${r.gustMph} MPH GUST`} />
      </Row>

      <Card>
        <Text style={typography.caption}>MOON INFO</Text>
        <View style={moonStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h2, { marginTop: spacing.sm }]}>{r.moon.phase}</Text>
            <View style={moonStyles.metricsRow}>
              <View>
                <Text style={typography.h2}>{r.moon.illumination}</Text>
                <Text style={moonStyles.cap}>ILLUMINATION RATING</Text>
              </View>
              <View>
                <Text style={typography.h2}>{r.moon.daysSinceFullMoon}</Text>
                <Text style={moonStyles.cap}>DAYS SINCE FULL MOON</Text>
              </View>
            </View>
            <Text style={moonStyles.note}>Night diving not recommended based on current conditions</Text>
          </View>
          <View style={moonStyles.moon}>
            <Icon name="moon" size={56} color={colors.textPrimary} />
          </View>
        </View>
      </Card>
    </View>
  );
}

function HazardsTab() {
  return (
    <View style={{ gap: spacing.md }}>
      <RatingHeader />
      <Card>
        <Text style={typography.caption}>HAZARD CHECK</Text>
        <View style={{ height: spacing.md }} />
        {[
          { label: 'Sharks', status: 'low' },
          { label: 'Jellyfish', status: 'low' },
          { label: 'Strong Current', status: 'mod' },
          { label: 'Sewage / Runoff', status: 'low' },
          { label: 'Rip Current', status: 'low' },
          { label: 'Rocky Entry', status: 'mod' },
        ].map((h) => (
          <View key={h.label} style={hazardStyles.row}>
            <Text style={typography.body}>{h.label}</Text>
            <Tag
              variant={h.status === 'low' ? 'excellent' : h.status === 'mod' ? 'warn' : 'hazard'}
              label={h.status === 'low' ? 'LOW' : h.status === 'mod' ? 'MODERATE' : 'HIGH'}
              dot
            />
          </View>
        ))}
      </Card>
    </View>
  );
}

function ForecastTab() {
  const r = electricBeachReport;
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={typography.caption}>4-DAY FORECAST</Text>
        <View style={{ height: spacing.md }} />
        {r.forecast.map((d) => (
          <View key={d.label} style={forecastStyles.row}>
            <Text style={[typography.h3, { width: 60 }]}>{d.label}</Text>
            <Text style={[typography.body, { width: 40 }]}>{d.date}</Text>
            <View style={{ flex: 1 }}>
              <View style={forecastStyles.bar}>
                <View
                  style={[
                    forecastStyles.barFill,
                    {
                      width: ratingFillWidth(d.rating),
                      backgroundColor: RATING_COLORS[d.rating],
                    },
                  ]}
                />
              </View>
            </View>
            <View style={[forecastStyles.tagDot, { backgroundColor: RATING_COLORS[d.rating] }]} />
          </View>
        ))}
      </Card>

      <TideChart series={r.tide.series} trend={r.tide.trend} nowFt={r.tide.nowFt} nextLabel={r.tide.nextLabel} nextFt={r.tide.nextFt} />
    </View>
  );
}

function GuideTab() {
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={typography.caption}>SPOT GUIDE</Text>
        <Text style={[typography.h3, { marginTop: spacing.sm }]}>Electric Beach</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 }]}>
          A warm-water outflow channel from the Kahe power plant attracts pelagic species year-round. Best in the morning before tradewinds pick up.
        </Text>
      </Card>

      <Card>
        <Text style={typography.caption}>ENTRY & EXIT</Text>
        <Text style={[typography.body, { marginTop: spacing.sm }]}>Sandy beach with rocky shoreline. Enter on either side of the outfall. Watch for surge near the rocks.</Text>
      </Card>

      <Card>
        <Text style={typography.caption}>MARINE LIFE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
          {['Spinner Dolphins', 'Green Sea Turtles', 'Reef Sharks', 'Manta Rays', 'Eagle Rays'].map((m) => (
            <Tag key={m} variant="freedive" label={m} />
          ))}
        </View>
      </Card>
    </View>
  );
}

function RatingHeader() {
  const r = electricBeachReport;
  return (
    <Card>
      <View style={ratingStyles.headerRow}>
        <View style={ratingStyles.dotWrap}>
          <View style={[ratingStyles.dot, { backgroundColor: RATING_COLORS[r.rating] }]} />
          <Text style={[typography.h1, { fontSize: 32 }]}>{r.ratingLabel}</Text>
        </View>
        <Tag variant="live" dot />
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

function ForecastStrip() {
  const r = electricBeachReport;
  return (
    <View style={forecastStyles.strip}>
      <Text style={typography.caption}>4-DAY FORECAST</Text>
      <View style={forecastStyles.daysRow}>
        {r.forecast.map((d, i) => {
          const active = i === 0;
          return (
            <View key={d.label} style={[forecastStyles.day, active && forecastStyles.dayActive]}>
              <Text style={[forecastStyles.dayLabel, active && { color: colors.textPrimary }]}>{d.label}</Text>
              <Text style={[forecastStyles.dayDate, active && { color: colors.textPrimary }]}>{d.date}</Text>
              <View style={[forecastStyles.dot, { backgroundColor: RATING_COLORS[d.rating] }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}

function ratingFillWidth(rating: ConditionRating): `${number}%` {
  switch (rating) {
    case 'excellent': return '92%';
    case 'great':     return '80%';
    case 'good':      return '70%';
    case 'fair':      return '45%';
    case 'no-go':     return '25%';
  }
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
  bar: { flexDirection: 'row', gap: 4, marginTop: spacing.md, height: 8 },
  seg: { flex: 1, borderRadius: 999 },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});

const forecastStyles = StyleSheet.create({
  strip: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.sm },
  day: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.cardAlt },
  dayActive: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  dayLabel: { ...typography.caption, color: colors.textMuted },
  dayDate: { ...typography.h3, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 999, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  bar: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  tagDot: { width: 8, height: 8, borderRadius: 999 },
});
