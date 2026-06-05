// Owner dashboard — widest view. Fleet health, all upcoming trips,
// full crew, revenue snapshot (placeholder), billing shortcut, alerts.
//
// Permissions enforced via CHARTER_PERMS in @/types/charter; the
// Owner role has access to everything here.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography, RATING_COLORS } from '@/theme';
import { VesselCard } from '@/components/charter/VesselCard';
import { TripCard } from '@/components/charter/TripCard';
import { CrewRoster } from '@/components/charter/CrewRoster';
import { AlertBanner, type CharterAlert } from '@/components/charter/AlertBanner';
import { TRIP_CONDITION_TO_TIER } from '@/types/charter';
import type { Vessel, Trip, CrewMember } from '@/types/charter';

const MOCK_ALERTS: CharterAlert[] = [
  {
    id: 'a1',
    severity: 'warn',
    source: 'DOH',
    title: 'Runoff advisory: West Maui',
    body: '48hr brown-water advisory for shorelines from Lahaina to Olowalu. Reschedule shore-entries if possible.',
  },
  {
    id: 'a2',
    severity: 'info',
    source: 'KaiCast',
    title: 'Visibility improving at Molokini',
    body: 'Inner-rim 70-80ft through tomorrow afternoon. Best windows 7–10 AM.',
  },
];

export function OwnerDashboard({
  vessel, trips, crew, onSpotTap,
}: {
  vessel: Vessel;
  trips: Trip[];
  crew: CrewMember[];
  onSpotTap?: (spotId: string) => void;
}) {
  const fleet = [vessel]; // single-vessel today; extend when multi-vessel lands

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <VesselCard vessel={vessel} viewerRole="owner" />

      <Section title="Fleet health">
        <View style={{ gap: spacing.sm }}>
          {fleet.map((v) => {
            const today = trips.find((t) => isSameDay(t.date, new Date()));
            const score = today?.conditionScore ?? 0;
            const tier = today ? TRIP_CONDITION_TO_TIER[today.conditionLabel] : 'no-go';
            const color = today ? RATING_COLORS[tier] : colors.textMuted;
            return (
              <View key={v.id} style={fleetStyles.row}>
                <View style={[fleetStyles.score, { borderColor: color }]}>
                  <Text style={[fleetStyles.scoreNum, { color }]}>{score}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={fleetStyles.vesselName}>{v.name}</Text>
                  <Text style={fleetStyles.vesselSub}>
                    {today ? today.spotName : 'No trip scheduled today'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="Upcoming trips" meta={`${trips.length} scheduled`}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} compact onPress={() => onSpotTap?.(t.spotId)} />
          ))}
        </ScrollView>
      </Section>

      <Section title="Crew roster" meta={`${crew.length} total`}>
        <CrewRoster crew={crew} />
      </Section>

      <Section title="Revenue snapshot" meta="LAST 7 DAYS · PLACEHOLDER">
        <View style={revenueStyles.grid}>
          <RevTile value="14" label="Trips" />
          <RevTile value="118" label="Guests" />
          <RevTile value="$0" label="Gross" />
          <RevTile value="0" label="Cancellations" />
        </View>
      </Section>

      <Section title="Billing & subscription">
        <Pressable style={shortcutStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={shortcutStyles.title}>KaiCast Charter · monthly</Text>
            <Text style={shortcutStyles.sub}>Manage seats, payment method, invoices</Text>
          </View>
          <Text style={shortcutStyles.arrow}>›</Text>
        </Pressable>
      </Section>

      <Section title="Active alerts">
        <View style={{ gap: spacing.sm }}>
          {MOCK_ALERTS.map((a) => <AlertBanner key={a.id} alert={a} />)}
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={sectionStyles.head}>
        <Text style={sectionStyles.title}>{title.toUpperCase()}</Text>
        {meta ? <Text style={sectionStyles.meta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function RevTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={revenueStyles.tile}>
      <Text style={revenueStyles.value}>{value}</Text>
      <Text style={revenueStyles.label}>{label.toUpperCase()}</Text>
    </View>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const sectionStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { ...typography.caption, color: colors.textMuted, letterSpacing: 1.4, fontWeight: '700' },
  meta:  { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
});

const fleetStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  score: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 22, fontWeight: '800' },
  vesselName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  vesselSub:  { ...typography.bodySm, color: colors.textSecondary },
});

const revenueStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 4 },
  value: { ...typography.display, fontSize: 24, color: colors.textPrimary },
  label: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
});

const shortcutStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  title: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  sub: { ...typography.bodySm, color: colors.textSecondary },
  arrow: { ...typography.h3, color: colors.textMuted },
});
