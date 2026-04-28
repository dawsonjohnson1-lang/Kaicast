import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { ProgressDots } from '@/components/ProgressDots';
import { colors, spacing, typography } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';
import type { DiveType } from '@/types';

const jellyfishBg = require('@/assets/blurry-jellyfish.png');

const DIVE_TYPES: { id: DiveType; label: string }[] = [
  { id: 'scuba', label: 'Scuba' },
  { id: 'freedive', label: 'Freediving' },
  { id: 'spear', label: 'Spearfishing' },
  { id: 'snorkel', label: 'Snorkeling' },
];

export function CreateAccountStep1Screen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [type, setType] = useState<DiveType>('scuba');

  return (
    <Screen contentStyle={{ paddingTop: 0 }} bgImage={jellyfishBg} bgOverlay="rgba(4,7,13,0.55)">
      <Header onBack={() => nav.goBack()} transparent />
      <ProgressDots total={3} current={1} />
      <Text style={[typography.h1, { marginTop: spacing.xl }]}>Tell us about you</Text>
      <Text style={styles.sub}>Step 1 of 3 — this helps us tailor conditions to your dive style.</Text>

      <View style={{ height: spacing.xl }} />
      <Input label="Display name" placeholder="Dawson" value={name} onChangeText={setName} />
      <View style={{ height: spacing.lg }} />
      <Input label="Username" placeholder="@bigdawg" autoCapitalize="none" value={handle} onChangeText={setHandle} />

      <Text style={[styles.label, { marginTop: spacing.xl }]}>Preferred dive type</Text>
      <View style={styles.chipRow}>
        {DIVE_TYPES.map((d) => (
          <ChoiceChip key={d.id} label={d.label} selected={type === d.id} onPress={() => setType(d.id)} />
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <View style={styles.actions}>
        <Button label="Back" variant="ghost" iconLeft="chevron-left" onPress={() => nav.goBack()} />
        <Button label="Continue" iconRight="arrow-right" onPress={() => nav.navigate('CreateAccountAlmostThere')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xxxl },
});
