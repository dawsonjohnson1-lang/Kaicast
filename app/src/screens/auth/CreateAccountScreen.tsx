import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { friendlyAuthError } from '@/utils/authErrors';
import type { AuthStackParamList } from '@/navigation/types';

const googleIcon = require('@/assets/social-google.png');
const facebookIcon = require('@/assets/social-facebook.png');

export function CreateAccountScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; pw?: string; pw2?: string; submit?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!pw) e.pw = 'Password is required';
    else if (pw.length < 8) e.pw = 'Use at least 8 characters';
    if (pw && pw2 !== pw) e.pw2 = 'Passwords don’t match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    try {
      await signUpWithEmail(email, pw);
      // Navigation happens automatically — once Firebase Auth flips
      // isAuthed=true and the users/{uid} doc lands with
      // onboardingComplete:false, AppNavigator re-renders into the
      // OnboardingNav stack (initial route: CreateAccountStep1).
    } catch (err) {
      setErrors((prev) => ({ ...prev, submit: friendlyAuthError(err) }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 0 }} bg={colors.bg}>
      <Header onBack={() => nav.goBack()} transparent />
      <View style={styles.logo}>
        <Logo size={40} showWordmark />
      </View>

      <Text style={[typography.h1, styles.heading]}>Sign Up Account</Text>
      <Text style={styles.sub}>Create your Kaicast account to get started.</Text>

      <View style={styles.socialRow}>
        <SocialButton label="Facebook" iconSource={facebookIcon} />
        <SocialButton label="Google" iconSource={googleIcon} />
      </View>
      <SocialButton label="Apple" iconKind="apple" full />

      <View style={{ height: spacing.xxl }} />

      <Input
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={(v) => { setEmail(v); if (errors.email) setErrors({ ...errors, email: undefined }); }}
        error={errors.email}
      />
      <View style={{ height: spacing.lg }} />
      <Input
        label="Password"
        placeholder="At least 8 characters"
        secureTextEntry
        value={pw}
        onChangeText={(v) => { setPw(v); if (errors.pw) setErrors({ ...errors, pw: undefined }); }}
        error={errors.pw}
      />
      <View style={{ height: spacing.lg }} />
      <Input
        label="Confirm Password"
        placeholder="Repeat your password"
        secureTextEntry
        value={pw2}
        onChangeText={(v) => { setPw2(v); if (errors.pw2) setErrors({ ...errors, pw2: undefined }); }}
        error={errors.pw2}
      />

      <View style={{ height: spacing.xxl }} />

      {errors.submit ? (
        <Text style={styles.submitError}>{errors.submit}</Text>
      ) : null}

      <Button label="Create Account" fullWidth loading={submitting} onPress={onSubmit} />
      <Pressable style={styles.footer} onPress={() => nav.navigate('Login')}>
        <Text style={styles.footerText}>
          Already Have An Account? <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Sign In</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

function SocialButton({
  label,
  iconSource,
  iconKind,
  full,
}: {
  label: string;
  iconSource?: any;
  iconKind?: 'apple';
  full?: boolean;
}) {
  return (
    <Card padding={0} style={[styles.social, full ? { flex: 0, alignSelf: 'stretch' } : { flex: 1 }] as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 }}>
        {iconKind === 'apple' ? (
          <AppleGlyph />
        ) : (
          <Image source={iconSource} style={{ width: 18, height: 18 }} resizeMode="contain" />
        )}
        <Text style={{ ...typography.body, fontWeight: '600' }}>{label}</Text>
      </View>
    </Card>
  );
}

function AppleGlyph() {
  return <Icon name="apple" size={18} color="#fff" />;
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxl },
  heading: { textAlign: 'center', fontSize: 38, lineHeight: 42 },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xxl },
  socialRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  social: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary, fontSize: 13 },
  submitError: { ...typography.bodySm, color: colors.hazard, textAlign: 'center', marginBottom: spacing.md },
});
