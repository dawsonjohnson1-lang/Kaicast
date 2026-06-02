// SpotListCard — single row in the /charter/spots list. Reads its
// own forecast via useSpotReport so each card lights up independently.
// Sparkline = 7 colored cells (one per day), one row, matching the
// readiness-calendar styling. Best window callout points the captain
// at the next viable day.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useSpotReport } from '../data/getReport';
import { tiersFromReport, bestUpcomingWindow, bestWindowLabel, TIER_COLOR } from './spotForecast';
import { setGoodWindowAlertsEnabled } from './saveCharterSpot';
import type { CharterSpot } from './types';

export function SpotListCard({
  orgId,
  spot,
  onEdit,
}: {
  orgId: string;
  spot: CharterSpot;
  onEdit: () => void;
}) {
  // Prefer the linked public spot id so the sparkline reads from the
  // canonical kaicast_reports doc; fall back to the spot's own id.
  const reportSpotId = spot.linkedPublicSpotId ?? spot.id;
  const { data: report, loading } = useSpotReport(reportSpotId);
  const tiers = React.useMemo(() => tiersFromReport(report), [report]);
  const best = React.useMemo(() => bestUpcomingWindow(tiers), [tiers]);

  const [alertBusy, setAlertBusy] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);

  const toggleAlert = async () => {
    if (alertBusy) return;
    setAlertBusy(true);
    setAlertError(null);
    try {
      await setGoodWindowAlertsEnabled(orgId, spot.id, !spot.goodWindowAlertsEnabled);
    } catch (e) {
      setAlertError((e as Error).message || 'Could not toggle alert');
    } finally {
      setAlertBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{spot.name}</Text>
            {spot.isPrivate ? (
              <View style={styles.privateChip}><Text style={styles.privateText}>PRIVATE</Text></View>
            ) : null}
            {spot.linkedPublicSpotId ? (
              <View style={styles.linkedChip}><Text style={styles.linkedText}>↗ linked</Text></View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{spot.depthFt > 0 ? `${spot.depthFt} ft` : '— ft'}</Text>
            <Text style={styles.meta}>tide: {spot.tidePreference}</Text>
            <Text style={styles.meta}>max {spot.maxGroupSize || '—'} divers</Text>
          </View>
          {spot.tripTypes.length > 0 ? (
            <View style={styles.tagsRow}>
              {spot.tripTypes.map((t) => (
                <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Alert toggle + edit */}
        <View style={styles.actionsCol}>
          <Pressable
            onPress={toggleAlert}
            disabled={alertBusy}
            style={[styles.alertBtn, spot.goodWindowAlertsEnabled && styles.alertBtnOn]}
          >
            <Text style={[styles.alertText, spot.goodWindowAlertsEnabled && styles.alertTextOn]}>
              {alertBusy ? '…' : spot.goodWindowAlertsEnabled ? '🔔 ON' : '🔕 OFF'}
            </Text>
          </Pressable>
          <Pressable onPress={onEdit} style={styles.editBtn}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>
      </View>

      {/* Sparkline + best window */}
      <View style={styles.forecastRow}>
        <View style={styles.sparkline}>
          {loading ? (
            <Text style={styles.sparkPlaceholder}>Reading forecast…</Text>
          ) : tiers.length === 0 ? (
            <Text style={styles.sparkPlaceholder}>
              {spot.linkedPublicSpotId ? 'No forecast data — backend may be cold.' : 'Link to a public spot for forecast data.'}
            </Text>
          ) : (
            tiers.slice(0, 7).map((tier, i) => (
              <View key={i} style={[styles.sparkCell, { backgroundColor: TIER_COLOR[tier] }]}>
                <Text style={styles.sparkLabel}>{dayLabel(i)}</Text>
              </View>
            ))
          )}
        </View>
        {tiers.length > 0 ? (
          <View style={styles.bestWindowWrap}>
            <Text style={styles.bestWindowLabel}>BEST WINDOW</Text>
            <Text style={styles.bestWindowValue}>{bestWindowLabel(best)}</Text>
          </View>
        ) : null}
      </View>

      {alertError ? <Text style={styles.alertError}>{alertError}</Text> : null}

      {spot.notes ? (
        <Text style={styles.notes} numberOfLines={2}>{spot.notes}</Text>
      ) : null}
    </View>
  );
}

function dayLabel(i: number): string {
  if (i === 0) return 'TODAY';
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  privateChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.hairlineStrong },
  privateText: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.text3 },
  linkedChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(9,161,251,0.10)', borderWidth: 1, borderColor: colors.accent },
  linkedText: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.accent },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  meta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.surface1 },
  tagText: { fontFamily: fonts.body, fontSize: 11, color: colors.text2, fontWeight: '600' },

  actionsCol: { gap: 6, alignItems: 'flex-end' },
  alertBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  alertBtnOn: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  alertText: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', color: colors.text3, letterSpacing: 0.5 },
  alertTextOn: { color: colors.accent },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  editText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },

  forecastRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  sparkline: { flex: 1, flexDirection: 'row', gap: 4, minHeight: 38 },
  sparkCell: { flex: 1, padding: 6, borderRadius: 4, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  sparkLabel: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', color: '#0A1622', letterSpacing: 0.4 },
  sparkPlaceholder: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },

  bestWindowWrap: { gap: 2, alignItems: 'flex-end' },
  bestWindowLabel: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '700', color: colors.text3, letterSpacing: 1 },
  bestWindowValue: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text1 },

  notes: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },
  alertError: { fontFamily: fonts.body, fontSize: 11, color: '#F73726' },
});
