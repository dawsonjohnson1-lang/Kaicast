// InviteCrewModal — collects email + role + optional display name and
// hands them to the createCrewInvitation callable. On success, shows
// a confirmation step with the acceptUrl ready to copy (since the
// email-sending flow lives in Slice C2 — the admin can paste the link
// into whichever messenger they prefer for now).
//
// Wire-up lives in CharterCrewScreen.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { ChipSelect } from './inputs';
import { createCrewInvitation, type CreateInvitationResult } from './createCrewInvitation';
import type { InvitedRole } from './useCharterInvitations';

const ROLE_OPTIONS: ReadonlyArray<{ id: InvitedRole; label: string }> = [
  { id: 'captain',    label: 'Captain' },
  { id: 'divemaster', label: 'Divemaster' },
  { id: 'deckhand',   label: 'Deckhand' },
];

interface Props {
  orgId: string;
  onClose: () => void;
}

interface Draft {
  email: string;
  role: InvitedRole;
  displayName: string;
}

const INITIAL: Draft = { email: '', role: 'captain', displayName: '' };

export function InviteCrewModal({ orgId, onClose }: Props) {
  const [draft, setDraft] = React.useState<Draft>(INITIAL);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CreateInvitationResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  const onSend = async () => {
    const email = draft.email.trim();
    if (!email) { setError('Email is required.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('That email looks malformed.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await createCrewInvitation({
        orgId,
        invitedEmail: email,
        role: draft.role,
        displayName: draft.displayName.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message || 'Could not create invitation.');
    } finally {
      setSending(false);
    }
  };

  const onCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy to clipboard. Select the link manually.');
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <ScrollView style={{ maxHeight: '80vh' as unknown as number }} contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Invite crew</Text>
            <Text style={styles.subtitle}>
              They'll get a deep-linked invite to /invite/&lt;id&gt;. Once accepted, they'll join your crew with Pro features unlocked.
            </Text>

            {!result ? (
              <>
                <Field label="Email">
                  <TextInput
                    value={draft.email}
                    onChangeText={(t) => setDraft((d) => ({ ...d, email: t }))}
                    placeholder="captain@example.com"
                    placeholderTextColor={colors.text3}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                    editable={!sending}
                  />
                </Field>

                <Field label="Role">
                  <ChipSelect
                    options={ROLE_OPTIONS}
                    value={draft.role}
                    onChange={(v: InvitedRole) => setDraft((d) => ({ ...d, role: v }))}
                  />
                </Field>

                <Field label="Display name (optional)">
                  <TextInput
                    value={draft.displayName}
                    onChangeText={(t) => setDraft((d) => ({ ...d, displayName: t }))}
                    placeholder="What to call them in the invite"
                    placeholderTextColor={colors.text3}
                    style={styles.input}
                    editable={!sending}
                  />
                </Field>

                {error ? <Text style={styles.errText}>{error}</Text> : null}

                <View style={styles.actions}>
                  <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]} disabled={sending}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSend}
                    style={[styles.btn, styles.btnPrimary, sending && styles.btnDisabled]}
                    disabled={sending}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {sending ? 'Sending…' : 'Send invitation'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.successWrap}>
                <Text style={styles.successTitle}>
                  {result.reused ? 'Invitation already pending' : 'Invitation created'}
                </Text>
                <Text style={styles.successBody}>
                  {result.reused
                    ? `A pending invite for this email already exists. The link below works either way.`
                    : `${result.orgName} → ${draft.email} as ${labelForRole(result.role)}. Expires in 7 days.`}
                </Text>
                <Text style={styles.linkLabel}>Accept link</Text>
                <View style={styles.linkRow}>
                  <Text style={styles.linkText} numberOfLines={1}>{result.acceptUrl}</Text>
                  <Pressable onPress={onCopy} style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>{copied ? 'Copied ✓' : 'Copy'}</Text>
                  </Pressable>
                </View>
                <Text style={styles.hint}>
                  Auto-sent invitation emails land with the next deploy. Until then, paste this link into whichever messenger you use.
                </Text>
                {error ? <Text style={styles.errText}>{error}</Text> : null}
                <View style={styles.actions}>
                  <Pressable onPress={onClose} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={styles.btnPrimaryText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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

function labelForRole(r: InvitedRole): string {
  return ROLE_OPTIONS.find((o) => o.id === r)?.label ?? r;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.surface0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    overflow: 'hidden',
  },
  scroll: { padding: 24, gap: 18 },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    lineHeight: 18,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
  },
  errText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#F73726',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.hairlineStrong },
  btnGhostText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text2 },
  btnDisabled: { opacity: 0.5 },

  successWrap: { gap: 10 },
  successTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  successBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 18,
  },
  linkLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  linkText: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text2,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
