// CharterHomeScreen — "the 4am screen". One view, everything for today.
// This file is the foundation — the structure + design system + auth
// gating all work end-to-end. The trip-list rendering and hazard-strip
// content pull from mocks until Phase 2 wires them to the real
// charter_accounts/{orgId}/trips query + the hazard feed.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { useAuth } from '../hooks/useAuth';
import type { NavigateFn } from '../router';

export function CharterHomeScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { user, orgId } = useAuth();

  return (
    <CharterShell active="charter-home" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>TODAY · {formatToday()}</Text>
          <Text style={styles.title}>Operations</Text>
          <Text style={styles.subtitle}>
            {orgId
              ? `Signed in as ${user?.email ?? 'captain'} · org ${orgId}`
              : 'Charter account not provisioned — set users/' + (user?.uid ?? '???') + '.orgId before this view shows real data.'}
          </Text>
        </View>
        <View style={styles.quickActionsRow}>
          <QuickAction label="File float plan" />
          <QuickAction label="Share crew brief" />
          <QuickAction label="Log today's trip" emphasis />
        </View>
      </View>

      {/* Hazard strip — placeholder chips while the data feed lands in
          Phase 2. Each chip will expand to a detail panel when tapped. */}
      <View style={styles.hazardStrip}>
        <Text style={styles.hazardLabel}>ACTIVE HAZARDS</Text>
        <View style={styles.hazardChipsRow}>
          <HazardChip kind="moon" label="Box jelly window opens" detail="8 days after full moon" severity="warn" />
          <HazardChip kind="nws" label="Small craft advisory" detail="N-facing waters · 0500–1500 HST" severity="warn" />
          <HazardChip kind="vog" label="Vog: Light" detail="Kona side cleaner; SE Oahu trades carrying" severity="info" />
        </View>
      </View>

      {/* Today's trips — empty state until Phase 2 wires the query. */}
      <View>
        <Text style={styles.sectionTitle}>Today's trips</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Trips for {formatToday()} will appear here.</Text>
          <Text style={styles.emptyBody}>
            Each card shows departure time, ordered spot list, crew, headcount, and a per-trip go/no-go
            badge driven by the abyss forecast at the primary spot at departure time. Tap a borderline
            or red trip to see ranked alternates.
          </Text>
          <Text style={styles.emptyHint}>
            Wire-up scope is Phase 2 — pulls from charter_accounts/{'{orgId}'}/trips
            where date == today.
          </Text>
        </View>
      </View>
    </CharterShell>
  );
}

function formatToday(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'Pacific/Honolulu',
  });
}

function QuickAction({ label, emphasis }: { label: string; emphasis?: boolean }) {
  return (
    <Pressable style={[styles.qaBtn, emphasis && styles.qaBtnEmphasis]}>
      <Text style={[styles.qaText, emphasis && styles.qaTextEmphasis]}>{label}</Text>
    </Pressable>
  );
}

function HazardChip({
  kind: _kind,
  label,
  detail,
  severity,
}: {
  kind: 'moon' | 'nws' | 'runoff' | 'shark' | 'vog';
  label: string;
  detail: string;
  severity: 'info' | 'warn' | 'danger';
}) {
  const tone =
    severity === 'danger' ? '#F73726' :
    severity === 'warn'   ? '#F5A623' :
                            colors.accent;
  return (
    <View style={[styles.hazardChip, { borderColor: tone }]}>
      <View style={[styles.hazardDot, { backgroundColor: tone }]} />
      <View>
        <Text style={styles.hazardChipLabel}>{label}</Text>
        <Text style={styles.hazardChipDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 600 },

  quickActionsRow: { flexDirection: 'row', gap: 8 },
  qaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  qaBtnEmphasis: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  qaText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text1 },
  qaTextEmphasis: { color: colors.bg },

  hazardStrip: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 10,
  },
  hazardLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: colors.text3,
  },
  hazardChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hazardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.surface1,
  },
  hazardDot: { width: 8, height: 8, borderRadius: 4 },
  hazardChipLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text1 },
  hazardChipDetail: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 2, letterSpacing: 0.3 },

  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
  },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  emptyHint: { fontFamily: fonts.mono, fontSize: 11, color: colors.text4, marginTop: 4, letterSpacing: 0.5 },
});
