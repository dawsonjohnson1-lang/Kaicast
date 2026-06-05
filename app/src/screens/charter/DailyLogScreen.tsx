// DailyLogScreen — entry point for the Captain's Log tab.
//
// Shows today's date + vessel, the Abyss daily-alert bar, an editable
// crew list, FareHarbor-derived trip cards, and a "Submit Daily Log"
// button gated on every trip being marked Complete.
//
// Hydration:
//   1. Resolve operatorId from users/{uid}.orgId.
//   2. Pull today's FareHarbor trip stubs from charter_accounts/{orgId}/fh_trips.
//   3. Pass those stubs to useCharterLog, which seeds the doc on first
//      open and subscribes from then on.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { SectionTitle } from '@/components/SectionTitle';
import { LogTripCard } from '@/components/charter/LogTripCard';
import { CharterUpsell } from '@/components/charter/CharterUpsell';
import { colors, radius, spacing, typography } from '@/theme';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFareHarbor } from '@/hooks/useFareHarbor';
import { useCharterLog } from '@/hooks/useCharterLog';
import {
  emptyAbyssConditions,
  emptyObservedConditions,
  type CharterLogCrew,
  type CharterLogTrip,
} from '@/types/charterLog';

import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const todayMs = () => Date.now();

function makeManualTrip(tripNum: number): CharterLogTrip {
  const id = `manual_${Date.now().toString(36)}`;
  return {
    tripId: id,
    tripNum,
    title: 'Manual trip',
    type: 'other',
    departureTime: '',
    returnTime: '',
    passengerCount: 0,
    primarySite: '',
    secondarySite: '',
    coordinates: '',
    maxDepth: '',
    duration: '',
    siteNotes: '',
    fareharborBookingId: '',
    guests: [],
    abyssConditions: emptyAbyssConditions(),
    observedConditions: emptyObservedConditions(),
    speciesObserved: [],
    incident: 'None',
    coastGuardNotification: false,
    dlnrNotification: false,
    equipmentNotes: '',
    complete: false,
  };
}

export function DailyLogScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);

  const isCharter = profile?.accountType === 'charter';
  const orgId = profile?.orgId;
  const dateMs = useMemo(todayMs, []);

  // FareHarbor trip stubs for today.
  const { trips: fhTrips, loading: fhLoading, lastSynced, syncNow } = useFareHarbor(orgId, dateMs);

  // Seed payload passed into useCharterLog. We let the user fill in
  // captain name / license / harbor at the top of the screen — but
  // also default-prefill from the auth profile so an empty form is
  // never the captain's first experience.
  const seed = useMemo(() => {
    if (!isCharter || !orgId || fhLoading) return null;
    // Vessel defaults — until per-user vessel routing lands, treat the
    // org's primary vessel id as the orgId itself so the doc path is
    // deterministic. Manager UI can split vessels later.
    return {
      operatorId: orgId,
      vesselId: orgId,
      vesselName: profile?.handle ?? 'Vessel',
      captainName: profile?.name ?? '',
      captainLicense: '',
      harborDeparture: '',
      dailyAlerts: '',
      trips: fhTrips,
      crew: [] as CharterLogCrew[],
    };
  }, [isCharter, orgId, fhLoading, fhTrips, profile?.handle, profile?.name]);

  const { log, loading: logLoading, saving, patch, setCrew, addManualTrip } =
    useCharterLog(dateMs, seed);

  // ── Gates ───────────────────────────────────────────────────────────
  if (profileLoading) {
    return <Screen contentStyle={{ paddingTop: 0 }}><View /></Screen>;
  }
  if (!isCharter) {
    return (
      <CharterUpsell
        title="Captain's Log"
        body="The Captain's Log is part of KaiCast Charter — fill out a USCG-style daily log straight from your boat, auto-populated from FareHarbor and Abyss conditions."
        onBack={() => nav.goBack()}
      />
    );
  }
  if (!orgId) {
    return (
      <Screen>
        <Header title="Captain's Log" />
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.textSecondary, ...typography.body }}>
            Your account is marked charter, but no operator is linked yet. Finish
            charter onboarding (Charter → Setup) to enable the log.
          </Text>
        </View>
      </Screen>
    );
  }

  // ── Derived ─────────────────────────────────────────────────────────
  const allComplete = (log?.trips.length ?? 0) > 0 && log!.trips.every((t) => t.complete);
  const lastSyncedLabel = lastSynced
    ? new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Screen contentStyle={{ paddingTop: 0 }} scroll={false}>
      <Header title="Captain's Log" rightIcon="bell" onRightPress={syncNow} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Today + vessel header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayDate}>
            {new Date(dateMs).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Text>
          <Text style={styles.vesselName}>{log?.vesselName ?? 'Vessel'}</Text>
          <View style={styles.saveStateRow}>
            <Text style={styles.saveState}>
              {saving ? 'Saving…' : 'Saved'}
              {lastSyncedLabel ? `  ·  FareHarbor synced ${lastSyncedLabel}` : ''}
            </Text>
          </View>
        </View>

        {/* Abyss daily alert */}
        {log?.dailyAlerts ? (
          <View style={styles.alertBar}>
            <Icon name="bell" size={14} color={colors.warn} />
            <Text style={styles.alertText}>{log.dailyAlerts}</Text>
          </View>
        ) : null}

        {/* Vessel / captain header inputs — editable up-top, persisted. */}
        <SectionTitle title="Today" />
        <Card style={{ gap: spacing.sm, marginBottom: spacing.xl }} bordered>
          <Input
            label="Captain"
            value={log?.captainName ?? ''}
            onChangeText={(v) => patch((p) => ({ ...p, captainName: v }))}
            placeholder="Full name"
          />
          <Input
            label="License #"
            value={log?.captainLicense ?? ''}
            onChangeText={(v) => patch((p) => ({ ...p, captainLicense: v }))}
            placeholder="USCG license"
          />
          <Input
            label="Harbor of departure"
            value={log?.harborDeparture ?? ''}
            onChangeText={(v) => patch((p) => ({ ...p, harborDeparture: v }))}
            placeholder="e.g. Lahaina Harbor"
          />
        </Card>

        {/* Crew section */}
        <SectionTitle title="Crew on board" />
        <CrewEditor
          crew={log?.crew ?? []}
          onChange={setCrew}
        />

        {/* Trip cards */}
        <SectionTitle
          title={`Trips · ${log?.trips.length ?? 0}`}
          action="Add manual"
          onActionPress={() => addManualTrip(makeManualTrip((log?.trips.length ?? 0) + 1))}
        />
        {logLoading || fhLoading ? (
          <Text style={styles.loading}>Loading trips…</Text>
        ) : (log?.trips.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No trips today</Text>
            <Text style={styles.emptyBody}>
              FareHarbor returned no confirmed bookings for {new Date(dateMs).toLocaleDateString()}.
              Tap "Add manual" above to log a trip not in FareHarbor.
            </Text>
          </View>
        ) : (
          log!.trips.map((t) => (
            <LogTripCard
              key={t.tripId}
              trip={t}
              onPress={() => nav.navigate('LogsTrip', { tripId: t.tripId })}
            />
          ))
        )}

        {/* Summary + submit */}
        {(log?.trips.length ?? 0) > 0 ? (
          <Card style={{ marginTop: spacing.lg, gap: spacing.sm }} bordered>
            <View style={styles.summaryRow}>
              <SummaryStat label="Trips" value={String(log?.totalTrips ?? 0)} />
              <SummaryStat label="Guests" value={String(log?.totalGuests ?? 0)} />
              <SummaryStat label="Incidents" value={String(log?.incidents ?? 0)} />
            </View>
            <Button
              label={allComplete ? 'Continue to Submit' : 'Mark all trips Complete to submit'}
              fullWidth
              disabled={!allComplete}
              onPress={() => nav.navigate('LogsSubmit')}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ── Inline crew editor ───────────────────────────────────────────────
function CrewEditor({
  crew,
  onChange,
}: {
  crew: CharterLogCrew[];
  onChange: (next: CharterLogCrew[]) => void;
}) {
  const add = () => {
    onChange([
      ...crew,
      { id: `c_${Date.now().toString(36)}`, name: '', role: 'Deckhand', license: '' },
    ]);
  };
  const update = (id: string, patch: Partial<CharterLogCrew>) => {
    onChange(crew.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) => onChange(crew.filter((c) => c.id !== id));

  return (
    <Card style={{ gap: spacing.md, marginBottom: spacing.xl }} bordered>
      {crew.length === 0 ? (
        <Text style={{ ...typography.bodySm, color: colors.textMuted }}>
          No crew added. Tap "Add crew" to start.
        </Text>
      ) : (
        crew.map((c) => (
          <View key={c.id} style={styles.crewRow}>
            <Input
              containerStyle={{ flex: 2 }}
              value={c.name}
              onChangeText={(v) => update(c.id, { name: v })}
              placeholder="Name"
            />
            <Input
              containerStyle={{ flex: 1 }}
              value={c.role}
              onChangeText={(v) => update(c.id, { role: v })}
              placeholder="Role"
            />
            <Pressable onPress={() => remove(c.id)} hitSlop={10} style={styles.removeBtn}>
              <Icon name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))
      )}
      <Button label="Add crew" iconLeft="plus" variant="secondary" onPress={add} />
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dayHeader: { marginBottom: spacing.lg },
  dayDate: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  vesselName: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: 2,
  },
  saveStateRow: { marginTop: 2 },
  saveState: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 11,
  },
  alertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warn,
    marginBottom: spacing.lg,
  },
  alertText: {
    flex: 1,
    ...typography.bodySm,
    color: colors.warn,
    fontWeight: '600',
  },
  loading: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  empty: {
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  removeBtn: {
    height: 44,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
