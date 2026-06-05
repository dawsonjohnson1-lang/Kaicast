// CrewEditModal — add or edit a single crew member. Cert sub-list
// supports add/remove individual cert rows; each row picks type +
// issuing agency + expiry date.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ChipSelect } from './inputs';
import {
  createCrewMember, updateCrewMember, deleteCrewMember, blankCert,
  type CrewFormInput,
} from './saveCrewMember';
import type { Cert, CrewMember, CrewRole } from './types';

const ROLE_OPTIONS: ReadonlyArray<{ id: CrewRole; label: string }> = [
  { id: 'owner',      label: 'Owner' },
  { id: 'manager',    label: 'Manager' },
  { id: 'captain',    label: 'Captain' },
  { id: 'divemaster', label: 'Divemaster' },
  { id: 'instructor', label: 'Instructor' },
  { id: 'deckhand',   label: 'Deckhand' },
];

const CERT_TYPES: ReadonlyArray<{ id: Cert['type']; label: string }> = [
  { id: 'USCG',        label: 'USCG (Captain)' },
  { id: 'DiveMaster',  label: 'DiveMaster' },
  { id: 'Instructor',  label: 'Instructor' },
  { id: 'CPR',         label: 'CPR' },
  { id: 'O2Provider',  label: 'O2 Provider' },
];

interface Draft {
  name: string;
  role: CrewRole;
  certs: Cert[];
  uid: string;
}

interface Props {
  orgId: string;
  existing?: CrewMember;
  onClose: () => void;
}

export function CrewEditModal({ orgId, existing, onClose }: Props) {
  const isEdit = !!existing;
  const [draft, setDraft] = React.useState<Draft>(() => seed(existing));
  const [saving, setSaving] = React.useState(false);
  const [error, setError]   = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const addCert    = () => setDraft((d) => ({ ...d, certs: [...d.certs, blankCert()] }));
  const removeCert = (i: number) => setDraft((d) => ({ ...d, certs: d.certs.filter((_, idx) => idx !== i) }));
  const patchCert  = (i: number, p: Partial<Cert>) =>
    setDraft((d) => ({ ...d, certs: d.certs.map((c, idx) => (idx === i ? { ...c, ...p } : c)) }));

  const validate = (): string | null => {
    if (!draft.name.trim()) return 'Name is required.';
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    const payload: CrewFormInput = {
      name: draft.name.trim(),
      role: draft.role,
      certs: draft.certs,
      uid: draft.uid.trim() || null,
    };
    try {
      if (existing) await updateCrewMember(orgId, existing.id, payload);
      else await createCrewMember(orgId, payload);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not save crew');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteCrewMember(orgId, existing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Could not delete crew');
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
              <Text style={styles.kicker}>{isEdit ? 'EDIT CREW' : 'ADD CREW'}</Text>
              <Text style={styles.title}>{isEdit ? existing!.name : 'New crew member'}</Text>
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
                placeholder="Kai Mahalo"
                placeholderTextColor={colors.text4}
                style={styles.input}
              />
            </Field>

            <Field label="Role">
              <ChipSelect
                options={ROLE_OPTIONS}
                value={draft.role}
                onChange={(v) => setDraft((d) => ({ ...d, role: v }))}
              />
            </Field>

            <Field label="Linked KaiCast user uid (optional)">
              <TextInput
                value={draft.uid}
                onChangeText={(v) => setDraft((d) => ({ ...d, uid: v }))}
                placeholder="Their KaiCast uid — leave blank if they don't have an account yet"
                placeholderTextColor={colors.text4}
                style={styles.input}
              />
            </Field>

            <View style={styles.certsBlock}>
              <View style={styles.certsHeader}>
                <Text style={styles.fieldLabel}>Certs</Text>
                <Pressable onPress={addCert} style={styles.addCertBtn}>
                  <Text style={styles.addCertText}>+ Add cert</Text>
                </Pressable>
              </View>
              {draft.certs.length === 0 ? (
                <Text style={styles.muted}>No certs yet. Add at least the ones required for {ROLE_OPTIONS.find((r) => r.id === draft.role)?.label}.</Text>
              ) : (
                draft.certs.map((c, i) => (
                  <CertEditor
                    key={i}
                    cert={c}
                    onPatch={(p) => patchCert(i, p)}
                    onRemove={() => removeCert(i)}
                  />
                ))
              )}
            </View>

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
                      Remove "{existing!.name}" from the roster? Trips that referenced this crew
                      member keep the stale id — delete only when they're not assigned to any
                      future trip.
                    </Text>
                    <View style={styles.confirmRow}>
                      <Pressable onPress={() => setConfirmingDelete(false)} style={styles.cancelBtn}>
                        <Text style={styles.cancelText}>Keep</Text>
                      </Pressable>
                      <Pressable onPress={onDelete} disabled={saving} style={styles.deleteConfirmBtn}>
                        <Text style={styles.deleteConfirmText}>{saving ? '…' : 'Remove'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setConfirmingDelete(true)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>Remove from roster</Text>
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
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to roster'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CertEditor({
  cert,
  onPatch,
  onRemove,
}: {
  cert: Cert;
  onPatch: (patch: Partial<Cert>) => void;
  onRemove: () => void;
}) {
  const expiryStr = isFinite(cert.expiresAt.getTime()) && cert.expiresAt.getTime() > 0
    ? formatYmd(cert.expiresAt)
    : '';
  return (
    <View style={styles.certRow}>
      <View style={styles.certCol}>
        <Text style={styles.certColLabel}>TYPE</Text>
        <ChipSelect
          options={CERT_TYPES.map((c) => ({ id: c.id, label: c.id }))}
          value={cert.type}
          onChange={(v) => onPatch({ type: v })}
        />
      </View>
      <View style={styles.certColRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.certColLabel}>ISSUED BY</Text>
          <TextInput
            value={cert.issuedBy}
            onChangeText={(v) => onPatch({ issuedBy: v })}
            placeholder="PADI / NAUI / USCG / Red Cross / …"
            placeholderTextColor={colors.text4}
            style={styles.input}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.certColLabel}>EXPIRES</Text>
          <TextInput
            value={expiryStr}
            onChangeText={(v) => {
              const parsed = parseYmd(v);
              if (parsed) onPatch({ expiresAt: parsed });
              else if (v === '') onPatch({ expiresAt: new Date(0) });
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text4}
            style={styles.input}
          />
        </View>
        <Pressable onPress={onRemove} style={styles.removeCertBtn}>
          <Text style={styles.removeCertText}>×</Text>
        </Pressable>
      </View>
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

function seed(existing?: CrewMember): Draft {
  if (existing) {
    return {
      name: existing.name,
      role: existing.role,
      certs: existing.certs.map((c) => ({ ...c })),
      uid: existing.uid ?? '',
    };
  }
  return { name: '', role: 'deckhand', certs: [], uid: '' };
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYmd(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 720, maxHeight: '92%', backgroundColor: colors.surface0, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, overflow: 'hidden' },

  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 16 },
  kicker: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.text1, marginTop: 4 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: colors.text2, lineHeight: 22 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 18 },

  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  input: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface1, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.hairlineStrong,
    fontFamily: fonts.body, fontSize: 13, color: colors.text1,
  },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontStyle: 'italic' },

  certsBlock: { gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.hairline },
  certsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addCertBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  addCertText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: colors.accent },

  certRow: { padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 10 },
  certCol: { gap: 6 },
  certColRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  certColLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.text3, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  removeCertBtn: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0, alignItems: 'center', justifyContent: 'center' },
  removeCertText: { fontFamily: fonts.display, fontSize: 18, color: colors.text2, lineHeight: 18 },

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
