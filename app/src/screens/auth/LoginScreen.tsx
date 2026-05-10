import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Alert } from 'react-native';
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

export function LoginScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; pw?: string; submit?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!pw) e.pw = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSignIn = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: undefined }));
    try {
      await signInWithEmail(email, pw);
    } catch (err: any) {
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

      <Text style={[typography.h1, styles.heading]}>Welcome Back</Text>
      <Text style={styles.sub}>Sign in to your Kaicast account.</Text>

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
        placeholder="Your password"
        secureTextEntry={!showPw}
        value={pw}
        onChangeText={(v) => { setPw(v); if (errors.pw) setErrors({ ...errors, pw: undefined }); }}
        error={errors.pw}
        rightSlot={
          <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
            <Icon name="eye" size={18} color={showPw ? colors.accent : colors.textSecondary} />
          </Pressable>
        }
      />

      <Pressable style={styles.forgot} onPress={() => Alert.alert('Reset password', 'Password reset is coming soon.')}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      <View style={{ height: spacing.xl }} />

      {errors.submit ? (
        <Text style={styles.submitError}>{errors.submit}</Text>
      ) : null}

      <Button label="Log In" fullWidth loading={submitting} onPress={onSignIn} />

      <Pressable style={styles.footer} onPress={() => nav.navigate('CreateAccount')}>
        <Text style={styles.footerText}>
          Don't Have An Account?{' '}
          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Sign Up</Text>
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
          <Icon name="apple" size={18} color="#fff" />
        ) : (
          <Image source={iconSource} style={{ width: 18, height: 18 }} resizeMode="contain" />
        )}
        <Text style={{ ...typography.body, fontWeight: '600' }}>{label}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxl },
  heading: { textAlign: 'center', fontSize: 38, lineHeight: 42 },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xxl },
  socialRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  social: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  forgot: { alignSelf: 'flex-end', marginTop: spacing.md },
  submitError: { ...typography.bodySm, color: colors.hazard, textAlign: 'center', marginBottom: spacing.md },
  forgotText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary, fontSize: 13 },
});
