// VesselSummaryCard — one card per vessel per operating spot per day.
// Shows the vessel name + hull type, the plain-language skipper summary,
// and the data-backed advisory chips. When the vessel has no usable
// `vesselType`, it renders an amber prompt instead of guessing — the
// whole condition read is vessel-type sensitive, so we never assume.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ConditionChipRow } from './ConditionChipRow';
import { vesselFactors } from './vesselFactors';
import { buildChips } from './conditionChips';
import { summaryFor } from './vesselSummary';
import type { DayConditions } from './reportConditions';
import type { CharterSpot, Vessel } from './types';

export function VesselSummaryCard({
  vessel,
  conditions,
  spot,
  onSetVesselType,
}: {
  vessel: Vessel;
  conditions: DayConditions;
  spot: CharterSpot | null;
  onSetVesselType?: () => void;
}) {
  const factors = vesselFactors(vessel.type);

  if (!factors) {
    return (
      <View style={[styles.card, styles.cardPrompt]}>
        <Text style={styles.vesselName}>{vessel.name}</Text>
        <Text style={styles.promptText}>
          Set this vessel's type so we can tailor the condition read — a catamaran and a RIB
          handle the same swell very differently.
        </Text>
        <Pressable style={styles.promptBtn} onPress={onSetVesselType}>
          <Text style={styles.promptBtnText}>Set vessel type →</Text>
        </Pressable>
      </View>
    );
  }

  const summary = summaryFor(vessel.name, factors, conditions, spot?.name);
  const chips = buildChips(conditions, factors, spot?.depthFt);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.vesselName}>{vessel.name}</Text>
        <Text style={styles.vesselType}>{factors.label}</Text>
      </View>
      <Text style={styles.summary}>{summary}</Text>
      <View style={{ marginTop: 10 }}>
        <ConditionChipRow chips={chips} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 6,
  },
  cardPrompt: { borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.08)' },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  vesselName: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text1 },
  vesselType: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, letterSpacing: 0.4 },
  summary: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 19 },
  promptText: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 18 },
  promptBtn: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.10)' },
  promptBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: '#F5A623' },
});
