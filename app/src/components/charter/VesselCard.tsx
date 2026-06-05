// VesselCard — vessel overview at the top of every role dashboard.
// Carries the vessel name, home port, and a soft connection-state
// halo. Owner sees a slightly elevated accent border to signal
// authority level (per the spec).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { Vessel, CharterRole } from '@/types/charter';
import { ConnectionStatusBar } from './ConnectionStatusBar';
import { RoleBadge } from './RoleBadge';

type Props = {
  vessel: Vessel;
  viewerRole: CharterRole;
};

export function VesselCard({ vessel, viewerRole }: Props) {
  const isOwner = viewerRole === 'owner';
  return (
    <View style={[styles.card, isOwner && styles.cardOwner]}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{vessel.name}</Text>
          <Text style={styles.port}>{vessel.homePort.toUpperCase()}</Text>
        </View>
        <RoleBadge role={viewerRole} />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <ConnectionStatusBar crew={vessel.crew} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  cardOwner: { borderColor: 'rgba(26,184,255,0.30)' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  name: { ...typography.display, fontSize: 22, color: colors.textPrimary },
  port: { ...typography.caption, color: colors.textMuted, letterSpacing: 1.2 },
});
