// CharterSpotsScreen — private spot library. Real implementation in
// Phase 5 (list, add/edit form, link-to-public-spot picker, Good
// Window alert toggle).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import type { NavigateFn } from '../router';

export function CharterSpotsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <CharterShell active="charter-spots" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Spots</Text>
          <Text style={styles.subtitle}>
            Your private spot library. Link to public KaiCast spots for forecast data; keep your
            captain's-only spots private.
          </Text>
        </View>
        <Pressable style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ Add spot</Text>
        </Pressable>
      </View>

      <View style={styles.scaffoldCard}>
        <Text style={styles.scaffoldKicker}>PHASE 5</Text>
        <Text style={styles.scaffoldTitle}>Spot library lands next.</Text>
        <Text style={styles.scaffoldBody}>
          Each spot card will show name, depth, trip-type tags, tide preference, a 7-day forecast
          sparkline, and the "next Good window" callout. Add/edit form supports a map-pin picker
          and an optional link to a canonical KaiCast public spot — once linked the forecast
          sparkline reads from the same kaicast_reports docs the consumer dashboard uses.
        </Text>
        <Text style={styles.scaffoldBody}>
          Good Window Alerts toggle per spot writes to{' '}
          charter_accounts/{'{orgId}'}/spots/{'{spotId}'}.goodWindowAlertsEnabled — the Phase 7
          Cloud Function listens to kaicast_reports writes and pushes a notification when an
          enabled spot crosses Fair/Poor → Good.
        </Text>
      </View>
    </CharterShell>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 600 },
  createBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  createBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  scaffoldCard: {
    padding: 20, borderRadius: radius.md,
    backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline,
    gap: 12,
  },
  scaffoldKicker: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.accent },
  scaffoldTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  scaffoldBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20, maxWidth: 720 },
});
