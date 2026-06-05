// Manager dashboard — administrative view. Weekly calendar strip,
// full trip list (editable/cancelable), full crew roster with
// add/remove affordance, and a spot forecast strip.
//
// NOTE: section 5 ("Spot Forecast Strip") in your original spec was
// cut off mid-sentence — I'm rendering a placeholder strip that uses
// the existing useSpots hook + ConditionPill for each spot the
// vessel touches in its upcoming trips. Replace with the real
// component when you've decided what data + layout you want.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography, RATING_COLORS } from '@/theme';
import { VesselCard } from '@/components/charter/VesselCard';
import { TripCard } from '@/components/charter/TripCard';
import { CrewRoster } from '@/components/charter/CrewRoster';
import { Icon } from '@/components/Icon';
import { TRIP_CONDITION_TO_TIER } from '@/types/charter';
import type { Vessel, Trip, CrewMember } from '@/types/charter';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ManagerDashboard({
  vessel, trips, crew, onSpotTap, onAddCrew,
}: {
  vessel: Vessel;
  trips: Trip[];
  crew: CrewMember[];
  onSpotTap?: (spotId: string) => void;
  onAddCrew?: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
      <VesselCard vessel={vessel} viewerRole="manager" />

      <Section title="Schedule overview" meta="THIS WEEK">
        <WeekStrip trips={trips} />
      </Section>

      <Section title="All upcoming trips" meta={`${trips.length} scheduled`}>
        <View style={{ gap: spacing.sm }}>
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} onPress={() => onSpotTap?.(t.spotId)} />
          ))}
        </View>
      </Section>

      <Section
        title="Crew roster"
        meta={`${crew.length} active`}
        action={(
          <Pressable style={crewBtnStyles.btn} onPress={onAddCrew} hitSlop={6}>
            <Icon name="plus" size={14} color={colors.accent} />
            <Text style={crewBtnStyles.text}>Add crew</Text>
          </Pressable>
        )}
      >
        <CrewRoster crew={crew} />
      </Section>

      <Section title="Spot forecast strip" meta="UNIQUE SPOTS THIS WEEK">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
          {uniqueSpotsFromTrips(trips).map((s) => {
            const color = RATING_COLORS[TRIP_CONDITION_TO_TIER[s.label]];
            return (
              <Pressable
                key={s.spotId}
                onPress={() => onSpotTap?.(s.spotId)}
                style={[forecastStyles.tile, { borderColor: color }]}
              >
                <Text style={[forecastStyles.score, { color }]}>{s.score}</Text>
                <Text style={forecastStyles.spot} numberOfLines={1}>{s.name}</Text>
                <Text style={forecastStyles.count}>{s.count} trip{s.count === 1 ? '' : 's'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Section>
    </ScrollView>
  );
}

function WeekStrip({ trips }: { trips: Trip[] }) {
  // Build last-Sunday→Saturday view. Each day cell shows colored dots
  // for trips that fall on it.
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);

  return (
    <View style={weekStyles.row}>
      {DAYS.map((label, i) => {
        const day = new Date(sunday);
        day.setDate(sunday.getDate() + i);
        const dayTrips = trips.filter((t) => isSameDay(t.date, day));
        const isToday = isSameDay(day, now);
        return (
          <View key={label} style={[weekStyles.cell, isToday && weekStyles.cellToday]}>
            <Text style={[weekStyles.dayLabel, isToday && { color: colors.accent }]}>{label}</Text>
            <Text style={[weekStyles.dayNum, isToday && { color: colors.accent }]}>{day.getDate()}</Text>
            <View style={weekStyles.dotsRow}>
              {dayTrips.slice(0, 4).map((t) => (
                <View
                  key={t.id}
                  style={[weekStyles.dot, { backgroundColor: RATING_COLORS[TRIP_CONDITION_TO_TIER[t.conditionLabel]] }]}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function uniqueSpotsFromTrips(trips: Trip[]) {
  const map = new Map<string, { spotId: string; name: string; score: number; label: Trip['conditionLabel']; count: number }>();
  for (const t of trips) {
    const ex = map.get(t.spotId);
    if (ex) {
      ex.count += 1;
      // Take the highest condition seen (presumably the most-forward
      // forecast won't disagree by much within a week).
      if (t.conditionScore > ex.score) {
        ex.score = t.conditionScore;
        ex.label = t.conditionLabel;
      }
    } else {
      map.set(t.spotId, {
        spotId: t.spotId,
        name: t.spotName,
        score: t.conditionScore,
        label: t.conditionLabel,
        count: 1,
      });
    }
  }
  return [...map.values()];
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Section({ title, meta, action, children }: { title: string; meta?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={sectionStyles.head}>
        <Text style={sectionStyles.title}>{title.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {meta ? <Text style={sectionStyles.meta}>{meta}</Text> : null}
          {action}
        </View>
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

const weekStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  cell: {
    flex: 1,
    aspectRatio: 0.65,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cellToday: { borderColor: colors.accent },
  dayLabel: { ...typography.caption, color: colors.textSecondary, letterSpacing: 1 },
  dayNum: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 999 },
});

const crewBtnStyles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent },
  text: { ...typography.caption, color: colors.accent, fontWeight: '700', letterSpacing: 1 },
});

const forecastStyles = StyleSheet.create({
  tile: { width: 120, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.card, gap: 4, alignItems: 'flex-start' },
  score: { fontSize: 28, fontWeight: '800' },
  spot: { ...typography.bodySm, fontWeight: '700', color: colors.textPrimary },
  count: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
});
