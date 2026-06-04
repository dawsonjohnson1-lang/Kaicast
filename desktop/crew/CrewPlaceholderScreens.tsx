// CrewPlaceholderScreens — minimal stubs for the crew routes that
// don't have their own screen yet. Each renders inside CrewShell so
// the sidebar nav stays intact and the user can navigate back without
// losing context. As each one gets a real implementation it moves to
// its own file and this exports list shrinks.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CrewShell } from './CrewShell';
import type { NavigateFn, RouteParams } from '../router';

interface Props {
  onNavigate?: NavigateFn;
  params?: RouteParams;
}

export function CrewTripsScreen({ onNavigate }: Props) {
  return (
    <CrewShell active="crew-trips" onNavigate={onNavigate}>
      <Placeholder
        title="My trips"
        body="Your upcoming and past trip assignments will land here, with conditions snapshots, route briefs, and the 'Log my dive' handoff for completed trips."
        eta="Ships with the next slice once crew-scoped Firestore reads are wired."
      />
    </CrewShell>
  );
}

export function CrewCertsScreen({ onNavigate }: Props) {
  return (
    <CrewShell active="crew-certs" onNavigate={onNavigate}>
      <Placeholder
        title="My certs"
        body="View certs on file with this org. Submit a new cert — admin reviews before it's recorded. Expiry timeline below."
        eta="Lands with the Firestore rule additions that let crew read + update their own crew record."
      />
    </CrewShell>
  );
}

export function CrewSettingsScreen({ onNavigate }: Props) {
  return (
    <CrewShell active="crew-settings" onNavigate={onNavigate}>
      <Placeholder
        title="Crew settings"
        body="Notification preferences, full org membership list (with leave option), and a link to your consumer Pro status."
        eta="Next slice."
      />
    </CrewShell>
  );
}

export function CrewLogScreen({ onNavigate }: Props) {
  return (
    <CrewShell active="crew-log" onNavigate={onNavigate}>
      <Placeholder
        title="Captain's Log"
        body="File float plans and log trips you captain. Reuses the same filer the charter admin uses, scoped to your own trips."
        eta="Lands alongside My Trips."
      />
    </CrewShell>
  );
}

export function CrewBriefScreen({ onNavigate, params }: Props) {
  return (
    <CrewShell active="crew-brief" onNavigate={onNavigate}>
      <Placeholder
        title={`Trip brief${params?.tripId ? ` · ${params.tripId}` : ''}`}
        body="Authenticated crew-side trip brief. Same content as the public crew briefing share link, with your own name highlighted in the roster and (for captains) the full manifest visible."
        eta="Next slice."
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

