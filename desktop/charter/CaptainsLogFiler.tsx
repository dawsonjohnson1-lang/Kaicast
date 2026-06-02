// CaptainsLogFiler — 8 quick blocks for filing a post-trip log.
//
// Pre-filled from the trip plan where possible; the captain confirms
// or overrides. Sliders + chip-selects + steppers — no free text
// except the closing notes field. Built for a tablet on a dock.
//
// On submit, the log writes through saveCaptainsLog() which updates
// the trip doc and flips status to 'completed'. The forecast-vs-
// reality delta in the archive then has both sides of the comparison.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ChipSelect, ToggleRow, NumberStepper, StarRating, FreeTextArea } from './inputs';
import { saveCaptainsLog } from './saveCaptainsLog';
import { useCharterSpots } from './useCharterData';
import type {
  CaptainsLog, CaptainsLogSpotNote, CaptainsLogSurface, CaptainsLogUnderwater,
  Trip,
} from './types';

const SWELL_DIR_OPTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const WIND_OPTIONS      = ['Calm', 'Light', 'Moderate', 'Fresh', 'Strong'] as const;
const CHOP_LABELS = ['Glass', 'Light', 'Moderate', 'Rough', 'Very rough'] as const;
const SURFACE_VIS_OPTIONS = ['Crystal', 'Clean', 'Slight', 'Murky'] as const;
const CURRENT_DIR_OPTIONS  = ['With shore', 'Against', 'Parallel', 'Variable', 'Reversing'] as const;
const CURRENT_STRENGTH: ReadonlyArray<{ id: 'none' | 'mild' | 'moderate' | 'strong'; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'mild', label: 'Mild' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'strong', label: 'Strong' },
];
const FORECAST_ACCURACY: ReadonlyArray<{ id: 'matched' | 'better' | 'worse'; label: string }> = [
  { id: 'matched', label: 'Matched' },
  { id: 'better',  label: 'Better than predicted' },
  { id: 'worse',   label: 'Worse than predicted' },
];
const INCIDENT_OPTIONS: ReadonlyArray<{ id: 'none' | 'minor' | 'serious'; label: string }> = [
  { id: 'none',    label: 'None' },
  { id: 'minor',   label: 'Minor' },
  { id: 'serious', label: 'Serious' },
];
const ENTRY_DIFFICULTY: ReadonlyArray<{ id: 'easy' | 'moderate' | 'difficult'; label: string }> = [
  { id: 'easy',      label: 'Easy' },
  { id: 'moderate',  label: 'Moderate' },
  { id: 'difficult', label: 'Difficult' },
];
const MARINE_LIFE_CHIPS = [
  'Turtle', 'Whitetip shark', 'Reef shark', 'Manta', 'Eagle ray', 'Dolphin',
  'Humpback whale', 'Monk seal', 'Octopus', 'Moray eel', 'Frogfish', 'Other',
] as const;

interface Draft {
  surface: CaptainsLogSurface;
  underwater: CaptainsLogUnderwater;
  spotNotes: CaptainsLogSpotNote[];
  forecastAccuracy: 'matched' | 'better' | 'worse' | null;
  freeText: string;
  satisfaction: 1 | 2 | 3 | 4 | 5 | null;
  incident: 'none' | 'minor' | 'serious';
  incidentDetail: string;       // surfaced when incident !== 'none'
  mediaUrls: string[];          // upload wires in Phase 7; we stub the URL list here
}

interface Props {
  orgId: string;
  trip: Trip;
  onClose: () => void;
  onFiled?: (tripId: string) => void;
}

export function CaptainsLogFiler({ orgId, trip, onClose, onFiled }: Props) {
  const { spots: orgSpots } = useCharterSpots(orgId);
  const [draft, setDraft] = React.useState<Draft>(() => seedDraft(trip));
  const [saving, setSaving] = React.useState(false);
  const [error, setError]   = React.useState<string | null>(null);

  const updateSurface = (patch: Partial<CaptainsLogSurface>) =>
    setDraft((d) => ({ ...d, surface: { ...d.surface, ...patch } }));
  const updateUnderwater = (patch: Partial<CaptainsLogUnderwater>) =>
    setDraft((d) => ({ ...d, underwater: { ...d.underwater, ...patch } }));
  const updateSpotNote = (idx: number, patch: Partial<CaptainsLogSpotNote>) =>
    setDraft((d) => ({
      ...d,
      spotNotes: d.spotNotes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));

  const onSubmit = async () => {
    if (!validDraft(draft)) {
      setError('Fill out all required blocks before filing — required blocks are marked with a •.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const log: CaptainsLog = {
        surfaceConditions: draft.surface,
        underwaterConditions: draft.underwater,
        spotNotes: draft.spotNotes,
        forecastAccuracy: draft.forecastAccuracy as CaptainsLog['forecastAccuracy'],
        freeText: draft.freeText.trim(),
        customerSatisfaction: trip.tripType === 'dive' ? (draft.satisfaction ?? null) : null,
        incidentFlag: draft.incident,
        mediaUrls: draft.mediaUrls,
      };
      // Append the incident narrative onto freeText when present so we
      // don't need a schema change for the optional report yet. Phase 7
      // can promote it to its own field when the incident review flow
      // gets wired to a Cloud Function.
      if (draft.incident !== 'none' && draft.incidentDetail.trim()) {
        log.freeText = `${log.freeText}${log.freeText ? '\n\n' : ''}INCIDENT REPORT (${draft.incident.toUpperCase()}): ${draft.incidentDetail.trim()}`;
      }
      await saveCaptainsLog(orgId, trip.id, log);
      onFiled?.(trip.id);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not file log');
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
              <Text style={styles.kicker}>FILE CAPTAIN'S LOG</Text>
              <Text style={styles.title}>{formatTripHeader(trip, orgSpots)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* ── Block 1: Surface conditions ───────────────────── */}
            <Block label="① Surface conditions" required>
              <View style={styles.row2}>
                <NumberStepper
                  label="Swell height (ft)"
                  value={draft.surface.swellHtActual || null}
                  onChange={(v) => updateSurface({ swellHtActual: v ?? 0 })}
                  step={0.5}
                  min={0}
                  max={30}
                  unit="ft"
                />
                <Field label="Swell direction">
                  <ChipSelect
                    options={SWELL_DIR_OPTIONS.map((d) => ({ id: d, label: d }))}
                    value={draft.surface.swellDirActual as typeof SWELL_DIR_OPTIONS[number] | undefined}
                    onChange={(v) => updateSurface({ swellDirActual: v })}
                  />
                </Field>
              </View>
              <Field label="Wind">
                <ChipSelect
                  options={WIND_OPTIONS.map((d) => ({ id: d, label: d }))}
                  value={draft.surface.windActual as typeof WIND_OPTIONS[number] | undefined}
                  onChange={(v) => updateSurface({ windActual: v })}
                />
              </Field>
              <Field label={`Chop · ${CHOP_LABELS[(draft.surface.chopRating ?? 1) - 1]}`}>
                <ChipSelect
                  options={[1, 2, 3, 4, 5].map((n) => ({ id: String(n), label: String(n) }))}
                  value={draft.surface.chopRating ? String(draft.surface.chopRating) : undefined}
                  onChange={(v) => updateSurface({ chopRating: Number(v) as 1 | 2 | 3 | 4 | 5 })}
                />
              </Field>
              <Field label="Surface visibility">
                <ChipSelect
                  options={SURFACE_VIS_OPTIONS.map((d) => ({ id: d, label: d }))}
                  value={draft.surface.surfaceVisActual as typeof SURFACE_VIS_OPTIONS[number] | undefined}
                  onChange={(v) => updateSurface({ surfaceVisActual: v })}
                />
              </Field>
            </Block>

            {/* ── Block 2: Underwater ─────────────────────────── */}
            <Block label="② Underwater" required>
              <View style={styles.row2}>
                <NumberStepper
                  label="Visibility"
                  value={draft.underwater.visFt || null}
                  onChange={(v) => updateUnderwater({ visFt: v ?? 0 })}
                  step={5}
                  min={0}
                  max={150}
                  unit="ft"
                />
                <NumberStepper
                  label="Temp at depth"
                  value={draft.underwater.tempAtDepthF || null}
                  onChange={(v) => updateUnderwater({ tempAtDepthF: v ?? 0 })}
                  step={1}
                  min={50}
                  max={90}
                  unit="°F"
                />
              </View>
              <ToggleRow
                label="Thermocline noted"
                value={draft.underwater.thermoclineNoted}
                onChange={(v) => updateUnderwater({ thermoclineNoted: v, thermoclineDepthFt: v ? draft.underwater.thermoclineDepthFt : null })}
              />
              {draft.underwater.thermoclineNoted ? (
                <NumberStepper
                  label="Thermocline depth"
                  value={draft.underwater.thermoclineDepthFt ?? null}
                  onChange={(v) => updateUnderwater({ thermoclineDepthFt: v })}
                  step={5}
                  min={0}
                  max={200}
                  unit="ft"
                />
              ) : null}
              <Field label="Current direction">
                <ChipSelect
                  options={CURRENT_DIR_OPTIONS.map((d) => ({ id: d, label: d }))}
                  value={draft.underwater.currentDir as typeof CURRENT_DIR_OPTIONS[number] | undefined}
                  onChange={(v) => updateUnderwater({ currentDir: v })}
                />
              </Field>
              <Field label="Current strength">
                <ChipSelect
                  options={CURRENT_STRENGTH}
                  value={draft.underwater.currentStrength}
                  onChange={(v) => updateUnderwater({ currentStrength: v })}
                />
              </Field>
              <ToggleRow
                label="Surge noted"
                value={draft.underwater.surge}
                onChange={(v) => updateUnderwater({ surge: v })}
              />
            </Block>

            {/* ── Block 3: Per-spot notes ─────────────────────── */}
            <Block label="③ Spot notes">
              {draft.spotNotes.length === 0 ? (
                <Text style={styles.muted}>This trip has no spots on the plan — skip.</Text>
              ) : (
                draft.spotNotes.map((sn, i) => (
                  <SpotNoteBlock
                    key={sn.spotId}
                    note={sn}
                    spotName={orgSpots.find((s) => s.id === sn.spotId)?.name ?? sn.spotId}
                    onPatch={(p) => updateSpotNote(i, p)}
                  />
                ))
              )}
            </Block>

            {/* ── Block 4: Forecast accuracy ──────────────────── */}
            <Block label="④ Forecast accuracy" required>
              <ChipSelect
                options={FORECAST_ACCURACY}
                value={draft.forecastAccuracy ?? undefined}
                onChange={(v) => setDraft((d) => ({ ...d, forecastAccuracy: v }))}
              />
            </Block>

            {/* ── Block 5: Free text ─────────────────────────── */}
            <Block label="⑤ Free text">
              <FreeTextArea
                label="Anything else worth noting"
                value={draft.freeText}
                onChange={(v) => setDraft((d) => ({ ...d, freeText: v }))}
                placeholder="Optional. Things that don't fit the chips above — strange currents, unexpected wildlife, gear notes…"
                rows={4}
              />
            </Block>

            {/* ── Block 6: Customer satisfaction (dive only) ── */}
            {trip.tripType === 'dive' ? (
              <Block label="⑥ Customer satisfaction" required>
                <StarRating
                  value={draft.satisfaction}
                  onChange={(v) => setDraft((d) => ({ ...d, satisfaction: v }))}
                />
              </Block>
            ) : null}

            {/* ── Block 7: Incident flag ─────────────────────── */}
            <Block label="⑦ Incident flag" required>
              <ChipSelect
                options={INCIDENT_OPTIONS}
                value={draft.incident}
                onChange={(v) => setDraft((d) => ({ ...d, incident: v }))}
              />
              {draft.incident !== 'none' ? (
                <FreeTextArea
                  label={draft.incident === 'serious' ? 'Incident report — what happened, who was involved, what response was given' : 'What happened'}
                  value={draft.incidentDetail}
                  onChange={(v) => setDraft((d) => ({ ...d, incidentDetail: v }))}
                  placeholder={draft.incident === 'serious'
                    ? 'Required. Coast Guard CG-2692 may be needed for serious incidents — your fleet manager will reach out.'
                    : 'Brief description of the minor incident.'}
                  rows={3}
                />
              ) : null}
            </Block>

            {/* ── Block 8: Media ─────────────────────────────── */}
            <Block label="⑧ Media (optional)">
              <Text style={styles.muted}>
                Photo and video upload to Firebase Storage lands in Phase 7. For now the log saves
                without media; existing trip-record media URLs are preserved.
              </Text>
            </Block>

            {error ? (
              <View style={styles.errCard}>
                <Text style={styles.errTitle}>Could not file log</Text>
                <Text style={styles.errBody}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={onSubmit}
              disabled={saving || !validDraft(draft)}
              style={[styles.fileBtn, (saving || !validDraft(draft)) && styles.fileBtnDisabled]}
            >
              <Text style={[styles.fileBtnText, (saving || !validDraft(draft)) && styles.fileBtnTextDisabled]}>
                {saving ? 'Filing…' : 'File log'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

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
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SpotNoteBlock({
  note,
  spotName,
  onPatch,
}: {
  note: CaptainsLogSpotNote;
  spotName: string;
  onPatch: (patch: Partial<CaptainsLogSpotNote>) => void;
}) {
  const selectedSpecies = parseSpeciesString(note.marineLifeHighlights);
  const toggleSpecies = (sp: string) => {
    const next = selectedSpecies.includes(sp)
      ? selectedSpecies.filter((s) => s !== sp)
      : [...selectedSpecies, sp];
    onPatch({ marineLifeHighlights: next.join(', ') });
  };
  return (
    <View style={styles.spotCard}>
      <Text style={styles.spotName}>{spotName}</Text>
      <Field label="Entry difficulty">
        <ChipSelect
          options={ENTRY_DIFFICULTY}
          value={note.entryDifficulty}
          onChange={(v) => onPatch({ entryDifficulty: v })}
        />
      </Field>
      <Field label="Marine life highlights">
        <View style={styles.chipMultiRow}>
          {MARINE_LIFE_CHIPS.map((sp) => {
            const active = selectedSpecies.includes(sp);
            return (
              <Pressable key={sp} onPress={() => toggleSpecies(sp)} style={[styles.mlChip, active && styles.mlChipActive]}>
                <Text style={[styles.mlChipText, active && styles.mlChipTextActive]}>{sp}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
      <FreeTextArea
        label="Hazards noted"
        value={note.hazardsNoted}
        onChange={(v) => onPatch({ hazardsNoted: v })}
        placeholder="Surge, current at the point, low tide pull, boat traffic…"
        rows={2}
      />
      <ToggleRow
        label="Would return to this spot under similar conditions"
        value={note.wouldReturn}
        onChange={(v) => onPatch({ wouldReturn: v })}
      />
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function seedDraft(trip: Trip): Draft {
  return {
    surface: {
      swellHtActual: 0,
      swellDirActual: '',
      windActual: '',
      chopRating: 1,
      surfaceVisActual: '',
    },
    underwater: {
      visFt: 0,
      tempAtDepthF: 0,
      thermoclineNoted: false,
      thermoclineDepthFt: null,
      currentDir: '',
      currentStrength: 'none',
      surge: false,
    },
    spotNotes: trip.spots.map<CaptainsLogSpotNote>((id) => ({
      spotId: id,
      entryDifficulty: 'moderate',
      marineLifeHighlights: '',
      hazardsNoted: '',
      wouldReturn: true,
    })),
    forecastAccuracy: null,
    freeText: '',
    satisfaction: null,
    incident: 'none',
    incidentDetail: '',
    mediaUrls: [],
  };
}

function validDraft(d: Draft): boolean {
  // Surface
  if (!d.surface.swellHtActual && d.surface.swellHtActual !== 0) return false;
  if (!d.surface.swellDirActual) return false;
  if (!d.surface.windActual) return false;
  if (!d.surface.surfaceVisActual) return false;
  // Underwater
  if (!d.underwater.visFt && d.underwater.visFt !== 0) return false;
  if (!d.underwater.tempAtDepthF) return false;
  if (!d.underwater.currentDir) return false;
  // Forecast accuracy
  if (!d.forecastAccuracy) return false;
  // Incident — serious incidents require the report
  if (d.incident === 'serious' && d.incidentDetail.trim().length < 10) return false;
  return true;
}

function parseSpeciesString(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function formatTripHeader(trip: Trip, orgSpots: ReturnType<typeof useCharterSpots>['spots']): string {
  const dateStr = trip.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const primary = orgSpots.find((s) => s.id === trip.spots[0])?.name ?? trip.spots[0] ?? '—';
  return `${dateStr} · ${trip.departureTime} · ${primary}`;
}

// ─── Styles ──────────────────────────────────────────────────────────

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

  spotCard: { gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong },
  spotName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text1 },

  chipMultiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mlChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  mlChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  mlChipText: { fontFamily: fonts.body, fontSize: 11, color: colors.text2, fontWeight: '600' },
  mlChipTextActive: { color: colors.text1 },

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
