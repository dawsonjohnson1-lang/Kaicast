// CharterTripsScreen — trip planner + archive. Phase 1 ships the
// shell; the trip list + create-trip flow + readiness calendar all
// land in Phase 3 once the trip query + route-builder are wired.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import type { NavigateFn } from '../router';

export function CharterTripsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const [filter, setFilter] = React.useState<'planned' | 'active' | 'completed' | 'cancelled'>('planned');

  return (
    <CharterShell active="charter-trips" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trips</Text>
          <Text style={styles.subtitle}>Plan, file float plans, archive completed trips.</Text>
        </View>
        <Pressable style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ Create trip</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['planned', 'active', 'completed', 'cancelled'] as const).map((f) => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.scaffoldCard}>
        <Text style={styles.scaffoldKicker}>PHASE 3</Text>
        <Text style={styles.scaffoldTitle}>Trip list + create flow lands next.</Text>
        <Text style={styles.scaffoldBody}>
          The create-trip wizard is five steps: basics → route builder (with conditions at planned
          arrival time pulled from kaicast_reports per spot) → crew assignment with cert-expiry
          warnings → manifest (dive trips only) → review + file float plan. The route builder also
          surfaces drive-time and per-leg crossing conditions so the captain sees swell-on-heading
          before committing.
        </Text>
        <Text style={styles.scaffoldBody}>
          The Spot Readiness Calendar — 14-day grid, spots × days, color-coded by forecast tier —
          ships in the same phase under a "Calendar" toggle in this header.
        </Text>
      </View>
    </CharterShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4 },
  createBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  createBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0,
  },
  filterChipActive: { backgroundColor: colors.surface1, borderColor: colors.accent },
  filterChipText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text3 },
  filterChipTextActive: { color: colors.text1 },

  scaffoldCard: {
    padding: 20, borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1, borderColor: colors.hairline,
    gap: 12,
  },
  scaffoldKicker: {
    fontFamily: fonts.mono, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, color: colors.accent,
  },
  scaffoldTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  scaffoldBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20, maxWidth: 720 },
});
