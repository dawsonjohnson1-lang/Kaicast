// CharterCrewScreen — crew roster + cert tracking. Real implementation
// in Phase 6 alongside the public briefing share page.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import type { NavigateFn } from '../router';

export function CharterCrewScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  return (
    <CharterShell active="charter-crew" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Crew</Text>
          <Text style={styles.subtitle}>
            Roster + cert tracking. Certs expiring inside 60 days flag yellow; expired flags red.
          </Text>
        </View>
        <Pressable style={styles.createBtn}>
          <Text style={styles.createBtnText}>+ Add crew</Text>
        </Pressable>
      </View>

      <View style={styles.scaffoldCard}>
        <Text style={styles.scaffoldKicker}>PHASE 6</Text>
        <Text style={styles.scaffoldTitle}>Roster + cert management lands next.</Text>
        <Text style={styles.scaffoldBody}>
          Each crew card shows name, role (owner / captain / divemaster / deckhand), and the cert
          list with expiry color-coding. Add/edit form adds one cert at a time (USCG / DiveMaster /
          Instructor / CPR / O2Provider) with issuing agency + expiry date. Optional link to a
          KaiCast user account on the consumer side — sets the foundation for the "crew can sign
          their own float plan acknowledgement" feature later.
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
