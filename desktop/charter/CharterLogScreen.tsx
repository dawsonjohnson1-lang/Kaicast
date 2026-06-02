// CharterLogScreen — Captain's Log filing UI + archive. Real
// implementation in Phase 4. The conditionsSnapshot field on every
// trip is captured at trip creation (not log filing) time, so the
// forecast-vs-reality delta on the archive detail view is honest
// about what was predicted when the captain committed.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import type { NavigateFn } from '../router';

export function CharterLogScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const [view, setView] = React.useState<'file' | 'archive'>('archive');
  return (
    <CharterShell active="charter-log" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Captain's Log</Text>
          <Text style={styles.subtitle}>
            File post-trip notes from the dock. The delta against the original forecast becomes
            ground-truth for the abyss scoring pipeline.
          </Text>
        </View>
        <View style={styles.tabRow}>
          <Pressable onPress={() => setView('file')} style={[styles.tabBtn, view === 'file' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, view === 'file' && styles.tabTextActive]}>File a log</Text>
          </Pressable>
          <Pressable onPress={() => setView('archive')} style={[styles.tabBtn, view === 'archive' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, view === 'archive' && styles.tabTextActive]}>Archive</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.scaffoldCard}>
        <Text style={styles.scaffoldKicker}>PHASE 4</Text>
        <Text style={styles.scaffoldTitle}>
          {view === 'file' ? 'Filing UI lands next.' : 'Archive list + trip detail land next.'}
        </Text>
        <Text style={styles.scaffoldBody}>
          {view === 'file'
            ? 'Eight quick blocks: surface conditions (sliders + quick selects, no free text), underwater (vis/temp/thermocline/current/surge), per-spot notes with marine-life chips + would-return toggle, forecast accuracy (one tap: matched / better / worse), optional free text, customer satisfaction (dive boats only), incident flag (none / minor / serious — serious opens an incident form), media upload to Firebase Storage.'
            : 'Filterable by spot, date range, trip type, forecast accuracy, incident flag. Tap any entry → side-by-side comparison: what KaiCast forecast for that day vs. what the captain logged, with the computed delta inline. The deltas accumulate into the per-spot calibration dataset that feeds back into the abyss scoring layer.'}
        </Text>
      </View>
    </CharterShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 640 },
  tabRow: {
    flexDirection: 'row', padding: 3, gap: 2,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
  },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm - 2 },
  tabBtnActive: { backgroundColor: colors.surface2 },
  tabText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text3 },
  tabTextActive: { color: colors.text1 },
  scaffoldCard: {
    padding: 20, borderRadius: radius.md,
    backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline,
    gap: 12,
  },
  scaffoldKicker: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.accent },
  scaffoldTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  scaffoldBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20, maxWidth: 720 },
});
