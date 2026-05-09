import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { ProgressDots } from '@/components/ProgressDots';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { setUserProfile } from '@/api/userProfile';
import type { AuthStackParamList } from '@/navigation/types';

const jellyfishBg = require('@/assets/blurry-jellyfish.png');

const CERTS = ['None', 'Open Water', 'Advanced', 'Rescue', 'Divemaster', 'Instructor'];

export function CreateAccountAlmostThereScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { user } = useAuth();
  const [years, setYears] = useState('');
  const [home, setHome] = useState('');
  const [cert, setCert] = useState('Open Water');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in or create an account first.');
      return;
    }
    setSaving(true);
    try {
      // Writes the final onboarding fields AND flips onboardingComplete
      // to true. The navigator's useUserProfile snapshot listener
      // catches this and re-renders the user into the main app stack.
      await setUserProfile(user.id, {
        yearsActive: years ? Number.parseInt(years, 10) : undefined,
        homeSpot: home.trim() || "Three Tables, O'ahu",
        certification: cert,
        onboardingComplete: true,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[onboarding] finish failed:', err);
      Alert.alert('Couldn’t save profile', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 0 }} bgImage={jellyfishBg} bgOverlay="rgba(4,7,13,0.55)">
      <Header onBack={() => nav.goBack()} transparent />
      <ProgressDots total={3} current={3} />
      <Text style={[typography.h1, { marginTop: spacing.xl }]}>Almost there</Text>
      <Text style={styles.sub}>One last step — set up your dive profile.</Text>

      <View style={{ height: spacing.xl }} />
      <Input label="Years diving" placeholder="e.g. 8" keyboardType="number-pad" value={years} onChangeText={setYears} />
      <View style={{ height: spacing.lg }} />
      <Input label="Home spot" placeholder="Three Tables, O'ahu" value={home} onChangeText={setHome} />

      <Text style={[styles.label, { marginTop: spacing.xl }]}>Certification</Text>
      <View style={styles.chipRow}>
        {CERTS.map((c) => (
          <ChoiceChip key={c} label={c} selected={cert === c} onPress={() => setCert(c)} />
        ))}
      </View>

      <View style={{ height: spacing.xxxl }} />
      <Button label="Enter KaiCast" iconRight="arrow-right" fullWidth loading={saving} onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
