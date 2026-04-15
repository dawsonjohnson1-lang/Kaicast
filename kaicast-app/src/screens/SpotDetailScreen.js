import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { fetchSpotReport } from '../services/spots';
import { COLORS, RATING_COLORS, RATING_EMOJI } from '../constants/theme';

function formatTime(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Pacific/Honolulu' });
}

function formatDateRange(startIso, endIso) {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Pacific/Honolulu' });
  const endStr = end ? end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Pacific/Honolulu' }) : '';
  return `${startStr}–${endStr}`;
}

function metricFt(meters) {
  if (!meters && meters !== 0) return '--';
  return `${(meters * 3.281).toFixed(1)} ft`;
}

function metricF(celsius) {
  if (!celsius && celsius !== 0) return '--';
  return `${(celsius * 9 / 5 + 32).toFixed(0)}°F`;
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function StatRow({ label, value, highlight }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: COLORS.ocean, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function WindowCard({ window: win }) {
  const rating = win?.rating?.text;
  const color = RATING_COLORS[rating] || COLORS.gray;
  const emoji = RATING_EMOJI[rating] || '🌊';
  const avg = win?.avg || {};

  return (
    <View style={[styles.windowCard, { borderLeftColor: color }]}>
      <View style={styles.windowHeader}>
        <Text style={styles.windowTime}>{formatDateRange(win.startIso, win.endIso)}</Text>
        <View style={[styles.windowBadge, { backgroundColor: color }]}>
          <Text style={styles.windowBadgeText}>{emoji} {rating || '--'}</Text>
        </View>
      </View>

      <View style={styles.windowMetrics}>
        <WindowMetric label="Vis" value={win.visibility?.estimatedVisibilityFeet ? `${Math.round(win.visibility.estimatedVisibilityFeet)} ft` : '--'} />
        <WindowMetric label="Waves" value={metricFt(avg.waveHeightM)} />
        <WindowMetric label="Wind" value={avg.windSpeedKts ? `${Math.round(avg.windSpeedKts)} kts` : '--'} />
        <WindowMetric label="Tide" value={win.tide?.state || '--'} />
      </View>

      {win.runoff?.severity && win.runoff.severity !== 'none' && (
        <Text style={styles.windowRunoff}>⚠️ Runoff: {win.runoff.severity}</Text>
      )}
    </View>
  );
}

function WindowMetric({ label, value }) {
  return (
    <View style={styles.windowMetric}>
      <Text style={styles.windowMetricValue}>{value}</Text>
      <Text style={styles.windowMetricLabel}>{label}</Text>
    </View>
  );
}

function TideSection({ tide }) {
  if (!tide) return null;
  return (
    <View style={styles.tideContainer}>
      <SectionHeader title="🌊 Tide Cycle" />
      <View style={styles.tideRow}>
        <TideMark label="Low" time={tide.lowTide1Time} height={tide.lowTide1Height} />
        <Text style={styles.tideArrow}>→</Text>
        <TideMark label="High" time={tide.highTideTime} height={tide.highTideHeight} />
        <Text style={styles.tideArrow}>→</Text>
        <TideMark label="Low" time={tide.lowTide2Time} height={tide.lowTide2Height} />
      </View>
      {tide.currentState && (
        <Text style={styles.tideCurrent}>Current: {tide.currentState} ({tide.currentHeight ? `${tide.currentHeight.toFixed(2)} ft` : '--'})</Text>
      )}
    </View>
  );
}

function TideMark({ label, time, height }) {
  return (
    <View style={styles.tideMark}>
      <Text style={styles.tideMarkLabel}>{label}</Text>
      <Text style={styles.tideMarkTime}>{time ? new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Pacific/Honolulu' }) : '--'}</Text>
      <Text style={styles.tideMarkHeight}>{height ? `${height.toFixed(1)} ft` : '--'}</Text>
    </View>
  );
}

export default function SpotDetailScreen({ route, navigation }) {
  const { spot } = route.params;
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSpotReport(spot.id);
      setReport(data);
    } catch (e) {
      setError('Failed to load spot data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [spot.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const now = report?.now;
  const metrics = now?.metrics || {};
  const rating = now?.rating?.text;
  const ratingColor = RATING_COLORS[rating] || COLORS.gray;
  const windows = report?.windows || [];
  const tide = now?.tide;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.ocean} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.oceanDark} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{spot.name}</Text>
          <Text style={styles.headerSubtitle}>{spot.coast}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ocean} />}
      >
        {report ? (
          <>
            {/* Current Rating */}
            <View style={[styles.ratingCard, { borderColor: ratingColor }]}>
              <Text style={styles.ratingEmoji}>{RATING_EMOJI[rating] || '🌊'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ratingText, { color: ratingColor }]}>{rating || 'No rating'}</Text>
                {now?.rating?.rating != null && (
                  <Text style={styles.ratingScore}>Score: {now.rating.rating}/100</Text>
                )}
                {now?.rating?.reason && (
                  <Text style={styles.ratingReason}>{now.rating.reason}</Text>
                )}
                {now?.rating?.cautionNote && (
                  <Text style={styles.cautionNote}>⚠️ {now.rating.cautionNote}</Text>
                )}
              </View>
            </View>

            {/* Current Conditions */}
            <SectionHeader title="📊 Current Conditions" />
            <View style={styles.statsCard}>
              <StatRow label="Visibility" value={now?.visibility?.estimatedVisibilityFeet ? `${Math.round(now.visibility.estimatedVisibilityFeet)} ft` : '--'} highlight />
              <StatRow label="Wave Height" value={metricFt(metrics.waveHeightM)} />
              <StatRow label="Wave Period" value={metrics.wavePeriodS ? `${metrics.wavePeriodS}s` : '--'} />
              <StatRow label="Wind" value={metrics.windSpeedKts ? `${Math.round(metrics.windSpeedKts)} kts` : '--'} />
              <StatRow label="Wind Gusts" value={metrics.windGustKts ? `${Math.round(metrics.windGustKts)} kts` : '--'} />
              <StatRow label="Water Temp" value={metricF(metrics.waterTempC)} />
              <StatRow label="Air Temp" value={metricF(metrics.airTempC)} />
            </View>

            {/* Tide */}
            <TideSection tide={tide} />

            {/* Runoff */}
            {now?.analysis?.runoff && (
              <>
                <SectionHeader title="🌧 Runoff & Water Quality" />
                <View style={styles.statsCard}>
                  <StatRow label="Severity" value={now.analysis.runoff.severity || '--'} />
                  <StatRow label="Safe to Enter" value={now.analysis.runoff.safeToEnter ? 'Yes' : 'No'} />
                  <StatRow label="Health Risk" value={now.analysis.runoff.healthRisk || '--'} />
                  <StatRow label="Water Quality" value={now.analysis.runoff.waterQualityFeel || '--'} />
                </View>
              </>
            )}

            {/* Moon */}
            {now?.analysis?.moon && (
              <>
                <SectionHeader title="🌙 Moon" />
                <View style={styles.statsCard}>
                  <StatRow label="Phase" value={now.analysis.moon.moonPhase || '--'} />
                  <StatRow label="Illumination" value={now.analysis.moon.moonIllumination ? `${Math.round(now.analysis.moon.moonIllumination * 100)}%` : '--'} />
                </View>
              </>
            )}

            {/* Forecast Windows */}
            {windows.length > 0 && (
              <>
                <SectionHeader title="📅 8-Window Forecast" />
                {windows.map((win, i) => (
                  <WindowCard key={i} window={win} />
                ))}
              </>
            )}
          </>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.noDataText}>No data available for this spot right now.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  noDataText: { color: COLORS.gray, fontSize: 15, textAlign: 'center' },
  header: {
    backgroundColor: COLORS.oceanDark,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: { paddingRight: 4 },
  backText: { color: COLORS.oceanLight, fontSize: 18 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  headerSubtitle: { fontSize: 12, color: COLORS.oceanLight, marginTop: 2 },
  errorBanner: { backgroundColor: COLORS.coral, padding: 12, alignItems: 'center' },
  errorText: { color: COLORS.white, fontSize: 13 },
  scroll: { padding: 14, paddingBottom: 40 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: COLORS.dark, marginTop: 18, marginBottom: 8 },
  ratingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  ratingEmoji: { fontSize: 36 },
  ratingText: { fontSize: 22, fontWeight: '800' },
  ratingScore: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  ratingReason: { fontSize: 13, color: COLORS.text, marginTop: 6, lineHeight: 18 },
  cautionNote: { fontSize: 12, color: '#856404', marginTop: 6, backgroundColor: '#FFF3CD', padding: 8, borderRadius: 8 },
  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  statLabel: { fontSize: 14, color: COLORS.gray },
  statValue: { fontSize: 14, color: COLORS.dark, fontWeight: '500' },
  tideContainer: {},
  tideRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 14, padding: 16, justifyContent: 'space-around' },
  tideArrow: { fontSize: 20, color: COLORS.ocean },
  tideMark: { alignItems: 'center' },
  tideMarkLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },
  tideMarkTime: { fontSize: 14, color: COLORS.dark, fontWeight: '700', marginTop: 4 },
  tideMarkHeight: { fontSize: 12, color: COLORS.ocean, marginTop: 2 },
  tideCurrent: { textAlign: 'center', fontSize: 12, color: COLORS.gray, marginTop: 8 },
  windowCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  windowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  windowTime: { fontSize: 13, fontWeight: '600', color: COLORS.dark },
  windowBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  windowBadgeText: { fontSize: 12, color: COLORS.white, fontWeight: '600' },
  windowMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  windowMetric: { alignItems: 'center' },
  windowMetricValue: { fontSize: 13, fontWeight: '700', color: COLORS.dark },
  windowMetricLabel: { fontSize: 10, color: COLORS.gray, marginTop: 2 },
  windowRunoff: { fontSize: 12, color: '#856404', marginTop: 10, backgroundColor: '#FFF3CD', padding: 6, borderRadius: 6 },
});
