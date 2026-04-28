import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, spacing, typography } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

const googleIcon = require('@/assets/social-google.png');
const facebookIcon = require('@/assets/social-facebook.png');

export function CreateAccountScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header onBack={() => nav.goBack()} transparent />
      <View style={styles.logo}>
        <Logo size={36} showWordmark />
      </View>

      <Text style={[typography.h1, styles.heading]}>Sign Up{'\n'}Account</Text>
      <Text style={styles.sub}>Create Your Kaicast Account To Get Started.</Text>

      <View style={styles.socialRow}>
        <SocialButton label="Facebook" iconSource={facebookIcon} />
        <SocialButton label="Google" iconSource={googleIcon} />
      </View>
      <SocialButton label="Apple" appleGlyph full />

      <View style={{ height: spacing.xxl }} />

      <Input
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <View style={{ height: spacing.lg }} />
      <Input label="Password" placeholder="you@example.com" secureTextEntry value={pw} onChangeText={setPw} />
      <View style={{ height: spacing.lg }} />
      <Input label="Confirm Password" placeholder="you@example.com" secureTextEntry value={pw2} onChangeText={setPw2} />

      <View style={{ height: spacing.xxl }} />

      <Button label="Create Account" fullWidth onPress={() => nav.navigate('CreateAccountStep1')} />
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
  appleGlyph,
  full,
}: {
  label: string;
  iconSource?: any;
  appleGlyph?: boolean;
  full?: boolean;
}) {
  return (
    <View style={[styles.social, full ? { alignSelf: 'stretch' } : { flex: 1 }]}>
      {appleGlyph ? (
        <AppleGlyph />
      ) : (
        <Image source={iconSource} style={{ width: 18, height: 18 }} resizeMode="contain" />
      )}
      <Text style={styles.socialLabel}>{label}</Text>
    </View>
  );
}

function AppleGlyph() {
  return (
    <Svg width={18} height={20} viewBox="0 0 18 20" fill="none">
      <Path
        fill="#fff"
        d="M14.6 10.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 3 2.3 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3 .8 1.3 0 2.1-1.1 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0-.1-2.4-1-2.4-3.6zM12.4 4c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxl },
  heading: { textAlign: 'center', fontSize: 38, lineHeight: 42 },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xxl },
  socialRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  social: {
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  socialLabel: { ...typography.body, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary, fontSize: 13 },
});
