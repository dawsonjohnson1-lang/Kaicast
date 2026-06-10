// StandaloneLogFiler — file a captain's log WITHOUT a trip. This is the
// Phase 1 standalone flow: the captain picks the day, the vessel, the
// spot(s), records observed conditions + crew + an optional trip count,
// and files. No trip picker, no dependency on a FareHarbor booking.
//
// Replaces the trip-coupled CaptainsLogFiler as the entry point. The
// legacy filer stays in the tree for already-filed trip logs.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ChipSelect, NumberStepper, FreeTextArea } from './inputs';
import { saveStandaloneLog } from './saveStandaloneLog';
import {
  emptyLogDraft, hstStartOfDay,
  type StandaloneLogDraft, type ObservedSeaState, type ObservedWind, type LogIncidentLevel,
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
  onClose: () => void;
  onFiled?: (logId: string) => void;
}

export function StandaloneLogFiler({ orgId, vessels, spots, crew, filedBy, onClose, onFiled }: Props) {
  const [draft, setDraft] = React.useState<StandaloneLogDraft>(() => emptyLogDraft());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const patch = (p: Partial<StandaloneLogDraft>) => setDraft((d) => ({ ...d, ...p }));

  const pickVessel = (vesselId: string) => {
    const v = vessels.find((x) => x.vesselId === vesselId);
    patch({ vesselId, vesselName: v?.name ?? '' });
  };
  const toggleSpot = (id: string) =>
    patch({ spotIds: draft.spotIds.includes(id) ? draft.spotIds.filter((s) => s !== id) : [...draft.spotIds, id] });
  const toggleCrew = (m: CrewMember) => {
    const has = draft.crew.some((c) => c.id === m.id);
    patch({ crew: has ? draft.crew.filter((c) => c.id !== m.id) : [...draft.crew, { id: m.id, name: m.name, role: m.role }] });
  };

  const valid = isValid(draft);

  const onSubmit = async () => {
    if (!valid) {
      setError('Pick a vessel and at least one spot. Serious incidents need a description.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const logId = await saveStandaloneLog(orgId, draft, filedBy);
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

            <Block label="④ Observed conditions">
              <FreeTextArea label="Weather observed" value={draft.weather} onChange={(v) => patch({ weather: v })} placeholder="Sunny, scattered clouds, light trades…" rows={2} />
              <Field label="Sea state">
                <ChipSelect options={SEA_STATES} value={draft.seaState || undefined} onChange={(v) => patch({ seaState: v })} />
              </Field>
              <Field label="Wind observed">
                <ChipSelect options={WINDS} value={draft.windObserved || undefined} onChange={(v) => patch({ windObserved: v })} />
              </Field>
              <NumberStepper label="Visibility (ft)" value={draft.visibilityFt} onChange={(v) => patch({ visibilityFt: v })} step={5} min={0} max={150} unit="ft" />
            </Block>

            <Block label="⑤ Crew on duty">
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

            <Block label="⑥ Counts">
              <View style={styles.row2}>
                <NumberStepper label="Duration (hrs)" value={draft.durationHours} onChange={(v) => patch({ durationHours: v })} step={0.5} min={0} max={24} unit="h" />
                <NumberStepper label="Trips run today" value={draft.tripCount} onChange={(v) => patch({ tripCount: v })} step={1} min={0} max={20} />
              </View>
            </Block>

            <Block label="⑦ Incident" required>
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

            <Block label="⑧ Notes">
              <FreeTextArea label="Anything else worth recording" value={draft.notes} onChange={(v) => patch({ notes: v })} placeholder="Optional — gear notes, guest notes, things to flag for tomorrow…" rows={4} />
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
  errCard: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
});
