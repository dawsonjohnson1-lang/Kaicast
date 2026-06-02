// CharterSetupScreen — one-shot self-service that flips the caller's
// user doc to a charter account + seeds a fresh org + demo content.
// Email-allowlisted server-side (see functions/charter/provisionOperator.js).
// Once the real onboarding flow lands, both this screen and the
// callable behind it should be deleted.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { colors, fonts, radius } from '../tokens';
import { useAuth } from '../hooks/useAuth';
import { app as firebaseApp } from '../firebase';
import type { NavigateFn } from '../router';

interface ProvisionResult {
  ok: boolean;
  uid: string;
  orgId: string;
  message: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'calling' }
  | { kind: 'done'; result: ProvisionResult }
  | { kind: 'error'; message: string };

export function CharterSetupScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { user, accountType, orgId } = useAuth();
  const [state, setState] = React.useState<State>({ kind: 'idle' });

  const callProvision = async () => {
    if (!firebaseApp) {
      setState({ kind: 'error', message: 'Firebase not configured in this build.' });
      return;
    }
    setState({ kind: 'calling' });
    try {
      const fns = getFunctions(firebaseApp, 'us-central1');
      const fn = httpsCallable<{ orgId?: string; seedDemoContent?: boolean }, ProvisionResult>(
        fns,
        'provisionCharterOperator',
      );
      const res = await fn({ seedDemoContent: true });
      setState({ kind: 'done', result: res.data });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setState({ kind: 'error', message: `${e.code ?? 'error'}: ${e.message ?? String(err)}` });
    }
  };

  const alreadyCharter = accountType === 'charter' && !!orgId;

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.kicker}>CHARTER SETUP — DEV TOOL</Text>
        <Text style={styles.title}>Provision your account as a charter operator</Text>
        <Text style={styles.body}>
          This one-shot tool flips your user doc to <Text style={styles.mono}>accountType: "charter"</Text>,
          seeds a fresh <Text style={styles.mono}>charter_accounts/&lt;orgId&gt;</Text> document, and
          drops in a few demo spots + crew members so every screen has something to render. Once the
          real onboarding flow lands, this page goes away.
        </Text>

        {/* Signed-in identity */}
        <View style={styles.identityCard}>
          <Text style={styles.identityLabel}>SIGNED IN AS</Text>
          <Text style={styles.identityValue}>{user?.email ?? '(not signed in)'}</Text>
          <Text style={styles.identityMeta}>uid {user?.uid ?? '—'}</Text>
        </View>

        {/* Current state */}
        {alreadyCharter ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Already provisioned</Text>
            <Text style={styles.successBody}>
              Your user doc is already <Text style={styles.mono}>accountType: "charter"</Text>,
              linked to org <Text style={styles.mono}>{orgId}</Text>. The dashboard is one click away.
            </Text>
            <Pressable onPress={() => onNavigate?.('charter-home')} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Open /charter →</Text>
            </Pressable>
          </View>
        ) : state.kind === 'done' ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Provisioned ✓</Text>
            <Text style={styles.successBody}>
              Org <Text style={styles.mono}>{state.result.orgId}</Text> created (or already existed).
              Demo spots and crew are seeded. Click below to head to the dashboard — the route gate
              will let you in now.
            </Text>
            <Pressable onPress={() => onNavigate?.('charter-home')} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Open /charter →</Text>
            </Pressable>
          </View>
        ) : state.kind === 'error' ? (
          <View style={styles.errCard}>
            <Text style={styles.errTitle}>Could not provision</Text>
            <Text style={styles.errBody}>{state.message}</Text>
            <Text style={styles.errHint}>
              If this says "permission-denied", your signed-in email isn't on the server-side
              allowlist. Add it in <Text style={styles.mono}>functions/charter/provisionOperator.js</Text>
              {' '}and redeploy.
            </Text>
            <Pressable onPress={callProvision} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.ctaCard}>
            <Text style={styles.ctaBody}>
              When you click below, the server will set your user doc fields and create the org doc
              with a default home harbor (Haleiwa) + tripTypes. It's idempotent — re-running is safe.
            </Text>
            <Pressable
              onPress={callProvision}
              disabled={!user || state.kind === 'calling'}
              style={[styles.primaryBtn, (!user || state.kind === 'calling') && styles.primaryBtnDisabled]}
            >
              {state.kind === 'calling' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={colors.bg} size="small" />
                  <Text style={styles.primaryBtnText}>Provisioning…</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>Provision me as a charter operator</Text>
              )}
            </Pressable>
            {!user ? (
              <Text style={styles.muted}>Sign in first — this page is the only /charter/* route a consumer account can reach, so you'll need to be authenticated for the function call to identify you.</Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 32, alignItems: 'center' },
  card: { width: '100%', maxWidth: 720, padding: 32, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 18 },
  kicker: { fontFamily: fonts.mono, fontSize: 11, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 24, fontWeight: '800', color: colors.text1, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text2, lineHeight: 22 },
  mono: { fontFamily: fonts.mono, color: colors.accent, fontSize: 13 },

  identityCard: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 4 },
  identityLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  identityValue: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text1 },
  identityMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 2 },

  ctaCard: { gap: 14, padding: 18, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  ctaBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },

  successCard: { padding: 18, borderRadius: radius.sm, backgroundColor: 'rgba(61,220,132,0.08)', borderWidth: 1, borderColor: '#3DDC84', gap: 12 },
  successTitle: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: '#3DDC84' },
  successBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },

  errCard: { padding: 18, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.08)', borderWidth: 1, borderColor: '#F73726', gap: 10 },
  errTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2 },
  errHint: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },

  primaryBtn: { alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.accent },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  secondaryBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  secondaryBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text2 },
});
