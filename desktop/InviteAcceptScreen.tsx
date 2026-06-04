// InviteAcceptScreen — landing for /invite/:inviteId.
//
// Reads invite info via the unauth `getCrewInvitationPublic` callable
// so we can render org / role / expiry before the user signs in.
// Three trunk states (gated by status + auth + email match):
//
//   1. invite not found / expired / already-handled → message + link home
//   2. signed-out, invite pending → landing card + inline auth form
//      (pre-filled with invitedEmail; only the password is editable)
//   3. signed-in, invite pending → "Accept invitation" button
//      Two sub-states:
//        a. token email matches invitedEmail → enabled Accept
//        b. mismatch → message + "Sign out and try again"
//
// On accept we route the user to /dashboard for now. When Slice D
// lands the /crew shell, we'll redirect there so the freshly-flipped
// activeContext lands them in the crew dashboard.

import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, firebaseConfigured } from './firebase';
import { useAuth } from './hooks/useAuth';
import { colors, fonts, radius } from './tokens';
import type { NavigateFn } from './router';

interface PublicInviteFound {
  found: true;
  orgId: string;
  orgName: string;
  invitedEmail: string;
  invitedDisplayName: string | null;
  role: 'captain' | 'divemaster' | 'deckhand';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: number | null;
}
type PublicInvite = PublicInviteFound | { found: false };

const ROLE_LABELS: Record<PublicInviteFound['role'], string> = {
  captain: 'Captain',
  divemaster: 'Divemaster',
  deckhand: 'Deckhand',
};

interface Props {
  inviteId: string;
  onNavigate?: NavigateFn;
}

export function InviteAcceptScreen({ inviteId, onNavigate }: Props) {
  const auth = useAuth();
  const [invite, setInvite] = React.useState<PublicInvite | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);

  // Initial fetch — once per inviteId. The callable is idempotent so a
  // second call after sign-in is fine but unnecessary; we re-fetch
  // only when inviteId changes.
  React.useEffect(() => {
    let cancelled = false;
    setInvite(null);
    setLoadErr(null);
    (async () => {
      if (!firebaseConfigured || !app) {
        setLoadErr('Firebase is not configured.');
        return;
      }
      try {
        const fn = httpsCallable<{ inviteId: string }, PublicInvite>(
          getFunctions(app, 'us-central1'),
          'getCrewInvitationPublic',
        );
        const { data } = await fn({ inviteId });
        if (!cancelled) setInvite(data);
      } catch (e) {
        if (!cancelled) setLoadErr(prettyError(e));
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  if (loadErr) {
    return (
      <ScreenShell>
        <Card title="Couldn't load invitation" body={loadErr}
          actionLabel="Go home" onAction={() => onNavigate?.('landing')} />
      </ScreenShell>
    );
  }

  if (invite === null) {
    return (
      <ScreenShell>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading invitation…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!invite.found) {
    return (
      <ScreenShell>
        <Card
          title="Invitation not found"
          body="This invitation link is invalid. Double-check the URL, or ask the charter admin for a fresh invite."
          actionLabel="Go home"
          onAction={() => onNavigate?.('landing')}
        />
      </ScreenShell>
    );
  }

  if (invite.status === 'expired') {
    return (
      <ScreenShell>
        <Card
          title="This invitation has expired"
          body={`Invitations expire 7 days after they're sent. Ask the admin at ${invite.orgName} to send a new one.`}
          actionLabel="Go home"
          onAction={() => onNavigate?.('landing')}
        />
      </ScreenShell>
    );
  }

  if (invite.status === 'declined') {
    return (
      <ScreenShell>
        <Card
          title="Invitation declined"
          body="This invitation was previously declined. Ask the admin to send a new one if that was a mistake."
          actionLabel="Go home"
          onAction={() => onNavigate?.('landing')}
        />
      </ScreenShell>
    );
  }

  if (invite.status === 'accepted') {
    return (
      <ScreenShell>
        <Card
          title="Already accepted"
          body={`This invitation to ${invite.orgName} has already been accepted. Sign in if you haven't on this device yet.`}
          actionLabel={auth.user ? 'Go to dashboard' : 'Sign in'}
          onAction={() => onNavigate?.(auth.user ? 'dashboard' : 'signin')}
        />
      </ScreenShell>
    );
  }

  // invite.status === 'pending' from here on.
  // Show landing card with org / role / who.

  if (!auth.user) {
    return (
      <ScreenShell>
        <InviteLandingCard invite={invite}>
          <InlineAuthForm invitedEmail={invite.invitedEmail} />
        </InviteLandingCard>
      </ScreenShell>
    );
  }

  // Signed in. Compare emails (case-insensitive).
  const callerEmail = (auth.user.email ?? '').toLowerCase();
  const targetEmail = invite.invitedEmail.toLowerCase();
  if (callerEmail !== targetEmail) {
    return (
      <ScreenShell>
        <InviteLandingCard invite={invite}>
          <View style={styles.mismatchWrap}>
            <Text style={styles.mismatchText}>
              You're signed in as <Text style={styles.mono}>{auth.user.email}</Text>, but this
              invitation is for <Text style={styles.mono}>{invite.invitedEmail}</Text>.
            </Text>
            <Pressable
              style={styles.btnPrimary}
              onPress={async () => {
                try { await auth.signOut(); } catch { /* shrug */ }
              }}
            >
              <Text style={styles.btnPrimaryText}>Sign out and try again</Text>
            </Pressable>
          </View>
        </InviteLandingCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <InviteLandingCard invite={invite}>
        <AcceptBlock inviteId={inviteId} invite={invite} onNavigate={onNavigate} />
      </InviteLandingCard>
    </ScreenShell>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function InviteLandingCard({
  invite,
  children,
}: {
  invite: PublicInviteFound;
  children: React.ReactNode;
}) {
  const days = invite.expiresAt
    ? Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 86_400_000))
    : null;
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Crew invitation</Text>
      <Text style={styles.heading}>{invite.orgName}</Text>
      <Text style={styles.subheading}>
        You're invited to join as <Text style={styles.role}>{ROLE_LABELS[invite.role]}</Text>.
      </Text>

      <View style={styles.metaRow}>
        <MetaItem label="Email" value={invite.invitedEmail} mono />
        {days !== null ? <MetaItem label="Expires" value={`in ${days} day${days === 1 ? '' : 's'}`} /> : null}
      </View>

      <View style={styles.perks}>
        <Text style={styles.perksTitle}>Joining unlocks</Text>
        <Text style={styles.perksItem}>· Trip briefs + conditions snapshots for every trip you're assigned to</Text>
        <Text style={styles.perksItem}>· Pro forecast features comped while you're active crew</Text>
        <Text style={styles.perksItem}>· Pre-populated dive logs from trip data — one click to log your dive</Text>
      </View>

      <View style={styles.divider} />

      {children}
    </View>
  );
}

function InlineAuthForm({ invitedEmail }: { invitedEmail: string }) {
  const auth = useAuth();
  const [mode, setMode] = React.useState<'signup' | 'signin'>('signup');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await auth.signUpEmail(invitedEmail, password, name.trim() || undefined);
      } else {
        await auth.signInEmail(invitedEmail, password);
      }
      // The parent screen re-renders once auth.user lands.
    } catch (e) {
      setError(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await auth.signInGoogle();
    } catch (e) {
      setError(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.formWrap}>
      <View style={styles.modeToggle}>
        <Pressable onPress={() => setMode('signup')}
          style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}>
          <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
            Create account
          </Text>
        </Pressable>
        <Pressable onPress={() => setMode('signin')}
          style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}>
          <Text style={[styles.modeBtnText, mode === 'signin' && styles.modeBtnTextActive]}>
            I already have an account
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.googleBtn, busy && styles.btnDisabled]}
        onPress={signInGoogle}
        disabled={busy}
      >
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleBtnText}>
          {mode === 'signup' ? `Sign up with Google as ${invitedEmail}` : 'Continue with Google'}
        </Text>
      </Pressable>

      <Text style={styles.orDivider}>OR with password</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={invitedEmail}
          editable={false}
          style={[styles.input, styles.inputDisabled]}
        />
        <Text style={styles.fieldHint}>Locked to the invited email — switch accounts above if needed.</Text>
      </View>

      {mode === 'signup' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Your name (optional)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What we'll call you"
            placeholderTextColor={colors.text3}
            style={styles.input}
            editable={!busy}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
          placeholderTextColor={colors.text3}
          secureTextEntry
          style={styles.input}
          editable={!busy}
        />
      </View>

      {error ? <Text style={styles.errText}>{error}</Text> : null}

      <Pressable
        style={[styles.btnPrimary, busy && styles.btnDisabled]}
        onPress={submit}
        disabled={busy || password.length === 0}
      >
        <Text style={styles.btnPrimaryText}>
          {busy ? 'Working…' : mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
        </Text>
      </Pressable>
    </View>
  );
}

function AcceptBlock({
  inviteId,
  invite,
  onNavigate,
}: {
  inviteId: string;
  invite: PublicInviteFound;
  onNavigate?: NavigateFn;
}) {
  const [accepting, setAccepting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const accept = async () => {
    setError(null);
    setAccepting(true);
    try {
      if (!firebaseConfigured || !app) throw new Error('Firebase is not configured.');
      const fn = httpsCallable<{ inviteId: string }, { orgId: string; orgName: string; role: string }>(
        getFunctions(app, 'us-central1'),
        'acceptCrewInvitation',
      );
      await fn({ inviteId });
      setAccepted(true);
      // Their activeContext was flipped server-side to crew:{orgId}.
      // Route them straight into the crew shell — the post-signin
      // redirect logic would do the same on a fresh page load, but
      // a direct nav keeps the UX flowing without a reload.
      setTimeout(() => onNavigate?.('crew-home'), 1500);
    } catch (e) {
      setError(prettyError(e));
    } finally {
      setAccepting(false);
    }
  };

  if (accepted) {
    return (
      <View style={styles.successWrap}>
        <Text style={styles.successTitle}>Welcome aboard.</Text>
        <Text style={styles.successBody}>
          You're now {ROLE_LABELS[invite.role]} at {invite.orgName}. Taking you to your dashboard…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.acceptWrap}>
      {error ? <Text style={styles.errText}>{error}</Text> : null}
      <Pressable
        style={[styles.btnPrimary, accepting && styles.btnDisabled]}
        onPress={accept}
        disabled={accepting}
      >
        <Text style={styles.btnPrimaryText}>
          {accepting ? 'Accepting…' : `Accept invitation to ${invite.orgName}`}
        </Text>
      </Pressable>
      <Text style={styles.fieldHint}>
        You'll be added to the crew, and Pro features unlock as long as you stay an active member.
      </Text>
    </View>
  );
}

function Card({
  title, body, actionLabel, onAction,
}: {
  title: string; body: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.subheading}>{body}</Text>
      {actionLabel ? (
        <Pressable style={styles.btnPrimary} onPress={onAction}>
          <Text style={styles.btnPrimaryText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.page}>
      <View style={styles.maxWidth}>{children}</View>
    </View>
  );
}

function prettyError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  const msg = (e as { message?: string })?.message;
  if (code === 'auth/email-already-in-use') {
    return 'An account already exists for this email. Switch to "I already have an account" above.';
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Wrong password.';
  }
  if (code === 'auth/weak-password') return 'Pick a stronger password (at least 6 characters).';
  if (code === 'auth/network-request-failed') return 'Network hiccup — try again.';
  return msg || 'Something went wrong.';
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    backgroundColor: colors.bg,
    padding: 24,
  },
  maxWidth: { width: '100%', maxWidth: 520, alignSelf: 'center', flex: 1, justifyContent: 'center' },
  card: {
    padding: 32,
    backgroundColor: colors.surface0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 14,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.6,
  },
  subheading: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text2,
    lineHeight: 22,
  },
  role: { color: colors.accent, fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 24, paddingTop: 4 },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaValue: { fontFamily: fonts.body, fontSize: 13, color: colors.text1, fontWeight: '600' },
  mono: { fontFamily: fonts.mono },

  perks: {
    marginTop: 8,
    padding: 14,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 6,
  },
  perksTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  perksItem: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 6,
  },

  formWrap: { gap: 12 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    padding: 4,
    gap: 4,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong },
  modeBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text3 },
  modeBtnTextActive: { color: colors.text1 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.sm,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong,
  },
  googleIcon: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', color: '#4285F4',
    textAlign: 'center', lineHeight: 22, fontWeight: '800', fontFamily: fonts.display,
  },
  googleBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text1 },
  orDivider: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
  },

  field: { gap: 4 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  inputDisabled: { color: colors.text3, opacity: 0.85 },
  fieldHint: { fontFamily: fonts.body, fontSize: 11, color: colors.text3, marginTop: 2 },

  btnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  btnPrimaryText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.bg },
  btnDisabled: { opacity: 0.6 },

  errText: { fontFamily: fonts.body, fontSize: 12, color: '#F73726' },

  loadingWrap: { gap: 12, alignItems: 'center', padding: 40 },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },

  mismatchWrap: { gap: 12 },
  mismatchText: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },

  acceptWrap: { gap: 10 },

  successWrap: { gap: 8, alignItems: 'flex-start' },
  successTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: -0.4,
  },
  successBody: { fontFamily: fonts.body, fontSize: 14, color: colors.text2, lineHeight: 20 },
});

