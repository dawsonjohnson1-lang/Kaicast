import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { colors, spacing, typography } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

export function CreateAccountScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header onBack={() => nav.goBack()} transparent />
      <View style={styles.logo}>
        <Logo size={56} showWordmark color={colors.textPrimary} />
      </View>

      <Text style={[typography.h1, styles.heading]}>Sign Up{'\n'}Account</Text>
      <Text style={styles.sub}>Create your KaiCast account to get started.</Text>

      <View style={styles.socialRow}>
        <SocialButton label="Facebook" color="#1877F2" />
        <SocialButton label="Google" color="#ea4335" />
      </View>
      <SocialButton label="Apple" color="#fff" full />

      <View style={{ height: spacing.xxl }} />

      <Input label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <View style={{ height: spacing.lg }} />
      <Input label="Password" placeholder="••••••••" secureTextEntry value={pw} onChangeText={setPw} />
      <View style={{ height: spacing.lg }} />
      <Input label="Confirm Password" placeholder="••••••••" secureTextEntry value={pw2} onChangeText={setPw2} />

      <View style={{ height: spacing.xxl }} />

      <Button label="Create Account" fullWidth onPress={() => nav.navigate('CreateAccountStep1')} />
      <Pressable style={styles.footer} onPress={() => nav.goBack()}>
        <Text style={styles.footerText}>
          Already Have An Account? <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Sign In</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

function SocialButton({ label, color, full }: { label: string; color: string; full?: boolean }) {
  return (
    <Card padding={0} style={[styles.social, full ? { flex: 0, alignSelf: 'stretch' } : { flex: 1 }] as any}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 }}>
        <View style={[styles.dot, { backgroundColor: color }]} />
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
  dot: { width: 14, height: 14, borderRadius: 7 },
  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary, fontSize: 13 },
});
