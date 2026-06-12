// CharterTwoDayForecast — TODAY + TOMORROW per-vessel condition read for
// the mobile charter dashboards. For each spot the vessel is running that
// day (from the day's trips) it renders a vessel-type-sensitive summary +
// data-backed chips, sourced from the REAL getReport pipeline
// (useCharterSpotReport → dayConditions). Mirrors the desktop
// DayForecastSection.
//
// NOTE: the mobile fleet is still the useCharterRole mock (Stage 2 will
// wire real Firestore vessels). Conditions are live; the vessel + trips
// are mock until then.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { useCharterSpotReport } from '@/charter/useCharterSpotReport';
import { dayConditions, type DayConditions } from '@/charter/reportConditions';
import { vesselFactors } from '@/charter/vesselFactors';
import { buildChips, type ChipTone } from '@/charter/conditionChips';
import { summaryFor } from '@/charter/vesselSummary';
import type { Trip, Vessel } from '@/types/charter';

const HST_OFFSET_MS = -10 * 60 * 60 * 1000;
function hstDateKey(ms: number): string {
  const s = new Date(ms + HST_OFFSET_MS);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;
}

export function CharterTwoDayForecast({
  vessel,
  trips,
  onSetVesselType,
}: {
  vessel: Vessel;
  trips: Trip[];
  onSetVesselType?: () => void;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <DaySection label="Today" dayOffset={0} vessel={vessel} trips={trips} onSetVesselType={onSetVesselType} />
      <DaySection label="Tomorrow" dayOffset={1} vessel={vessel} trips={trips} onSetVesselType={onSetVesselType} />
    </View>
  );
}

function DaySection({
  label, dayOffset, vessel, trips, onSetVesselType,
}: {
  label: string;
  dayOffset: number;
  vessel: Vessel;
  trips: Trip[];
  onSetVesselType?: () => void;
}) {
  const targetKey = hstDateKey(Date.now() + dayOffset * 86400000);
  const dateLabel = new Date(Date.now() + dayOffset * 86400000).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu',
  });

  // Operating spots that day (unique by spotId), from the day's trips.
  const spots = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of trips) {
      if (hstDateKey(t.date.getTime()) !== targetKey) continue;
      if (!seen.has(t.spotId)) seen.set(t.spotId, t.spotName);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [trips, targetKey]);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayKicker}>{label.toUpperCase()}</Text>
        <Text style={styles.dayDate}>{dateLabel}</Text>
      </View>
      {spots.length === 0 ? (
        <View style={styles.quiet}>
          <Text style={styles.quietText}>No trips on the board for {label.toLowerCase()}.</Text>
        </View>
      ) : (
        spots.map((s) => (
          <SpotBlock key={s.id} spotId={s.id} spotName={s.name} dayOffset={dayOffset} vessel={vessel} onSetVesselType={onSetVesselType} />
        ))
      )}
    </View>
  );
}

function SpotBlock({
  spotId, spotName, dayOffset, vessel, onSetVesselType,
}: {
  spotId: string;
  spotName: string;
  dayOffset: number;
  vessel: Vessel;
  onSetVesselType?: () => void;
}) {
  const { data, loading } = useCharterSpotReport(spotId);
  const cond = React.useMemo(() => dayConditions(data, dayOffset), [data, dayOffset]);
  const factors = vesselFactors(vessel.vesselType);

  return (
    <View style={styles.spotBlock}>
      <Text style={styles.spotName}>{spotName}</Text>
      {loading && !data ? (
        <View style={styles.inlineLoad}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.quietText}>Loading conditions…</Text>
        </View>
      ) : !factors ? (
        <View style={styles.promptCard}>
          <Text style={styles.vesselName}>{vessel.name}</Text>
          <Text style={styles.promptText}>
            Set this vessel's type so the read is tailored to how it handles the sea — a cat and a RIB
            behave very differently.
          </Text>
          <Pressable style={styles.promptBtn} onPress={onSetVesselType}>
            <Text style={styles.promptBtnText}>Set vessel type</Text>
          </Pressable>
        </View>
      ) : (
        <VesselCard vessel={vessel} factors={factors} cond={cond} spotName={spotName} />
      )}
    </View>
  );
}

function VesselCard({
  vessel, factors, cond, spotName,
}: {
  vessel: Vessel;
  factors: NonNullable<ReturnType<typeof vesselFactors>>;
  cond: DayConditions;
  spotName: string;
}) {
  const summary = summaryFor(vessel.name, factors, cond, spotName);
  const chips = buildChips(cond, factors);
  return (
    <View style={styles.vesselCard}>
      <View style={styles.vesselHeader}>
        <Text style={styles.vesselName}>{vessel.name}</Text>
        <Text style={styles.vesselType}>{factors.label}</Text>
      </View>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.chipRow}>
        {chips.length === 0 ? (
          <Text style={styles.quietText}>No condition data for this spot yet.</Text>
        ) : chips.map((c) => (
          <View key={c.key} style={[styles.chip, { borderColor: TONE[c.tone], backgroundColor: TINT[c.tone] }]}>
            <View style={[styles.chipDot, { backgroundColor: TONE[c.tone] }]} />
            <Text style={styles.chipText}>{c.label}{c.detail ? <Text style={styles.chipDetail}>{`  ·  ${c.detail}`}</Text> : null}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const TONE: Record<ChipTone, string> = { good: '#2BBB7F', info: '#09A1FB', warn: '#F5A623', danger: '#F73726' };
const TINT: Record<ChipTone, string> = {
  good: 'rgba(43,187,127,0.10)', info: 'rgba(9,161,251,0.10)', warn: 'rgba(245,166,35,0.12)', danger: 'rgba(247,55,38,0.12)',
};

const styles = StyleSheet.create({
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  dayKicker: { ...typography.caption, color: colors.accent, fontWeight: '800', letterSpacing: 1.4 },
  dayDate: { ...typography.bodySm, color: colors.textMuted },
  quiet: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  quietText: { ...typography.bodySm, color: colors.textMuted },
  inlineLoad: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spotBlock: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  spotName: { ...typography.h3, color: colors.textPrimary },
  vesselCard: { gap: 6, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  vesselHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  vesselName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  vesselType: { ...typography.caption, color: colors.textMuted },
  summary: { ...typography.bodySm, color: colors.textSecondary, lineHeight: 19 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  chipDetail: { color: colors.textMuted, fontWeight: '500' },
  promptCard: { gap: 6, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.08)' },
  promptText: { ...typography.bodySm, color: colors.textSecondary, lineHeight: 18 },
  promptBtn: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: '#F5A623' },
  promptBtnText: { ...typography.bodySm, color: '#F5A623', fontWeight: '700' },
});
