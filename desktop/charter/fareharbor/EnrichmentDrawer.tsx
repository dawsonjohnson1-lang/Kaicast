// EnrichmentDrawer — full-height side panel that lets the captain
// map one FareHarbor product (fh_items doc) to KaiCast metadata:
// trip type + departure harbor + assigned boats + KaiCast spots.
// "Save & activate" patches the fh_items doc and the sync function
// then denormalizes the enrichment onto every fh_trips doc that
// references this item on the next 30-min pass.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../../tokens';
import { SPOTS as PUBLIC_SPOTS } from '../../data/spots';
import { saveItemEnrichment } from './saveFareHarbor';
import { useHarbors } from './useFareHarbor';
import {
  FH_TRIP_TYPE_META, HARBOR_ISLAND_LABEL, HARBOR_ISLAND_TO_SPOT_REGION,
  type FhItem, type FhTripType, type FhItemEnrichment,
} from './types';
import type { Vessel } from '../types';

interface Props {
  orgId: string;
  item: FhItem;
  fleet: Vessel[];
  onClose: () => void;
  onSaved?: (fhItemPk: number) => void;
}

export function EnrichmentDrawer({ orgId, item, fleet, onClose, onSaved }: Props) {
  const { harbors, loading: harborsLoading } = useHarbors();
  const [draft, setDraft] = React.useState<FhItemEnrichment>({
    tripType:       item.tripType,
    boatIds:        item.boatIds,
    harborId:       item.harborId,
    kaicastSpotIds: item.kaicastSpotIds,
    notes:          item.notes,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError]   = React.useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = React.useState(false);

  const dirty = JSON.stringify({
    tripType:       item.tripType,
    boatIds:        item.boatIds,
    harborId:       item.harborId,
    kaicastSpotIds: item.kaicastSpotIds,
    notes:          item.notes,
  }) !== JSON.stringify(draft);

  const valid =
    !!draft.tripType
    && !!draft.harborId
    && draft.boatIds.length > 0
    && draft.kaicastSpotIds.length > 0;

  const attemptClose = () => {
    if (dirty) { setConfirmingClose(true); return; }
    onClose();
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveItemEnrichment(orgId, { fhItemPk: item.fhItemPk, ...draft });
      onSaved?.(item.fhItemPk);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save enrichment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={attemptClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={attemptClose} />
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>ENRICHMENT · FH item #{item.fhItemPk}</Text>
              <Text style={styles.title} numberOfLines={2}>{item.name || '(unnamed)'}</Text>
              {item.headline ? <Text style={styles.subtitle} numberOfLines={2}>{item.headline}</Text> : null}
            </View>
            <Pressable onPress={attemptClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* ── Section 1 — Trip type ── */}
            <Section index={1} title="Trip type" subtitle="What kind of trip does this FH product run?">
              <View style={styles.chipGrid}>
                {(Object.keys(FH_TRIP_TYPE_META) as FhTripType[]).map((t) => {
                  const meta = FH_TRIP_TYPE_META[t];
                  const active = draft.tripType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setDraft((d) => ({ ...d, tripType: t }))}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                    >
                      <Text style={styles.typeChipIcon}>{meta.icon}</Text>
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* ── Section 2 — Departure harbor ── */}
            <Section index={2} title="Departure harbor" subtitle="Pulled from the global Hawaii harbors list.">
              <HarborPicker
                harbors={harbors}
                loading={harborsLoading}
                selected={draft.harborId}
                onSelect={(harborId) => setDraft((d) => ({ ...d, harborId }))}
              />
            </Section>

            {/* ── Section 3 — Assigned boats ── */}
            <Section index={3} title="Assigned boats" subtitle="From your charter fleet — set up at /charter/settings → Fleet.">
              {fleet.length === 0 ? (
                <Text style={styles.muted}>No vessels in your fleet yet. Add at least one in the Fleet tab, then come back.</Text>
              ) : (
                <View style={styles.boatList}>
                  {fleet.map((v) => {
                    const active = draft.boatIds.includes(v.vesselId);
                    return (
                      <Pressable
                        key={v.vesselId}
                        onPress={() => setDraft((d) => ({
                          ...d,
                          boatIds: active
                            ? d.boatIds.filter((id) => id !== v.vesselId)
                            : [...d.boatIds, v.vesselId],
                        }))}
                        style={[styles.boatRow, active && styles.boatRowActive]}
                      >
                        <View style={[styles.checkbox, active && styles.checkboxActive]}>
                          {active ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.boatName}>{v.name || '(unnamed vessel)'}</Text>
                          <Text style={styles.boatMeta}>
                            {v.lengthFt ? `${v.lengthFt}ft` : ''}
                            {v.passengerCapacity ? ` · ${v.passengerCapacity}-pax` : ''}
                            {v.type ? ` · ${v.type.replace(/_/g, ' ')}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Section>

            {/* ── Section 4 — KaiCast spots ── */}
            <Section
              index={4}
              title="KaiCast spots"
              subtitle={
                draft.harborId
                  ? `Filtered to spots on ${HARBOR_ISLAND_LABEL[harbors.find((h) => h.harborId === draft.harborId)?.island ?? 'oahu']}.`
                  : 'Pick a harbor above to filter spots by island.'
              }
            >
              <SpotPicker
                harborId={draft.harborId}
                harbors={harbors}
                selected={draft.kaicastSpotIds}
                onToggle={(spotId) =>
                  setDraft((d) => ({
                    ...d,
                    kaicastSpotIds: d.kaicastSpotIds.includes(spotId)
                      ? d.kaicastSpotIds.filter((id) => id !== spotId)
                      : [...d.kaicastSpotIds, spotId],
                  }))
                }
              />
            </Section>

            {/* ── Notes ── */}
            <Section index={5} title="Notes (optional)" subtitle="Anything the trip planner should know — gear, schedule quirks, special directions.">
              <TextInput
                value={draft.notes}
                onChangeText={(v) => setDraft((d) => ({ ...d, notes: v }))}
                placeholder="Pier 4 board at 6:45am sharp · sets are limited to 6 divers · gear included…"
                placeholderTextColor={colors.text4}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textarea]}
              />
            </Section>

            {error ? (
              <View style={styles.errCard}>
                <Text style={styles.errTitle}>Couldn't save</Text>
                <Text style={styles.errBody}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              {!valid ? (
                <Text style={styles.footerHint}>
                  Pick a trip type · harbor · at least one boat · at least one spot to activate.
                </Text>
              ) : (
                <Text style={styles.footerOk}>Ready to activate.</Text>
              )}
            </View>
            <Pressable onPress={attemptClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={!valid || saving}
              style={[styles.saveBtn, (!valid || saving) && styles.saveBtnDisabled]}
            >
              <Text style={[styles.saveBtnText, (!valid || saving) && styles.saveBtnTextDisabled]}>
                {saving ? 'Saving…' : 'Save & activate'}
              </Text>
            </Pressable>
          </View>

          {/* Unsaved-changes confirmation */}
          {confirmingClose ? (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>Discard changes?</Text>
                <Text style={styles.confirmBody}>
                  You have unsaved edits to this product's enrichment. Closing now drops them.
                </Text>
                <View style={styles.confirmRow}>
                  <Pressable onPress={() => setConfirmingClose(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Keep editing</Text>
                  </Pressable>
                  <Pressable onPress={onClose} style={styles.discardBtn}>
                    <Text style={styles.discardText}>Discard</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Section({
  index, title, subtitle, children,
}: {
  index: number; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>SECTION {index}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

function HarborPicker({
  harbors, loading, selected, onSelect,
}: {
  harbors: ReturnType<typeof useHarbors>['harbors'];
  loading: boolean;
  selected: string | null;
  onSelect: (harborId: string) => void;
}) {
  const [query, setQuery] = React.useState('');
  if (loading) {
    return (
      <View style={styles.pickerLoading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Reading harbors…</Text>
      </View>
    );
  }
  if (harbors.length === 0) {
    return (
      <Text style={styles.muted}>
        The /harbors collection is empty. Run the seedHarbors callable once to populate it.
      </Text>
    );
  }
  const q = query.trim().toLowerCase();
  const filtered = q.length === 0
    ? harbors
    : harbors.filter((h) =>
        h.name.toLowerCase().includes(q)
        || h.aka.some((a) => a.toLowerCase().includes(q))
        || HARBOR_ISLAND_LABEL[h.island].toLowerCase().includes(q),
      );
  const selectedHarbor = harbors.find((h) => h.harborId === selected);
  return (
    <View style={{ gap: 8 }}>
      {selectedHarbor ? (
        <View style={styles.selectedHarborChip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedHarborName}>{selectedHarbor.name}</Text>
            <Text style={styles.selectedHarborMeta}>
              {HARBOR_ISLAND_LABEL[selectedHarbor.island]} · {selectedHarbor.lat.toFixed(4)}, {selectedHarbor.lng.toFixed(4)}
            </Text>
          </View>
          <Pressable onPress={() => onSelect('')} style={styles.unlinkBtn}>
            <Text style={styles.unlinkText}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by harbor name or island…"
            placeholderTextColor={colors.text4}
            style={styles.input}
            autoCapitalize="none"
          />
          <View style={styles.matchList}>
            {filtered.slice(0, 12).map((h) => (
              <Pressable key={h.harborId} onPress={() => { onSelect(h.harborId); setQuery(''); }} style={styles.matchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchName}>{h.name}</Text>
                  <Text style={styles.matchMeta}>{HARBOR_ISLAND_LABEL[h.island]}</Text>
                </View>
              </Pressable>
            ))}
            {filtered.length === 0 ? (
              <Text style={styles.muted}>No harbors match "{query.trim()}".</Text>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function SpotPicker({
  harborId, harbors, selected, onToggle,
}: {
  harborId: string | null;
  harbors: ReturnType<typeof useHarbors>['harbors'];
  selected: string[];
  onToggle: (spotId: string) => void;
}) {
  const harbor = harbors.find((h) => h.harborId === harborId);
  const region = harbor ? HARBOR_ISLAND_TO_SPOT_REGION[harbor.island] : null;
  // Public KaiCast spots filtered by region (or all when no harbor yet).
  const spots = React.useMemo(
    () => (region ? PUBLIC_SPOTS.filter((s) => s.region === region) : PUBLIC_SPOTS),
    [region],
  );
  if (spots.length === 0) {
    return <Text style={styles.muted}>No KaiCast spots in this region yet.</Text>;
  }
  return (
    <View style={styles.spotGrid}>
      {spots.map((s) => {
        const active = selected.includes(s.id);
        return (
          <Pressable
            key={s.id}
            onPress={() => onToggle(s.id)}
            style={[styles.spotChip, active && styles.spotChipActive]}
          >
            <View style={[styles.checkboxSm, active && styles.checkboxActive]}>
              {active ? <Text style={styles.checkboxCheck}>✓</Text> : null}
            </View>
            <Text style={[styles.spotChipText, active && styles.spotChipTextActive]} numberOfLines={1}>
              {s.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: 'row' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { width: '100%', maxWidth: 640, backgroundColor: colors.surface0, borderLeftWidth: 1, borderLeftColor: colors.hairlineStrong, flexDirection: 'column' },

  header: { padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1, letterSpacing: -0.2, marginTop: 4 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, marginTop: 4 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: colors.text2, lineHeight: 22 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 22 },

  section: { gap: 4 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.text4, fontWeight: '700', letterSpacing: 1.5 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text1 },
  sectionSub: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  typeChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  typeChipIcon: { fontSize: 14 },
  typeChipText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },
  typeChipTextActive: { color: colors.text1 },

  pickerLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  input: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, fontFamily: fonts.body, fontSize: 13, color: colors.text1 },
  textarea: { minHeight: 64, textAlignVertical: 'top' },

  selectedHarborChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.06)' },
  selectedHarborName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  selectedHarborMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 2 },
  unlinkBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  unlinkText: { fontFamily: fonts.body, fontSize: 11, color: colors.text2, fontWeight: '600' },

  matchList: { gap: 2, padding: 4, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline, maxHeight: 280 },
  matchRow: { padding: 10, borderRadius: radius.sm },
  matchName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  matchMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 2 },

  boatList: { gap: 6 },
  boatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  boatRowActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.06)' },
  boatName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  boatMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 2 },

  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxSm: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxCheck: { color: colors.bg, fontSize: 12, fontWeight: '800' },

  spotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spotChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  spotChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.06)' },
  spotChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.text2 },
  spotChipTextActive: { color: colors.text1 },

  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontStyle: 'italic' },

  errCard: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.surface1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerHint: { fontFamily: fonts.body, fontSize: 11, color: colors.text3 },
  footerOk: { fontFamily: fonts.body, fontSize: 11, color: '#3DDC84', fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  cancelText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text2 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  saveBtnDisabled: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.hairlineStrong },
  saveBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  saveBtnTextDisabled: { color: colors.text4 },

  confirmOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 12, maxWidth: 360 },
  confirmTitle: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.text1 },
  confirmBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 19 },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  discardBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: '#F73726' },
  discardText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: '#fff' },
});
