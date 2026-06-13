// DailyLogScreen — standalone captain's daily log (Phase 1).
//
// What the spec calls for:
//   - Creatable + savable with just date + vessel + captain.
//   - Conditions section UNCHANGED — Abyss auto-fill on the left,
//     captain-observed on the right, at the DAY level (one matrix
//     for the whole log instead of one per trip).
//   - Trips are a lightweight, fast inline list. Trip type is the
//     only required field per row. Captain adds rows in a couple
//     taps. Zero-trip days are valid.
//   - Day-level incident block (occurred toggle + summary + USCG /
//     DLNR flags) below the trips.
//   - Save button is always enabled — no per-trip "Complete" gate.
//
// Out of scope here (Slice 2):
//   - Type-conditional species + cert-level fields on Scuba and
//     Spearfishing rows (still collapse to plain rows for now).
//   - PDF generator update — generateCaptainsLog.js still renders
//     from the legacy structure until the next slice.

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { SectionTitle } from '@/components/SectionTitle';
import { ConditionsPanel } from '@/components/charter/ConditionsPanel';
import { CharterUpsell } from '@/components/charter/CharterUpsell';
import { colors, radius, spacing, typography } from '@/theme';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAbyssConditions } from '@/hooks/useAbyssConditions';
import { useCharterLog } from '@/hooks/useCharterLog';
import { useCharterRole } from '@/hooks/useCharterRole';
import { canFillCaptainLog } from '@/types/charter';
import {
  emptyLightweightTrip,
  isAbyssEmpty,
  type CharterLogCrew,
  type CharterLogTrip,
  type CharterLogIncident,
  type TripType,
  TRIP_TYPE_OPTIONS,
} from '@/types/charterLog';

import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const todayMs = () => Date.now();

export function DailyLogScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);

  const isCharter = profile?.accountType === 'charter';
  const orgId = profile?.orgId;
  const dateMs = useMemo(todayMs, []);

  // Permission gate — keyed on LICENSE, not role. The owner can always
  // file; everyone else (captain, manager, crew, deckhand) can file only
  // with a captain's license recorded on their account. Mirrored in
  // firestore.rules (hasCaptainsLicense) so the form being hidden isn't
  // the only enforcement. Role still comes from the mock hook (Stage 1);
  // the license comes from the real user doc.
  const { role } = useCharterRole();
  const canCreate = canFillCaptainLog(role, profile?.captainLicense);
  // A captain expected to file but with no license yet — prompt to add
  // one rather than silently blocking.
  const needsLicense = !canCreate;

  // Seed payload for useCharterLog. Notably we DO NOT pull trips
  // from FareHarbor here — Phase 1 is standalone. The trips array
  // is always empty on first open; captain adds rows manually.
  // FareHarbor sync re-enters the flow as Phase 2.
  const seed = useMemo(() => {
    if (!isCharter || !orgId) return null;
    return {
      operatorId: orgId,
      authorId: user?.id ?? '',
      vesselId: orgId,
      vesselName: profile?.handle ?? 'Vessel',
      captainName: profile?.name ?? '',
      captainLicense: profile?.captainLicense ?? '',
      harborDeparture: '',
      dailyAlerts: '',
      // Conditions snapshot anchors to the captain's home spot; the server
      // falls back to the org's first operating spot when this is null.
      primarySpotId: profile?.homeSpot ?? null,
      trips: [] as CharterLogTrip[],
      crew: [] as CharterLogCrew[],
    };
  }, [isCharter, orgId, user?.id, profile?.handle, profile?.name, profile?.captainLicense, profile?.homeSpot]);

  const {
    log,
    loading: logLoading,
    saving,
    error: logError,
    patch,
    setCrew,
    addManualTrip,
    removeTrip,
    flush,
  } = useCharterLog(dateMs, seed);

  // Abyss auto-fill — keyed off the captain's profile.homeSpotId.
  // Falls back to the empty Abyss block when no home spot is set;
  // ConditionsPanel handles that gracefully (shows "No data this hour").
  const homeSpotId = profile?.homeSpot;
  const {
    conditions: abyssLive,
    loading:    abyssLoading,
    source:     abyssSource,
  } = useAbyssConditions(homeSpotId, dateMs);

  // The log doc is seeded with an all-blank abyss block; without the
  // isAbyssEmpty check the seed permanently shadows live Abyss data.
  const abyssForPanel =
    log?.conditions?.abyss && !isAbyssEmpty(log.conditions.abyss)
      ? log.conditions.abyss
      : abyssLive;

  // ── Gates ───────────────────────────────────────────────────────────
  if (profileLoading) {
    return <Screen contentStyle={{ paddingTop: 0 }}><View /></Screen>;
  }
  if (!isCharter) {
    return (
      <CharterUpsell
        title="Captain's Log"
        body="The Captain's Log is part of KaiCast Charter — fill out a daily log straight from your boat with conditions auto-pulled from Abyss."
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
            Your account is marked charter, but no operator is linked yet. Finish charter onboarding (Charter → Setup) to enable the log.
          </Text>
        </View>
      </Screen>
    );
  }

  // ── Derived ─────────────────────────────────────────────────────────
  const tripCount = log?.trips.length ?? 0;
  const canSign = !!log && !!log.vesselName.trim() && !!(log.captainName ?? '').trim();

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Screen contentStyle={{ paddingTop: 0 }} scroll={false}>
      <Header title="Captain's Log" />
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
            <Text style={styles.saveState}>{saving ? 'Saving…' : 'Saved'}</Text>
          </View>
        </View>

        {/* Read-only banner — filling out a log needs a captain's
            license (the owner is exempt). Without one the form is
            rendered but interaction is blocked at the wrapper below. */}
        {needsLicense ? (
          <View style={styles.readonlyBanner}>
            <Text style={styles.readonlyTitle}>Read-only</Text>
            <Text style={styles.readonlyBody}>
              Add your captain's license number in profile to fill out logs. You can review what's been filled in so far.
            </Text>
          </View>
        ) : null}

        {/* Save / load error — autosave runs silently, so surface failures
            here so a captain knows their entries didn't persist. */}
        {logError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't save</Text>
            <Text style={styles.errorBody}>{logError}</Text>
          </View>
        ) : null}

        {/* The whole form body. When the viewer can't create, we kill
            pointer events + tint to grey out — simpler than threading
            an `editable={false}` through every input. */}
        <View
          pointerEvents={canCreate ? 'auto' : 'none'}
          style={!canCreate ? styles.formBodyReadonly : undefined}
        >
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
            placeholder="USCG license (optional)"
          />
          <Input
            label="Harbor of departure"
            value={log?.harborDeparture ?? ''}
            onChangeText={(v) => patch((p) => ({ ...p, harborDeparture: v }))}
            placeholder="e.g. Lahaina Harbor"
          />
        </Card>

        {/* Day-level conditions — Abyss auto-fill | captain-observed.
            Whatever the captain types here is what flows into the PDF
            and the future trip-by-trip drill-in.

            The patch we apply is namespaced under .conditions to match
            the new day-level schema. Abyss side is read-only and pulled
            from the captain's home spot. */}
        <SectionTitle title="Conditions" />
        <View style={{ marginBottom: spacing.xl }}>
          <ConditionsPanel
            abyss={abyssForPanel}
            observed={log?.conditions?.observed ?? {
              visibility: '', feltTemp: '', seaState: '', swellDirObserved: '',
              windObserved: '', currentObserved: '', currentDirObserved: '',
              captainNote: '',
            }}
            abyssLoading={abyssLoading}
            abyssSource={abyssSource}
            onObservedChange={(next) =>
              patch((p) => ({
                ...p,
                conditions: {
                  abyss:    abyssForPanel,
                  observed: next,
                },
              }))
            }
          />
        </View>

        {/* Crew section — unchanged from prior. */}
        <SectionTitle title="Crew on board" />
        <CrewEditor
          crew={log?.crew ?? []}
          onChange={setCrew}
        />

        {/* Trips — lightweight, fast. Add row → set type → done.
            The whole point is speed; rows stay compact. */}
        <SectionTitle
          title={`Trips · ${tripCount} today`}
          action="Add trip"
          onActionPress={() => addManualTrip(emptyLightweightTrip(tripCount + 1))}
        />
        {logLoading ? (
          <Text style={styles.loading}>Loading…</Text>
        ) : tripCount === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No trips logged</Text>
            <Text style={styles.emptyBody}>
              Tap "Add trip" above to log a charter. Days with no trips (weather-out, maintenance) save fine without any rows.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(log?.trips ?? []).map((t, idx) => (
              <TripRow
                key={t.tripId}
                trip={t}
                index={idx + 1}
                onChange={(next) =>
                  patch((p) => ({
                    ...p,
                    trips: p.trips.map((x) => (x.tripId === t.tripId ? { ...x, ...next } : x)),
                  }))
                }
                onRemove={() => removeTrip(t.tripId)}
              />
            ))}
          </View>
        )}

        {/* Day notes — free-form, end-of-day narrative. */}
        <SectionTitle title="Day notes" />
        <Card style={{ marginBottom: spacing.xl }} bordered>
          <TextInput
            value={log?.dayNotes ?? ''}
            onChangeText={(v) => patch((p) => ({ ...p, dayNotes: v }))}
            placeholder="Anything noteworthy about the day overall — weather changes, crew swaps, equipment issues…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.dayNotesInput}
          />
        </Card>

        {/* Incident block — day-level. Captain flips occurred; the
            summary / flags only matter when it's true. */}
        <SectionTitle title="Incident" />
        <IncidentBlock
          value={log?.incident ?? { occurred: false, summary: '', uscgFlag: false, dlnrFlag: false }}
          onChange={(next) => patch((p) => ({ ...p, incident: next }))}
        />

        {/* Sign-off — replaces "Mark all trips Complete to submit".
            Enabled whenever there's a vessel + captain name AND the
            viewer is allowed to create logs; trips are NOT required. */}
        <Card style={{ marginTop: spacing.lg, gap: spacing.sm }} bordered>
          <View style={styles.summaryRow}>
            <SummaryStat label="Trips" value={String(tripCount)} />
            <SummaryStat label="Guests" value={String(log?.totalGuests ?? 0)} />
            <SummaryStat label="Incident" value={log?.incident?.occurred ? 'Yes' : 'No'} />
          </View>
          <Button
            label={log?.signOff ? 'Signed ✓ — Re-open' : 'Sign log'}
            fullWidth
            disabled={!canSign || !canCreate}
            onPress={async () => {
              await flush();
              if (log?.signOff) {
                patch((p) => ({ ...p, signOff: null }));
              } else {
                patch((p) => ({
                  ...p,
                  signOff: { signedBy: p.captainName.trim() || 'Captain', signedAt: Date.now() },
                }));
              }
            }}
          />
        </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─── Lightweight trip row ────────────────────────────────────────────
//
// The whole row is intentionally compact — type chip up top + three
// inline number/text inputs + remove button. Captain shouldn't need
// to drill into a separate screen to log a trip's basics.

function TripRow({
  trip, index, onChange, onRemove,
}: {
  trip: CharterLogTrip;
  index: number;
  onChange: (patch: Partial<CharterLogTrip>) => void;
  onRemove: () => void;
}) {
  const isOther = trip.type === 'other';
  // Type-conditional optional fields (kept collapsed by default so the
  // common-case lightweight row never feels like data entry). Species
  // applies to Spearfishing + Scuba; cert-level applies to Scuba only.
  const hasSpecies = trip.type === 'spearfishing' || trip.type === 'scuba';
  const hasCertLevels = trip.type === 'scuba';
  const showMoreToggle = hasSpecies || hasCertLevels;
  // Auto-expand if either field is already populated so a saved row
  // doesn't hide pre-existing data behind a collapsed toggle.
  const initiallyOpen =
    !!(trip.speciesNotes && trip.speciesNotes.trim().length) ||
    !!(trip.certLevelNotes && trip.certLevelNotes.trim().length);
  const [expanded, setExpanded] = React.useState(initiallyOpen);

  return (
    <Card bordered style={{ gap: spacing.sm }}>
      <View style={styles.tripHeaderRow}>
        <Text style={styles.tripIndex}>#{index}</Text>
        <TypeChipPicker
          value={trip.type}
          onChange={(next) => onChange({ type: next })}
        />
        <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
          <Icon name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {isOther ? (
        <Input
          label="Custom trip type"
          value={trip.tripTypeCustom ?? ''}
          onChangeText={(v) => onChange({ tripTypeCustom: v })}
          placeholder="e.g. Photoshoot charter, Ash scattering"
          hint="Shows in the daily log PDF where the trip type would normally appear."
        />
      ) : null}

      <View style={styles.tripRowInline}>
        <Input
          containerStyle={{ flex: 3 }}
          label="Label / time"
          value={trip.label ?? ''}
          onChangeText={(v) => onChange({ label: v })}
          placeholder="3:00 PM Snorkel"
        />
        <Input
          containerStyle={{ flex: 1 }}
          label="Hrs"
          value={trip.durationHours != null ? String(trip.durationHours) : ''}
          onChangeText={(v) => {
            const n = parseFloat(v);
            onChange({ durationHours: Number.isFinite(n) ? n : undefined });
          }}
          placeholder="2.5"
          keyboardType="decimal-pad"
        />
        <Input
          containerStyle={{ flex: 1 }}
          label="Guests"
          value={trip.guestCount != null ? String(trip.guestCount) : ''}
          onChangeText={(v) => {
            const n = parseInt(v, 10);
            onChange({ guestCount: Number.isFinite(n) ? n : undefined });
          }}
          placeholder="8"
          keyboardType="number-pad"
        />
      </View>

      <TextInput
        value={trip.notes ?? ''}
        onChangeText={(v) => onChange({ notes: v })}
        placeholder="Notes — anything that stood out (optional)"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.tripNotesInput}
      />

      {showMoreToggle ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.moreToggle}
          hitSlop={6}
        >
          <Text style={styles.moreToggleText}>
            {expanded ? '▴ Hide species / cert' : '▾ Species / cert (optional)'}
          </Text>
        </Pressable>
      ) : null}

      {showMoreToggle && expanded ? (
        <View style={{ gap: spacing.sm }}>
          {hasSpecies ? (
            <Input
              label={trip.type === 'spearfishing' ? 'Catches' : 'Species sighted'}
              value={trip.speciesNotes ?? ''}
              onChangeText={(v) => onChange({ speciesNotes: v })}
              placeholder={trip.type === 'spearfishing'
                ? 'e.g. 1 ono, 2 papio'
                : 'e.g. 3 turtles, 1 whitetip'}
            />
          ) : null}
          {hasCertLevels ? (
            <Input
              label="Cert levels onboard"
              value={trip.certLevelNotes ?? ''}
              onChangeText={(v) => onChange({ certLevelNotes: v })}
              placeholder="e.g. 2× OW, 1× AOW, 1× Rescue"
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function TypeChipPicker({
  value, onChange,
}: {
  value: TripType;
  onChange: (next: TripType) => void;
}) {
  // Horizontal scrolling chip strip so the option list fits without
  // wrapping inside the trip card. Active chip uses the accent fill.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
      style={{ flex: 1 }}
    >
      {TRIP_TYPE_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.typeChip, active && styles.typeChipActive]}
          >
            <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Incident block ──────────────────────────────────────────────────

function IncidentBlock({
  value, onChange,
}: {
  value: CharterLogIncident;
  onChange: (next: CharterLogIncident) => void;
}) {
  const toggle = (k: keyof CharterLogIncident) =>
    onChange({ ...value, [k]: !value[k] } as CharterLogIncident);

  return (
    <Card bordered style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
      <Pressable onPress={() => toggle('occurred')} style={styles.toggleRow}>
        <View style={[styles.toggleBox, value.occurred && styles.toggleBoxOn]}>
          {value.occurred ? <Text style={styles.toggleCheck}>✓</Text> : null}
        </View>
        <Text style={styles.toggleLabel}>An incident occurred today</Text>
      </Pressable>

      {value.occurred ? (
        <>
          <TextInput
            value={value.summary}
            onChangeText={(v) => onChange({ ...value, summary: v })}
            placeholder="What happened? Brief summary for the record…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.incidentSummary}
          />
          <Pressable onPress={() => toggle('uscgFlag')} style={styles.toggleRow}>
            <View style={[styles.toggleBox, value.uscgFlag && styles.toggleBoxOn]}>
              {value.uscgFlag ? <Text style={styles.toggleCheck}>✓</Text> : null}
            </View>
            <Text style={styles.toggleLabel}>USCG notified</Text>
          </Pressable>
          <Pressable onPress={() => toggle('dlnrFlag')} style={styles.toggleRow}>
            <View style={[styles.toggleBox, value.dlnrFlag && styles.toggleBoxOn]}>
              {value.dlnrFlag ? <Text style={styles.toggleCheck}>✓</Text> : null}
            </View>
            <Text style={styles.toggleLabel}>DLNR notified</Text>
          </Pressable>
        </>
      ) : null}
    </Card>
  );
}

// ─── Crew editor (unchanged) ─────────────────────────────────────────

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
  readonlyBanner: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    gap: 2,
  },
  readonlyTitle: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  readonlyBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  formBodyReadonly: {
    opacity: 0.6,
  },
  errorBanner: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F73726',
    backgroundColor: 'rgba(247,55,38,0.10)',
    gap: 2,
  },
  errorTitle: {
    ...typography.bodySm,
    color: '#F73726',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  errorBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
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
    marginBottom: spacing.xl,
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

  // ── Trip row ──
  tripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripIndex: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontWeight: '700',
    width: 28,
  },
  tripRowInline: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  tripNotesInput: {
    minHeight: 60,
    color: colors.textPrimary,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    textAlignVertical: 'top',
  },
  moreToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  moreToggleText: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontSize: 11,
  },

  // ── Type chip ──
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  typeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  typeChipText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // ── Day notes ──
  dayNotesInput: {
    minHeight: 80,
    color: colors.textPrimary,
    padding: spacing.sm,
    textAlignVertical: 'top',
  },

  // ── Incident ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  incidentSummary: {
    minHeight: 80,
    color: colors.textPrimary,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    textAlignVertical: 'top',
  },
});
