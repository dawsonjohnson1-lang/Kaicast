import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { SPOTS, fetchCurrentReports } from '../services/spots';
import { COLORS, RATING_COLORS, RATING_EMOJI } from '../constants/theme';

function getRatingColor(rating) {
  return RATING_COLORS[rating] || COLORS.gray;
}

function formatVisibility(report) {
  const vis = report?.now?.visibility?.estimatedVisibilityFeet;
  if (!vis) return '--';
  return `${Math.round(vis)} ft`;
}

function formatWave(report) {
  const waveM = report?.now?.metrics?.waveHeightM;
  if (!waveM) return '--';
  const waveFt = (waveM * 3.281).toFixed(1);
  return `${waveFt} ft`;
}

function formatWind(report) {
  const kts = report?.now?.metrics?.windSpeedKts;
  if (!kts) return '--';
  return `${Math.round(kts)} kts`;
}

function formatTemp(report) {
  const c = report?.now?.metrics?.waterTempC;
  if (!c) return '--';
  const f = (c * 9 / 5 + 32).toFixed(0);
  return `${f}°F`;
}

function SpotCard({ spot, report, onPress }) {
  const rating = report?.now?.rating?.text;
  const score = report?.now?.rating?.rating;
  const ratingColor = getRatingColor(rating);
  const emoji = RATING_EMOJI[rating] || '🌊';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.ratingBadge, { backgroundColor: ratingColor }]}>
        <Text style={styles.ratingEmoji}>{emoji}</Text>
        <Text style={styles.ratingText}>{rating || 'No data'}</Text>
        {score != null && <Text style={styles.ratingScore}>{score}/100</Text>}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.spotName}>{spot.name}</Text>
          <Text style={styles.coastLabel}>{spot.coast}</Text>
        </View>

        {report ? (
          <View style={styles.metricsRow}>
            <Metric icon="👁" label="Visibility" value={formatVisibility(report)} />
            <Metric icon="🌊" label="Waves" value={formatWave(report)} />
            <Metric icon="💨" label="Wind" value={formatWind(report)} />
            <Metric icon="🌡" label="Water" value={formatTemp(report)} />
          </View>
        ) : (
          <Text style={styles.noData}>No current data</Text>
        )}

        {report?.now?.analysis?.runoff?.severity &&
          report.now.analysis.runoff.severity !== 'none' && (
            <View style={styles.runoffBanner}>
              <Text style={styles.runoffText}>
                ⚠️ Runoff: {report.now.analysis.runoff.severity}
              </Text>
            </View>
          )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function Metric({ icon, label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchCurrentReports();
      setReports(data);
    } catch (e) {
      setError('Failed to load conditions. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.ocean} />
        <Text style={styles.loadingText}>Loading conditions...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.oceanDark} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>KaiCast</Text>
        <Text style={styles.headerSubtitle}>Oahu Dive & Snorkel Forecast</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={SPOTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ocean} />
        }
        renderItem={({ item }) => (
          <SpotCard
            spot={item}
            report={reports[item.id]}
            onPress={() => navigation.navigate('SpotDetail', { spot: item })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.offWhite },
  loadingText: { marginTop: 12, color: COLORS.gray, fontSize: 15 },
  header: {
    backgroundColor: COLORS.oceanDark,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  headerSubtitle: { fontSize: 13, color: COLORS.oceanLight, marginTop: 2 },
  errorBanner: { backgroundColor: COLORS.coral, padding: 12, alignItems: 'center' },
  errorText: { color: COLORS.white, fontSize: 13 },
  list: { padding: 12, gap: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  ratingBadge: {
    width: 72,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  ratingEmoji: { fontSize: 22 },
  ratingText: { color: COLORS.white, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  ratingScore: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  spotName: { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  coastLabel: { fontSize: 11, color: COLORS.gray, backgroundColor: COLORS.grayLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', flex: 1 },
  metricIcon: { fontSize: 14 },
  metricValue: { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginTop: 2 },
  metricLabel: { fontSize: 10, color: COLORS.gray, marginTop: 1 },
  noData: { color: COLORS.gray, fontSize: 13, fontStyle: 'italic' },
  runoffBanner: { backgroundColor: '#FFF3CD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  runoffText: { fontSize: 12, color: '#856404' },
  chevron: { fontSize: 24, color: COLORS.grayLight, paddingRight: 14 },
});
