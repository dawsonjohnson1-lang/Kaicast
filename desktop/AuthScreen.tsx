import React from 'react';
import { View, Text, Pressable, TextInput, Image, StyleSheet } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH } from './tokens';
import { useAuth } from './hooks/useAuth';
import type { NavigateFn } from './router';
import { logos } from './assets/figma/logos';

/**
 * Sign-in / Sign-up screen. One component, mode toggled by `mode` prop.
 * The form is intentionally minimal — email + password + display name (on
 * sign-up only) — plus Google as the single OAuth provider for launch.
 * Forgot-password sends a reset email through Firebase.
 */

export type AuthMode = 'signin' | 'signup';

export interface AuthScreenProps {
  mode: AuthMode;
  onNavigate?: NavigateFn;
}

export function AuthScreen({ mode, onNavigate }: AuthScreenProps) {
  const auth = useAuth();
  const isSignUp = mode === 'signup';

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resetSent, setResetSent] = React.useState(false);

  const switchMode = () => {
    onNavigate?.(isSignUp ? 'signin' : 'signup');
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await auth.signUpEmail(email.trim(), password, name.trim() || undefined);
      } else {
        await auth.signInEmail(email.trim(), password);
      }
      // App.tsx route gate will swap us to the post-auth landing.
    } catch (e) {
      setError(prettyAuthError(e));
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
      setError(prettyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email above first.');
      return;
    }
    setBusy(true);
    try {
      await auth.resetPassword(email.trim());
      setResetSent(true);
    } catch (e) {
      setError(prettyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.maxWidth}>
        <View style={styles.card}>
          <Pressable
            style={styles.brandRow}
            onPress={() => onNavigate?.('landing')}
          >
            <Image source={{ uri: logos.kaicast }} style={styles.logo} resizeMode="contain" />
          </Pressable>

          <Text style={styles.heading}>
            {isSignUp ? 'Create your account' : 'Sign in to KaiCast'}
          </Text>
          <Text style={styles.sub}>
            {isSignUp
              ? 'Start logging dives and tracking conditions across the islands.'
              : 'Welcome back. Pick up where you left off.'}
          </Text>

          {!auth.configured ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                Auth isn't configured (Firebase env vars missing). Sign-in is disabled.
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.googleBtn, busy && styles.btnDisabled]}
            onPress={signInGoogle}
            disabled={busy || !auth.configured}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleBtnText}>
              {isSignUp ? 'Sign up with Google' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {isSignUp ? (
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, { outlineStyle: 'none' } as object]}
                placeholder="Your name"
                placeholderTextColor={colors.text4}
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, { outlineStyle: 'none' } as object]}
              placeholder="you@example.com"
              placeholderTextColor={colors.text4}
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, { outlineStyle: 'none' } as object]}
              placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
              placeholderTextColor={colors.text4}
              value={password}
              onChangeText={setPassword}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              secureTextEntry
            />
          </View>

          {!isSignUp ? (
            <Pressable onPress={sendReset} style={styles.forgotWrap} disabled={busy}>
              <Text style={styles.forgotText}>
                {resetSent ? '✓ Reset email sent — check your inbox' : 'Forgot password?'}
              </Text>
            </Pressable>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, (busy || !auth.configured) && styles.btnDisabled]}
            onPress={submit}
            disabled={busy || !auth.configured}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
            </Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <Pressable onPress={switchMode}>
              <Text style={styles.switchLink}>
                {isSignUp ? 'Sign in' : 'Sign up'}
              </Text>
            </Pressable>
          </View>

          {isSignUp ? (
            <Text style={styles.tos}>
              By creating an account you agree to the{' '}
              <Text style={styles.tosLink} onPress={() => onNavigate?.('terms')}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.tosLink} onPress={() => onNavigate?.('privacy')}>Privacy Policy</Text>.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// Map a Firebase Auth error to a short, user-readable message.
// Codes from https://firebase.google.com/docs/auth/admin/errors
function prettyAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-email') return 'That email doesn\'t look right.';
  if (code === 'auth/missing-password') return 'Enter your password.';
  if (code === 'auth/weak-password') return 'Password is too short — use at least 6 characters.';
  if (code === 'auth/email-already-in-use') return 'An account with that email already exists.';
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'No account found with that email + password.';
  if (code === 'auth/wrong-password') return 'Wrong password.';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in was cancelled.';
  if (code === 'auth/network-request-failed') return 'Network problem — check your connection.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again in a minute.';
  return msg;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: 36,
    gap: 16,
    backgroundColor: colors.surface0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  brandRow: {
    alignSelf: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 130,
    height: 26,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text1,
    textAlign: 'center',
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text3,
    textAlign: 'center',
    marginBottom: 8,
  },
  warn: {
    padding: 12,
    backgroundColor: 'rgba(255,157,37,0.10)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,157,37,0.30)',
  },
  warnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.fair,
  },
  googleBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  googleIcon: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairline,
  },
  dividerText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text4,
    letterSpacing: 1,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text3,
    letterSpacing: 0.4,
  },
  input: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
  },
  errorBox: {
    padding: 12,
    backgroundColor: 'rgba(247,55,38,0.10)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(247,55,38,0.30)',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.nogo,
  },
  primaryBtn: {
    height: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.bg,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  switchText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
  },
  switchLink: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  tos: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text4,
    textAlign: 'center',
    marginTop: 4,
  },
  tosLink: {
    color: colors.text3,
    textDecorationLine: 'underline',
  },
});
