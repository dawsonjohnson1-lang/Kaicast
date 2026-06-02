// SpotEditModal — add or edit a single charter spot. Same modal
// covers both flows; the only difference is whether `existing` is
// passed (then we updateDoc instead of addDoc).
//
// Coordinate inputs are plain text — captains know their spots by
// numerical coords already. A proper map-pin picker is a Phase 7
// follow-up alongside the brief-share Cloud Function.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ChipSelect, ToggleRow } from './inputs';
import { createCharterSpot, updateCharterSpot, deleteCharterSpot, type SpotFormInput } from './saveCharterSpot';
import { SPOTS as PUBLIC_SPOTS } from '../data/spots';
import type { CharterSpot, TripType } from './types';

const TRIP_TYPES: ReadonlyArray<{ id: TripType; label: string }> = [
  { id: 'dive',         label: '🤿 Scuba' },
  { id: 'freedive',     label: '🫁 Freedive' },
  { id: 'snorkel',      label: '🐠 Snorkel' },
  { id: 'spearfishing', label: '🎣 Spear' },
];

const TIDE_PREFS: ReadonlyArray<{ id: CharterSpot['tidePreference']; label: string }> = [
  { id: 'low',   label: 'Low' },
  { id: 'high',  label: 'High' },
  { id: 'slack', label: 'Slack' },
  { id: 'any',   label: 'Any' },
];

interface DraftSpot {
  name: string;
  lat: string;            // text while editing; parsed on save
  lng: string;
  isPrivate: boolean;
  linkedPublicSpotId: string | null;
  tripTypes: TripType[];
  maxGroupSize: string;
  depthFt: string;
  tidePreference: CharterSpot['tidePreference'];
  notes: string;
  goodWindowAlertsEnabled: boolean;
}

interface Props {
  orgId: string;
  existing?: CharterSpot;
  onClose: () => void;
  onSaved?: (spotId: string) => void;
  onDeleted?: (spotId: string) => void;
}

export function SpotEditModal({ orgId, existing, onClose, onSaved, onDeleted }: Props) {
  const isEdit = !!existing;
  const [draft, setDraft] = React.useState<DraftSpot>(() => seedDraft(existing));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const toggleTripType = (t: TripType) => {
    setDraft((d) => ({
      ...d,
      tripTypes: d.tripTypes.includes(t)
        ? d.tripTypes.filter((x) => x !== t)
        : [...d.tripTypes, t],
    }));
  };

  const validate = (): string | null => {
    if (!draft.name.trim()) return 'Name is required.';
    const lat = parseFloat(draft.lat);
    const lng = parseFloat(draft.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
    const depth = parseFloat(draft.depthFt);
    if (draft.depthFt && (!Number.isFinite(depth) || depth < 0)) return 'Depth must be a positive number.';
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const payload: SpotFormInput = {
      name: draft.name.trim(),
      lat: parseFloat(draft.lat),
      lng: parseFloat(draft.lng),
      isPrivate: draft.isPrivate,
      linkedPublicSpotId: draft.linkedPublicSpotId,
      tripTypes: draft.tripTypes,
      maxGroupSize: parseInt(draft.maxGroupSize, 10) || 0,
      depthFt: parseFloat(draft.depthFt) || 0,
      tidePreference: draft.tidePreference,
      notes: draft.notes.trim(),
      goodWindowAlertsEnabled: draft.goodWindowAlertsEnabled,
    };
    try {
      let id: string;
      if (existing) {
        await updateCharterSpot(orgId, existing.id, payload);
        id = existing.id;
      } else {
        id = await createCharterSpot(orgId, payload);
      }
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save spot');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteCharterSpot(orgId, existing.id);
      onDeleted?.(existing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not delete spot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{isEdit ? 'EDIT SPOT' : 'ADD SPOT'}</Text>
              <Text style={styles.title}>{isEdit ? existing!.name : 'New spot'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Field label="Name">
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder="Sharks Cove (north end)"
                placeholderTextColor={colors.text4}
                style={styles.input}
              />
            </Field>

            <View style={styles.row2}>
              <Field label="Latitude">
                <TextInput
                  value={draft.lat}
                  onChangeText={(v) => setDraft((d) => ({ ...d, lat: sanitizeCoord(v) }))}
                  placeholder="21.6545"
                  placeholderTextColor={colors.text4}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
              <Field label="Longitude">
                <TextInput
                  value={draft.lng}
                  onChangeText={(v) => setDraft((d) => ({ ...d, lng: sanitizeCoord(v) }))}
                  placeholder="-158.0651"
                  placeholderTextColor={colors.text4}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
            </View>

            <View style={styles.row2}>
              <Field label="Depth (ft)">
                <TextInput
                  value={draft.depthFt}
                  onChangeText={(v) => setDraft((d) => ({ ...d, depthFt: v.replace(/[^0-9.]/g, '') }))}
                  placeholder="40"
                  placeholderTextColor={colors.text4}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
              <Field label="Max group size">
                <TextInput
                  value={draft.maxGroupSize}
                  onChangeText={(v) => setDraft((d) => ({ ...d, maxGroupSize: v.replace(/[^0-9]/g, '') }))}
                  placeholder="6"
                  placeholderTextColor={colors.text4}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
            </View>

            <Field label="Trip types this spot supports">
              <View style={styles.chipRow}>
                {TRIP_TYPES.map((t) => {
                  const active = draft.tripTypes.includes(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => toggleTripType(t.id)}
                      style={[styles.choiceChip, active && styles.choiceChipActive]}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Tide preference">
              <ChipSelect
                options={TIDE_PREFS}
                value={draft.tidePreference}
                onChange={(v) => setDraft((d) => ({ ...d, tidePreference: v }))}
              />
            </Field>

            <Field label="Link to a public KaiCast spot (for forecast data)">
              <PublicSpotLinker
                value={draft.linkedPublicSpotId}
                onChange={(id) => setDraft((d) => ({ ...d, linkedPublicSpotId: id }))}
              />
            </Field>

            <ToggleRow
              label="Keep private (hide from any future 'share my spots' feature)"
              value={draft.isPrivate}
              onChange={(v) => setDraft((d) => ({ ...d, isPrivate: v }))}
            />

            <ToggleRow
              label="Good Window alerts — notify me when this spot returns to Good or better"
              value={draft.goodWindowAlertsEnabled}
              onChange={(v) => setDraft((d) => ({ ...d, goodWindowAlertsEnabled: v }))}
            />

            <Field label="Notes (optional)">
              <TextInput
                value={draft.notes}
                onChangeText={(v) => setDraft((d) => ({ ...d, notes: v }))}
                placeholder="Best entry on flat days from the south side; surge picks up over the lava shelf when north swell is over 3ft…"
                placeholderTextColor={colors.text4}
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textarea]}
              />
            </Field>

            {error ? (
              <View style={styles.errCard}>
                <Text style={styles.errTitle}>Can't save</Text>
                <Text style={styles.errBody}>{error}</Text>
              </View>
            ) : null}

            {isEdit ? (
              <View style={styles.dangerWrap}>
                {confirmingDelete ? (
                  <View style={styles.confirmDelete}>
                    <Text style={styles.confirmText}>
                      Delete "{existing!.name}"? Trips that reference this spot keep the stale id —
                      delete from the library only when you don't dive it anymore.
                    </Text>
                    <View style={styles.confirmRow}>
                      <Pressable onPress={() => setConfirmingDelete(false)} style={styles.cancelBtn}>
                        <Text style={styles.cancelText}>Keep</Text>
                      </Pressable>
                      <Pressable onPress={onDelete} disabled={saving} style={styles.deleteConfirmBtn}>
                        <Text style={styles.deleteConfirmText}>{saving ? '…' : 'Delete spot'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setConfirmingDelete(true)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>Delete this spot from the library</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            >
              <Text style={[styles.saveBtnText, saving && styles.saveBtnTextDisabled]}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add spot'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── PublicSpotLinker ────────────────────────────────────────────────

function PublicSpotLinker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = React.useState('');
  const selected = value ? PUBLIC_SPOTS.find((s) => s.id === value) ?? null : null;

  if (selected) {
    return (
      <View style={styles.linkedRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.linkedTitle}>{selected.name}</Text>
          <Text style={styles.linkedMeta}>{selected.region} · {selected.id}</Text>
        </View>
        <Pressable onPress={() => onChange(null)} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Unlink</Text>
        </Pressable>
      </View>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = q.length === 0
    ? []
    : PUBLIC_SPOTS.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.region ?? '').toLowerCase().includes(q),
      ).slice(0, 6);

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search 39 public spots… (e.g. electric, north shore, two-step)"
        placeholderTextColor={colors.text4}
        style={styles.input}
      />
      {matches.length > 0 ? (
        <View style={styles.matchList}>
          {matches.map((s) => (
            <Pressable key={s.id} onPress={() => { onChange(s.id); setQuery(''); }} style={styles.matchRow}>
              <Text style={styles.matchName}>{s.name}</Text>
              <Text style={styles.matchMeta}>{s.region} · {s.id}</Text>
            </Pressable>
          ))}
        </View>
      ) : query.trim().length > 0 ? (
        <Text style={styles.muted}>No public spots match "{query.trim()}". This spot will work without a link, but the readiness calendar and trip planner won't have forecast data for it until you link it.</Text>
      ) : null}
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function seedDraft(existing?: CharterSpot): DraftSpot {
  if (existing) {
    return {
      name: existing.name,
      lat: String(existing.lat),
      lng: String(existing.lng),
      isPrivate: existing.isPrivate,
      linkedPublicSpotId: existing.linkedPublicSpotId,
      tripTypes: existing.tripTypes,
      maxGroupSize: String(existing.maxGroupSize || ''),
      depthFt: String(existing.depthFt || ''),
      tidePreference: existing.tidePreference,
      notes: existing.notes,
      goodWindowAlertsEnabled: existing.goodWindowAlertsEnabled ?? false,
    };
  }
  return {
    name: '',
    lat: '',
    lng: '',
    isPrivate: true,
    linkedPublicSpotId: null,
    tripTypes: [],
    maxGroupSize: '',
    depthFt: '',
    tidePreference: 'any',
    notes: '',
    goodWindowAlertsEnabled: false,
  };
}

function sanitizeCoord(s: string): string {
  let out = s.replace(/[^0-9.\-]/g, '');
  if (out.length > 0) {
    const first = out[0] === '-' ? '-' : '';
    out = first + out.slice(first.length).replace(/-/g, '');
  }
  const dot = out.indexOf('.');
  if (dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '');
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 720, maxHeight: '92%', backgroundColor: colors.surface0, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, overflow: 'hidden' },

  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 16 },
  kicker: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.text1, marginTop: 4 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: colors.text2, lineHeight: 22 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },

  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  input: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface1, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.hairlineStrong,
    fontFamily: fonts.body, fontSize: 13, color: colors.text1,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  choiceChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  choiceText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },
  choiceTextActive: { color: colors.text1 },

  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: 'rgba(9,161,251,0.10)', borderWidth: 1, borderColor: colors.accent },
  linkedTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  linkedMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 2 },
  matchList: { gap: 4, padding: 4, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  matchRow: { padding: 10, borderRadius: radius.sm, gap: 2 },
  matchName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  matchMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3 },

  errCard: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },

  dangerWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.hairline },
  deleteBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: '#F73726' },
  deleteText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: '#F73726' },
  confirmDelete: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.06)', borderWidth: 1, borderColor: '#F73726', gap: 12 },
  confirmText: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  deleteConfirmBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: '#F73726' },
  deleteConfirmText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text1 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.surface1 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  cancelText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text2 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  saveBtnTextDisabled: { color: colors.text4 },
});
