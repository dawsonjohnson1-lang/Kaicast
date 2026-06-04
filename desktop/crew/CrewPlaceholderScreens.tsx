// CrewPlaceholderScreens — stubs for crew routes that don't have a
// real implementation yet. After D3 only CrewLog remains (Captain's
// Log filing + float plan filing — captain-scoped trip writes — land
// in the next slice along with the rule additions that authorize
// them).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CrewShell } from './CrewShell';
import type { NavigateFn } from '../router';

interface Props {
  onNavigate?: NavigateFn;
}

export function CrewLogScreen({ onNavigate }: Props) {
  return (
    <CrewShell active="crew-log" onNavigate={onNavigate}>
      <Placeholder
        title="Captain's Log"
        body="File float plans on planned trips and log trips you captain. Same UI the charter admin uses, scoped to trips where you're the assigned captain."
        eta="Ships with the captain-scoped trip rule update."
      />
    </CrewShell>
  );
}

function Placeholder({
  title, body, eta,
}: {
  title: string; body: string; eta: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Coming soon</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.etaRow}>
        <Text style={styles.etaLabel}>ETA</Text>
        <Text style={styles.etaText}>{eta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 28,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
    gap: 10,
    maxWidth: 640,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text2,
    lineHeight: 22,
  },
  etaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    alignItems: 'baseline',
  },
  etaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
  },
  etaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    flex: 1,
    fontStyle: 'italic',
  },
});
