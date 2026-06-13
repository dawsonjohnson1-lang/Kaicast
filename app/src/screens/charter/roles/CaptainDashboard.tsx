// Captain dashboard — operational view. Today's trip is the hero,
// crew on the trip get an avatar strip, upcoming trips are a tight
// list, hazard alerts get prominent placement, plus a quick-log CTA.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { VesselCard } from '@/components/charter/VesselCard';
import { TripCard } from '@/components/charter/TripCard';
import { CrewRoster } from '@/components/charter/CrewRoster';
import { AlertBanner, type CharterAlert } from '@/components/charter/AlertBanner';
import { Icon } from '@/components/Icon';
import { CharterTwoDayForecast } from '../CharterTwoDayForecast';
import { hstDateKey } from '@/types/charterLog';
import type { Vessel, Trip, CrewMember } from '@/types/charter';

const MOCK_HAZARD: CharterAlert = {
  id: 'h1',
  severity: 'hazard',
  source: 'NWS',
  title: 'High surf advisory — Maui north shore',
  body: '8-12 ft north-facing swell building through Wednesday PM. Reassess north-shore charters before departure.',
};

export function CaptainDashboard({
  vessel, trips, crew, onSpotTap, onLogConditions,
}: {
  vessel: Vessel;
  trips: Trip[];
  crew: CrewMember[];
  onSpotTap?: (spotId: string) => void;
  onLogConditions?: (spotId: string) => void;
}) {
  // HST day boundary — must match CharterTwoDayForecast's bucketing.
  const todayTrip = trips.find((t) => hstDateKey(t.date.getTime()) === hstDateKey(Date.now()));
  const todayCrew = todayTrip
    ? crew.filter((c) => todayTrip.crewIds.includes(c.id))
    : [];
  const upcoming = trips.filter((t) => t.date.getTime() > Date.now()).slice(0, 5);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <VesselCard vessel={vessel} viewerRole="captain" />

      <Section title="Today's trip">
        {todayTrip ? (
          <TripCard trip={todayTrip} hero onPress={() => onSpotTap?.(todayTrip.spotId)} />
        ) : (
          <View style={emptyStyles.card}>
            <Icon name="wave" size={28} color={colors.textMuted} />
            <Text style={emptyStyles.title}>No trip scheduled today</Text>
            <Text style={emptyStyles.sub}>Enjoy the offshore day. Tomorrow's prep loads from the upcoming list below.</Text>
          </View>
        )}
      </Section>

      <Section title="Conditions outlook" meta="today + tomorrow">
        <CharterTwoDayForecast vessel={vessel} trips={trips} />
      </Section>

      {todayTrip && (
        <Section title="My crew" meta={`${todayCrew.length} on this trip`}>
          <CrewRoster crew={todayCrew} variant="strip" />
        </Section>
      )}

      <Section title="Upcoming trips" meta={`${upcoming.length} next`}>
        <View style={{ gap: spacing.sm }}>
          {upcoming.map((t) => (
            <TripCard key={t.id} trip={t} onPress={() => onSpotTap?.(t.spotId)} />
          ))}
        </View>
      </Section>

      <Section title="Hazard alerts">
        <AlertBanner alert={MOCK_HAZARD} />
      </Section>

      <Section title="Quick log">
        <Pressable
          style={ctaStyles.row}
          onPress={() => onLogConditions?.(todayTrip?.spotId ?? '')}
        >
          <View style={ctaStyles.iconWrap}>
            <Icon name="plus" size={20} color={colors.bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ctaStyles.title}>File a condition report</Text>
            <Text style={ctaStyles.sub}>
              {todayTrip ? `for ${todayTrip.spotName}` : 'for any spot on the schedule'}
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
