// StandaloneLogFiler — file a captain's log WITHOUT a trip. This is the
// Phase 1 standalone flow: the captain picks the day, the vessel, the
// spot(s), optionally enumerates the day's trips as lightweight rows
// (type is the only required field per row; zero rows is a valid
// weather-out / maintenance day), records observed conditions + crew,
// and files. No dependency on a FareHarbor booking — rows carry
// tripSource: 'manual' so the Phase 2 sync can add 'fareharbor' rows
// without a migration.
//
// The ONLY filer — the trip-coupled CaptainsLogFiler is gone. Screens
// with trip context (e.g. the crew trip brief) pass `initial` to
// prefill day/spots/crew and link the log via tripId; the log itself
// never requires the trip.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ChipSelect, NumberStepper, NumberField, TextField, FreeTextArea } from './inputs';
import { saveStandaloneLog } from './saveStandaloneLog';
import {
  emptyLogDraft, hstStartOfDay, makeManualTrip, TRIP_TYPE_OPTIONS,
  type StandaloneLogDraft, type StandaloneLogTrip,
  type ObservedSeaState, type ObservedWind, type LogIncidentLevel,
} from './standaloneLog';
import type { CharterSpot, CrewMember, Vessel } from './types';

const SEA_STATES: ReadonlyArray<{ id: ObservedSeaState; label: string }> = [
  { id: 'Glass', label: 'Glass' }, { id: 'Light', label: 'Light' },
  { id: 'Moderate', label: 'Moderate' }, { id: 'Rough', label: 'Rough' },
  { id: 'Very rough', label: 'Very rough' },
];
const WINDS: ReadonlyArray<{ id: ObservedWind; label: string }> = [
  { id: 'Calm', label: 'Calm' }, { id: 'Light', label: 'Light' },
  { id: 'Moderate', label: 'Moderate' }, { id: 'Fresh', label: 'Fresh' },
  { id: 'Strong', label: 'Strong' },
];
const INCIDENTS: ReadonlyArray<{ id: LogIncidentLevel; label: string }> = [
  { id: 'none', label: 'None' }, { id: 'minor', label: 'Minor' }, { id: 'serious', label: 'Serious' },
];

interface Props {
  orgId: string;
  vessels: Vessel[];
  spots: CharterSpot[];
  crew: CrewMember[];
  filedBy: { uid: string; name: string };
  /** Prefill from surrounding context (e.g. a trip brief: day, spots,
   *  crew, tripId link). The log stays valid without any of it. */
  initial?: Partial<StandaloneLogDraft>;
  onClose: () => void;
  onFiled?: (logId: string) => void;
}

export function StandaloneLogFiler({ orgId, vessels, spots, crew, filedBy, initial, onClose, onFiled }: Props) {
  const [draft, setDraft] = React.useState<StandaloneLogDraft>(() => ({ ...emptyLogDraft(), ...initial }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const patch = (p: Partial<StandaloneLogDraft>) => setDraft((d) => ({ ...d, ...p }));

  const pickVessel = (vesselId: string) => {
    const v = vessels.find((x) => x.vesselId === vesselId);
    const single = v?.engineConfig === 'single_outboard' || v?.engineConfig === 'sail';
    // Hidden fields must not file silently — drop stbd hours when the
    // picked vessel collapses the engine pair to one field.
    patch({ vesselId, vesselName: v?.name ?? '', ...(single ? { stbdEngineHours: null } : null) });
  };
  const toggleSpot = (id: string) =>
    patch({ spotIds: draft.spotIds.includes(id) ? draft.spotIds.filter((s) => s !== id) : [...draft.spotIds, id] });
  const toggleCrew = (m: CrewMember) => {
    const has = draft.crew.some((c) => c.id === m.id);
    patch({ crew: has ? draft.crew.filter((c) => c.id !== m.id) : [...draft.crew, { id: m.id, name: m.name, role: m.role }] });
  };

  const addTrip = () => patch({ trips: [...draft.trips, makeManualTrip(draft.trips.length + 1)] });
  const patchTrip = (tripId: string, p: Partial<StandaloneLogTrip>) =>
    patch({ trips: draft.trips.map((t) => (t.tripId === tripId ? { ...t, ...p } : t)) });
  const removeTrip = (tripId: string) =>
    patch({ trips: draft.trips.filter((t) => t.tripId !== tripId).map((t, i) => ({ ...t, tripNum: i + 1 })) });

  // Single-engine vessels get one "Engine hours" field instead of
  // port/stbd. The fleet model carries engineConfig (no engine count);
  // 'inboard' and 'other' can be twins, so only configs that are
  // unambiguously one engine collapse the pair. No vessel picked yet →
  // show both.
  const selectedVessel = vessels.find((v) => v.vesselId === draft.vesselId);
  const singleEngine = selectedVessel != null
    && (selectedVessel.engineConfig === 'single_outboard' || selectedVessel.engineConfig === 'sail');

  const valid = isValid(draft);

  const onSubmit = async () => {
    if (!valid) {
      setError('Pick a vessel and at least one spot. Serious incidents need a description.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const logId = await saveStandaloneLog(orgId, {
        ...draft,
        // tripCount mirrors the rows when the captain enumerated them;
        // a prefilled counter (or null) survives a row-less day.
        tripCount: draft.trips.length > 0 ? draft.trips.length : draft.tripCount,
      }, filedBy);
      onFiled?.(logId);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not file log');
    } finally {
      setSaving(false);
    }
  };

  const dayChoices = [0, 1, 2].map((n) => {
    const ms = hstStartOfDay(Date.now() - n * 86400000);
    const label = n === 0 ? 'Today' : n === 1 ? 'Yesterday' : new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
    return { id: String(ms), label };
  });
  // A prefilled date older than the quick-pick window still needs a chip,
  // or the selection would be invisible and unselectable.
  if (!dayChoices.some((c) => c.id === String(draft.date))) {
    dayChoices.push({
      id: String(draft.date),
      label: new Date(draft.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' }),
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>FILE CAPTAIN'S LOG</Text>
              <Text style={styles.title}>Standalone day log</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}><Text style={styles.closeText}>×</Text></Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Block label="① Day" required>
              <ChipSelect options={dayChoices} value={String(draft.date)} onChange={(v) => patch({ date: Number(v) })} />
            </Block>

            <Block label="② Vessel" required>
              {vessels.length === 0 ? (
                <Text style={styles.muted}>No vessels in the fleet yet — add one in Settings first.</Text>
              ) : (
                <ChipSelect options={vessels.map((v) => ({ id: v.vesselId, label: v.name }))} value={draft.vesselId || undefined} onChange={pickVessel} />
              )}
            </Block>

            <Block label="③ Spot(s)" required>
              {spots.length === 0 ? (
                <Text style={styles.muted}>No spots in your library yet — add them in Settings.</Text>
              ) : (
                <View style={styles.multiRow}>
                  {spots.map((s) => {
                    const active = draft.spotIds.includes(s.id);
                    return (
                      <Pressable key={s.id} onPress={() => toggleSpot(s.id)} style={[styles.multiChip, active && styles.multiChipActive]}>
                        <Text style={[styles.multiChipText, active && styles.multiChipTextActive]}>{s.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Block>

            <Block label="④ Trips">
              {draft.trips.length === 0 ? (
                <Text style={styles.muted}>
                  No trips logged. Zero-trip days (weather-out, maintenance) file fine without
                  rows — add one per trip if you want the day enumerated.
                </Text>
              ) : (
                draft.trips.map((t, idx) => (
                  <TripRow
                    key={t.tripId}
                    trip={t}
                    index={idx + 1}
                    onPatch={(p) => patchTrip(t.tripId, p)}
                    onRemove={() => removeTrip(t.tripId)}
                  />
                ))
              )}
              <Pressable onPress={addTrip} style={styles.addTripBtn}>
                <Text style={styles.addTripText}>+ Add trip</Text>
              </Pressable>
            </Block>

            <Block label="⑤ Observed conditions">
              <FreeTextArea label="Weather observed" value={draft.weather} onChange={(v) => patch({ weather: v })} placeholder="Sunny, scattered clouds, light trades…" rows={2} />
              <Field label="Sea state">
                <ChipSelect options={SEA_STATES} value={draft.seaState || undefined} onChange={(v) => patch({ seaState: v })} />
              </Field>
              <Field label="Wind observed">
                <ChipSelect options={WINDS} value={draft.windObserved || undefined} onChange={(v) => patch({ windObserved: v })} />
              </Field>
              <NumberStepper label="Visibility (ft)" value={draft.visibilityFt} onChange={(v) => patch({ visibilityFt: v })} step={5} min={0} max={150} unit="ft" />
              <TextField label="Snorkel site" value={draft.snorkelSite ?? ''} onChange={(v) => patch({ snorkelSite: v })} placeholder="As written on the paper log — free text" />
            </Block>

            <Block label="⑥ Crew on duty">
              {crew.length === 0 ? (
                <Text style={styles.muted}>No crew on the roster yet.</Text>
              ) : (
                <View style={styles.multiRow}>
                  {crew.map((m) => {
                    const active = draft.crew.some((c) => c.id === m.id);
                    return (
                      <Pressable key={m.id} onPress={() => toggleCrew(m)} style={[styles.multiChip, active && styles.multiChipActive]}>
                        <Text style={[styles.multiChipText, active && styles.multiChipTextActive]}>{m.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Block>

            <Block label="⑦ Counts">
              {/* "Trips run today" used to live here as a manual stepper —
                  the count now derives from the trip rows in ④ at file time. */}
              <NumberStepper label="Duration (hrs)" value={draft.durationHours} onChange={(v) => patch({ durationHours: v })} step={0.5} min={0} max={24} unit="h" />
            </Block>

            <Block label="⑧ Incident" required>
              <ChipSelect options={INCIDENTS} value={draft.incident} onChange={(v) => patch({ incident: v })} />
              {draft.incident !== 'none' ? (
                <FreeTextArea
                  label={draft.incident === 'serious' ? 'Incident report — what happened, who, response' : 'What happened'}
                  value={draft.incidentDetail}
                  onChange={(v) => patch({ incidentDetail: v })}
                  placeholder={draft.incident === 'serious' ? 'Required. Coast Guard CG-2692 may apply.' : 'Brief description.'}
                  rows={3}
                />
              ) : null}
            </Block>

            <Block label="⑨ Notes">
              <FreeTextArea label="Trip comments" value={draft.tripComments ?? ''} onChange={(v) => patch({ tripComments: v })} placeholder="Optional — how the trip went, guests, route…" rows={2} />
              <FreeTextArea label="Anything else worth recording" value={draft.notes} onChange={(v) => patch({ notes: v })} placeholder="Optional — gear notes, guest notes, things to flag for tomorrow…" rows={4} />
            </Block>

            {/* Paper-form parity (MANA daily log). Capture-and-store only —
                nothing downstream derives runtimes, fuel rates, or deltas
                from these; they are saved flat on the log doc as entered. */}
            <Block label="⑩ Vessel">
              <View style={styles.row2}>
                <NumberField
                  label={singleEngine ? 'Engine hours' : 'Port engine hours'}
                  value={draft.portEngineHours}
                  onChange={(v) => patch({ portEngineHours: v })}
                  unit="hrs"
                />
                {singleEngine ? null : (
                  <NumberField label="Stbd engine hours" value={draft.stbdEngineHours} onChange={(v) => patch({ stbdEngineHours: v })} unit="hrs" />
                )}
              </View>
              <View style={styles.row2}>
                <NumberField label="Fuel added" value={draft.fuelAdded} onChange={(v) => patch({ fuelAdded: v })} unit="gal" />
                <NumberField label="Fuel remaining" value={draft.fuelRemaining} onChange={(v) => patch({ fuelRemaining: v })} unit="gal / %" />
              </View>
              <FreeTextArea label="Boat comments" value={draft.boatComments ?? ''} onChange={(v) => patch({ boatComments: v })} placeholder="Optional — engine, hull, gear condition…" rows={2} />
              <FreeTextArea label="Inventory needed" value={draft.inventoryNeeded ?? ''} onChange={(v) => patch({ inventoryNeeded: v })} placeholder="Optional — supplies to restock…" rows={2} />
            </Block>

            {error ? (
              <View style={styles.errCard}>
                <Text style={styles.errTitle}>Could not file log</Text>
                <Text style={styles.errBody}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onSubmit} disabled={saving || !valid} style={[styles.fileBtn, (saving || !valid) && styles.fileBtnDisabled]}>
              <Text style={[styles.fileBtnText, (saving || !valid) && styles.fileBtnTextDisabled]}>{saving ? 'Filing…' : 'File log'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// One lightweight trip row — type chips up top, then label / hours /
// guests inline, type-conditional species + cert fields (no collapse
// toggle; the desktop modal has the room), and optional notes. Mirrors
// the mobile DailyLogScreen TripRow.
function TripRow({
  trip, index, onPatch, onRemove,
}: {
  trip: StandaloneLogTrip;
  index: number;
  onPatch: (p: Partial<StandaloneLogTrip>) => void;
  onRemove: () => void;
}) {
  const hasSpecies = trip.type === 'spearfishing' || trip.type === 'scuba';
  const hasCertLevels = trip.type === 'scuba';
  return (
    <View style={styles.tripRow}>
      <View style={styles.tripRowHeader}>
        <Text style={styles.tripIndex}>#{index}</Text>
        <View style={{ flex: 1 }}>
          <ChipSelect options={TRIP_TYPE_OPTIONS} value={trip.type} onChange={(v) => onPatch({ type: v })} />
        </View>
        <Pressable onPress={onRemove} hitSlop={10} style={styles.tripRemoveBtn}>
          <Text style={styles.tripRemoveText}>×</Text>
        </Pressable>
      </View>

      {trip.type === 'other' ? (
        <TextField
          label="Custom trip type"
          value={trip.tripTypeCustom ?? ''}
          onChange={(v) => onPatch({ tripTypeCustom: v })}
          placeholder="e.g. Photoshoot charter, Ash scattering"
        />
      ) : null}

      <View style={styles.row2}>
        <View style={{ flex: 3 }}>
          <TextField label="Label / time" value={trip.label} onChange={(v) => onPatch({ label: v })} placeholder="3:00 PM Snorkel" />
        </View>
        <NumberField label="Hrs" value={trip.durationHours} onChange={(v) => onPatch({ durationHours: v })} unit="h" />
        <NumberField
          label="Guests"
          value={trip.guestCount}
          onChange={(v) => onPatch({ guestCount: v == null ? null : Math.round(v) })}
        />
      </View>

      {hasSpecies ? (
        <TextField
          label={trip.type === 'spearfishing' ? 'Catches' : 'Species sighted'}
          value={trip.speciesNotes}
          onChange={(v) => onPatch({ speciesNotes: v })}
          placeholder={trip.type === 'spearfishing' ? 'e.g. 1 ono, 2 papio' : 'e.g. 3 turtles, 1 whitetip'}
        />
      ) : null}
      {hasCertLevels ? (
        <TextField
          label="Cert levels onboard"
          value={trip.certLevelNotes}
          onChange={(v) => onPatch({ certLevelNotes: v })}
          placeholder="e.g. 2× OW, 1× AOW, 1× Rescue"
        />
      ) : null}

      <FreeTextArea label="Trip notes" value={trip.notes} onChange={(v) => onPatch({ notes: v })} placeholder="Optional — anything that stood out" rows={2} />
    </View>
  );
}

function isValid(d: StandaloneLogDraft): boolean {
  if (!d.vesselId) return false;
  if (d.spotIds.length === 0) return false;
  if (d.incident === 'serious' && d.incidentDetail.trim().length < 10) return false;
  return true;
}

function Block({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label} {required ? <Text style={styles.required}>•</Text> : null}</Text>
      <View style={{ gap: 14 }}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 760, maxHeight: '92%', backgroundColor: colors.surface0, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 16 },
  kicker: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1, marginTop: 4 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: colors.text2, lineHeight: 22 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 20 },
  block: { gap: 12, padding: 16, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  blockLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  required: { color: '#F73726' },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },
  row2: { flexDirection: 'row', gap: 12 },
  multiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  multiChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  multiChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  multiChipText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },
  multiChipTextActive: { color: colors.text1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.surface1 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  cancelText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text2 },
  fileBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  fileBtnDisabled: { opacity: 0.4 },
  fileBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  fileBtnTextDisabled: { color: colors.text4 },
  tripRow: { gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong },
  tripRowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tripIndex: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, fontWeight: '700', paddingTop: 9 },
  tripRemoveBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  tripRemoveText: { fontSize: 18, color: colors.text3, lineHeight: 18 },
  addTripBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent },
  addTripText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  errCard: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
});
