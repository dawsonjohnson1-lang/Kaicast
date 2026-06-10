// TripLogScreen — per-trip form, opened from DailyLogScreen.
//
// Sections in spec order:
//   1. Trip info (auto-filled, mostly read-only)
//   2. Site selection (SpotPicker for primary + secondary)
//   3. Conditions (Abyss left / Observed right via ConditionsPanel)
//   4. Guest manifest
//   5. Protected species
//   6. Incident report
//   7. Equipment notes
//   8. Site notes
//
// Autosave is handled by useCharterLog — every mutation goes through
// patchTrip() and is debounced to Firestore by 2s.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { SectionTitle } from '@/components/SectionTitle';
import { SpotPicker, type PickedSpot } from '@/components/SpotPicker';
import { ConditionsPanel } from '@/components/charter/ConditionsPanel';
import { GuestManifest } from '@/components/charter/GuestManifest';
import { SpeciesPicker } from '@/components/charter/SpeciesPicker';
import { IncidentReport } from '@/components/charter/IncidentReport';
import { CharterUpsell } from '@/components/charter/CharterUpsell';
import { colors, radius, spacing, typography } from '@/theme';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useFareHarbor } from '@/hooks/useFareHarbor';
import { useCharterLog } from '@/hooks/useCharterLog';
import { useAbyssConditions } from '@/hooks/useAbyssConditions';
import { useSpots } from '@/hooks/useSpots';
import {
  TRIP_TYPE_LABEL,
  type CharterLogCrew,
  type CharterLogTrip,
  type TripType,
} from '@/types/charterLog';

import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = NativeStackScreenProps<RootStackParamList, 'LogsTrip'>['route'];

const TRIP_TYPES: TripType[] = ['snorkel', 'freedive', 'scuba', 'sunset', 'whale_watch', 'other'];

/**
 * Build epoch ms for today's date + HH:MM string in HST. We use HST
 * because the rest of the conditions pipeline is HST-bucketed.
 */
function parseDepartureMs(dateMs: number, hhmm: string): number {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return dateMs;
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  // Shift dateMs to HST midnight, then add h+m.
  const HST_OFFSET_MS = -10 * 60 * 60 * 1000;
  const shifted = new Date(dateMs + HST_OFFSET_MS);
  shifted.setUTCHours(h, m, 0, 0);
  return shifted.getTime() - HST_OFFSET_MS;
}

export function TripLogScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { tripId } = route.params;
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);
  const { spots } = useSpots();

  const isCharter = profile?.accountType === 'charter';
  const orgId = profile?.orgId;
  const dateMs = useMemo(() => Date.now(), []);

  const { trips: fhTrips, loading: fhLoading } = useFareHarbor(orgId, dateMs);
  const seed = useMemo(() => {
    if (!isCharter || !orgId || fhLoading) return null;
    return {
      operatorId: orgId,
      authorId: user?.id ?? '',
      vesselId: orgId,
      vesselName: profile?.handle ?? 'Vessel',
      captainName: profile?.name ?? '',
      captainLicense: '',
      harborDeparture: '',
      dailyAlerts: '',
      primarySpotId: profile?.homeSpot ?? null,
      trips: fhTrips,
      crew: [] as CharterLogCrew[],
    };
  }, [isCharter, orgId, fhLoading, fhTrips, user?.id, profile?.handle, profile?.name, profile?.homeSpot]);

  const { log, patchTrip, flush } = useCharterLog(dateMs, seed);

  const trip = log?.trips.find((t) => t.tripId === tripId);

  // Abyss conditions — pulled fresh per trip departure time + primary spot.
  // departureTime is optional on the new lightweight rows — fall back to
  // the daily start so the hook still returns a meaningful snapshot.
  const departureMs = trip ? parseDepartureMs(dateMs, trip.departureTime ?? '') : undefined;
  const { conditions: abyssLive, loading: abyssLoading, source: abyssSource } =
    useAbyssConditions(trip?.primarySite, departureMs);

  const [primaryPickerOpen, setPrimaryPickerOpen] = useState(false);
  const [secondaryPickerOpen, setSecondaryPickerOpen] = useState(false);

  if (profileLoading) {
    return <Screen contentStyle={{ paddingTop: 0 }}><View /></Screen>;
  }
  if (!isCharter) {
    return (
      <CharterUpsell
        title="Trip Log"
        body="The Captain's Log is part of KaiCast Charter."
        onBack={() => nav.goBack()}
      />
    );
  }
  if (!trip) {
    return (
      <Screen contentStyle={{ paddingTop: 0 }}>
        <Header title="Trip" onBack={() => nav.goBack()} />
        <View style={{ padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Trip not found. It may have been removed from FareHarbor.
          </Text>
        </View>
      </Screen>
    );
  }

  // ── Patch helpers ───────────────────────────────────────────────────
  const patch = (next: Partial<CharterLogTrip>) =>
    patchTrip(trip.tripId, (prev) => ({ ...prev, ...next }));

  const onPrimaryPicked = (s: PickedSpot) => {
    setPrimaryPickerOpen(false);
    patch({
      primarySite: s.kind === 'known' ? s.id : s.name,
      coordinates: `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`,
    });
  };
  const onSecondaryPicked = (s: PickedSpot) => {
    setSecondaryPickerOpen(false);
    patch({ secondarySite: s.kind === 'known' ? s.id : s.name });
  };
  const primaryDisplay = trip.primarySite
    ? spots.find((s) => s.id === trip.primarySite)?.name ?? trip.primarySite
    : '';
  const secondaryDisplay = trip.secondarySite
    ? spots.find((s) => s.id === trip.secondarySite)?.name ?? trip.secondarySite
    : '';

  const handleMarkComplete = async () => {
    patch({ complete: !trip.complete });
    await flush();
    if (!trip.complete) nav.goBack();
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Screen contentStyle={{ paddingTop: 0 }} scroll={false}>
      <Header title={`Trip ${trip.tripNum}`} onBack={() => nav.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Trip info ── */}
        <SectionTitle title="Trip info" />
        <Card style={{ gap: spacing.sm, marginBottom: spacing.xl }} bordered>
          <Input
            label="Title"
            value={trip.title}
            onChangeText={(v) => patch({ title: v })}
          />
          <View style={styles.tripTypeRow}>
            {TRIP_TYPES.map((t) => (
              <ChoiceChip
                key={t}
                label={TRIP_TYPE_LABEL[t]}
                selected={trip.type === t}
                onPress={() => patch({ type: t })}
              />
            ))}
          </View>
          <View style={styles.twoCol}>
            <Input
              label="Departure"
              value={trip.departureTime}
              onChangeText={(v) => patch({ departureTime: v })}
              placeholder="HH:MM"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Return"
              value={trip.returnTime}
              onChangeText={(v) => patch({ returnTime: v })}
              placeholder="HH:MM"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <View style={styles.twoCol}>
            <Input
              label="Max depth"
              value={trip.maxDepth}
              onChangeText={(v) => patch({ maxDepth: v })}
              placeholder="ft"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Duration"
              value={trip.duration}
              onChangeText={(v) => patch({ duration: v })}
              placeholder="min"
              containerStyle={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* ── 2. Site selection ── */}
        <SectionTitle title="Sites" />
        <Card style={{ gap: spacing.md, marginBottom: spacing.xl }} bordered>
          <SitePickerRow
            label="Primary site"
            value={primaryDisplay}
            placeholder="Choose primary site"
            onPress={() => setPrimaryPickerOpen(true)}
          />
          <SitePickerRow
            label="Secondary site"
            value={secondaryDisplay}
            placeholder="Choose secondary site (optional)"
            onPress={() => setSecondaryPickerOpen(true)}
          />
          {trip.coordinates ? (
            <Text style={styles.coordsHint}>Coordinates: {trip.coordinates}</Text>
          ) : null}
        </Card>

        {/* ── 3. Conditions ── */}
        {/* These are the LEGACY per-trip conditions (TripLogScreen
            still exists for archived data + back-compat). The new
            standalone flow uses day-level CharterLog.conditions. */}
        <SectionTitle title="Conditions" />
        <View style={{ marginBottom: spacing.xl }}>
          <ConditionsPanel
            abyss={abyssLive}
            observed={trip.observedConditions ?? {
              visibility: '', feltTemp: '', seaState: '', swellDirObserved: '',
              windObserved: '', currentObserved: '', currentDirObserved: '',
              captainNote: '',
            }}
            abyssLoading={abyssLoading}
            abyssSource={abyssSource}
            onObservedChange={(next) => patch({ observedConditions: next })}
          />
        </View>

        {/* ── 4. Guest manifest ── */}
        <SectionTitle title="Guests" />
        <View style={{ marginBottom: spacing.xl }}>
          <GuestManifest
            guests={trip.guests ?? []}
            tripType={trip.type}
            bookedCount={trip.passengerCount ?? 0}
            onGuestsChange={(next) => patch({ guests: next })}
          />
        </View>

        {/* ── 5. Protected species ── */}
        <SectionTitle title="Protected species observed" />
        <View style={{ marginBottom: spacing.xl }}>
          <SpeciesPicker
            observed={trip.speciesObserved ?? []}
            onChange={(next) => patch({ speciesObserved: next })}
          />
        </View>

        {/* ── 6. Incident report ── */}
        <SectionTitle title="Incident" />
        <View style={{ marginBottom: spacing.xl }}>
          <IncidentReport trip={trip} onChange={patch} />
        </View>

        {/* ── 7. Equipment notes ── */}
        <SectionTitle title="Equipment notes" />
        <Card style={{ marginBottom: spacing.xl }} bordered>
          <Input
            value={trip.equipmentNotes}
            onChangeText={(v) => patch({ equipmentNotes: v })}
            placeholder="Anything broken, swapped, or worth flagging"
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Card>

        {/* ── 8. Site notes ── */}
        <SectionTitle title="Site notes" />
        <Card style={{ marginBottom: spacing.xl }} bordered>
          <Input
            value={trip.siteNotes}
            onChangeText={(v) => patch({ siteNotes: v })}
            placeholder="Site-specific observations"
            multiline
            numberOfLines={3}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Card>

        {/* Complete button */}
        <Button
          label={trip.complete ? 'Mark trip incomplete' : 'Mark trip complete'}
          variant={trip.complete ? 'secondary' : 'primary'}
          fullWidth
          onPress={handleMarkComplete}
        />
      </ScrollView>

      <SpotPicker
        open={primaryPickerOpen}
        value={null}
        onClose={() => setPrimaryPickerOpen(false)}
        onSelect={onPrimaryPicked}
      />
      <SpotPicker
        open={secondaryPickerOpen}
        value={null}
        onClose={() => setSecondaryPickerOpen(false)}
        onSelect={onSecondaryPicked}
      />
    </Screen>
  );
}

function SitePickerRow({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Card
        style={styles.sitePickRow}
        bordered
      >
        <Text
          style={value ? styles.siteValue : styles.sitePlaceholder}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Button label="Pick" size="sm" variant="secondary" onPress={onPress} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  tripTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  sitePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  siteValue: { flex: 1, ...typography.body, color: colors.textPrimary },
  sitePlaceholder: { flex: 1, ...typography.body, color: colors.textMuted },
  coordsHint: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
