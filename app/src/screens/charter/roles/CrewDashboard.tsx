// Crew dashboard — narrowest view per the permission matrix.
//
// NOTE: your spec didn't include a Crew section (truncated mid-
// Manager). This is a sensible stub built from the permission table:
//
//   - view OWN trips only        → upcoming-trips list filtered to me
//   - file condition reports     → quick-log CTA
//   - view hazard/safety alerts  → alerts banner
//   - NO crew-roster visibility
//   - NO billing
//   - NO trip create/edit/cancel
//
// Adjust when you've nailed down the desired Crew sections + ordering.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { VesselCard } from '@/components/charter/VesselCard';
import { TripCard } from '@/components/charter/TripCard';
import { AlertBanner, type CharterAlert } from '@/components/charter/AlertBanner';
import { Icon } from '@/components/Icon';
import type { Vessel, Trip } from '@/types/charter';

const MOCK_HAZARD: CharterAlert = {
  id: 'h1',
  severity: 'hazard',
  source: 'NWS',
  title: 'High surf advisory — Maui north shore',
  body: '8-12 ft north-facing swell building through Wednesday PM. Reassess north-shore charters before departure.',
};

export function CrewDashboard({
  vessel, trips, viewerUserId, onSpotTap, onLogConditions,
}: {
  vessel: Vessel;
  trips: Trip[];
  viewerUserId: string;
  onSpotTap?: (spotId: string) => void;
  onLogConditions?: (spotId: string) => void;
}) {
  const myTrips = trips
    .filter((t) => t.crewIds.includes(viewerUserId))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <VesselCard vessel={vessel} viewerRole="crew" />

      <Section title="My trips" meta={`${myTrips.length} assigned`}>
        {myTrips.length === 0 ? (
          <View style={emptyStyles.card}>
            <Icon name="wave" size={28} color={colors.textMuted} />
            <Text style={emptyStyles.title}>No trips assigned</Text>
            <Text style={emptyStyles.sub}>The Captain or Manager will add you to upcoming charters.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {myTrips.map((t) => (
              <TripCard key={t.id} trip={t} onPress={() => onSpotTap?.(t.spotId)} />
            ))}
          </View>
        )}
      </Section>

      <Section title="Safety alerts">
        <AlertBanner alert={MOCK_HAZARD} />
      </Section>

      <Section title="Quick log">
        <Pressable
          style={ctaStyles.row}
          onPress={() => onLogConditions?.(myTrips[0]?.spotId ?? '')}
        >
          <View style={ctaStyles.iconWrap}>
            <Icon name="plus" size={20} color={colors.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ctaStyles.title}>File a condition report</Text>
            <Text style={ctaStyles.sub}>
              {myTrips[0] ? `for ${myTrips[0].spotName}` : 'for any spot you dove'}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
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

const sectionStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { ...typography.caption, color: colors.textMuted, letterSpacing: 1.4, fontWeight: '700' },
  meta:  { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
});

const emptyStyles = StyleSheet.create({
  card: { padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  sub: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
});

const ctaStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  iconWrap: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  sub: { ...typography.bodySm, color: colors.textSecondary },
});
