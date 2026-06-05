// ConnectionStatusBar — top-of-dashboard strip showing the boat's
// connectivity to KaiCast services and how many crew are reachable.
//
// "Connected · 3 crew online"   — vessel mesh is live
// "On the App · 2 crew on app"  — remote (cell/wifi), not at vessel
// "Offline · last sync 14m ago" — dark
//
// State derives from the crew list passed in; the dashboard owns the
// data fetch, this component is presentational.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { CrewMember, ConnectionState } from '@/types/charter';

type Props = { crew: CrewMember[] };

export function ConnectionStatusBar({ crew }: Props) {
  const overall = computeOverallState(crew);
  const connectedCount = crew.filter((c) => c.connectionState === 'connected').length;
  const onAppCount = crew.filter((c) => c.connectionState === 'on_app').length;

  let label: string;
  if (overall === 'connected') {
    label = `Connected · ${connectedCount} crew on the boat`;
  } else if (overall === 'on_app') {
    label = `On the App · ${onAppCount} crew online remotely`;
  } else {
    label = `Offline · last sync ${formatLastSync(crew)}`;
  }

  return (
    <View style={[styles.row, stateStyles[overall]]}>
      <View style={[styles.dot, dotStyles[overall]]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function computeOverallState(crew: CrewMember[]): ConnectionState {
  if (crew.some((c) => c.connectionState === 'connected')) return 'connected';
  if (crew.some((c) => c.connectionState === 'on_app')) return 'on_app';
  return 'offline';
}

function formatLastSync(crew: CrewMember[]): string {
  const last = crew
    .map((c) => c.lastSeen?.getTime() ?? 0)
    .reduce((max, t) => (t > max ? t : max), 0);
  if (last === 0) return 'unknown';
  const minAgo = Math.round((Date.now() - last) / 60000);
  if (minAgo < 60) return `${minAgo}m ago`;
  return `${Math.round(minAgo / 60)}h ago`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  label: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
});

const stateStyles = StyleSheet.create({
  connected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  on_app:    { backgroundColor: colors.card, borderColor: colors.accent },
  offline:   { backgroundColor: colors.card, borderColor: colors.border },
});

const dotStyles = StyleSheet.create({
  connected: { backgroundColor: colors.excellent },
  on_app:    { backgroundColor: colors.accent },
  offline:   { backgroundColor: colors.textMuted },
});
