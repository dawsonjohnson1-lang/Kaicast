import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { ProgressDots } from '@/components/ProgressDots';
import { Icon } from '@/components/Icon';
import { colors, spacing, typography } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

const DIVE_TYPES = [
  'Scuba',
  'Freediving',
  'Spearfishing',
  'Snorkeling',
  'Underwater photo',
  'Technical',
];

export function CreateAccountStep1Screen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [island, setIsland] = useState('');
  const [town, setTown] = useState('');
  const [homeSpot, setHomeSpot] = useState('');
  const [diveTypes, setDiveTypes] = useState<Set<string>>(new Set(['Scuba', 'Spearfishing']));
  const [experience, setExperience] = useState('');
  const [years, setYears] = useState('');

  const toggle = (t: string) => {
    setDiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <View style={styles.banner}>
        <Logo size={26} showWordmark={false} />
        <View style={styles.bannerProgress}>
          <ProgressDots total={3} current={1} />
        </View>
      </View>

      <Text style={typography.h1}>Tell us about yourself</Text>
      <Text style={styles.sub}>Help us personalise your Kaicast experience.</Text>

      <View style={styles.photoRow}>
        <View style={styles.photoCircle} />
        <View style={{ flex: 1 }}>
          <Text style={styles.photoTitle}>Profile photo</Text>
          <Text style={styles.photoHint}>JPG or PNG, max 1MB</Text>
          <Pressable style={styles.uploadBtn}>
            <Text style={styles.uploadBtnText}>Upload photo</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.twoCol}>
        <Input
          label="First name"
          placeholder="First name"
          value={first}
          onChangeText={setFirst}
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Last name"
          placeholder="Last name"
          value={last}
          onChangeText={setLast}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <View style={{ height: spacing.lg }} />
      <Input label="Nickname" placeholder="What should we call you?" value={nickname} onChangeText={setNickname} />
      <View style={{ height: spacing.lg }} />
      <Input
        label="Username"
        placeholder="@yourhandle"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.section}>LOCATION</Text>
      <Text style={styles.fieldLabel}>Which island are you on?</Text>
      <Select value={island} placeholder="Select your island" onPress={() => setIsland(island ? '' : 'Oahu')} />

      <View style={{ height: spacing.lg }} />
      <View style={styles.twoCol}>
        <Input
          label="Home town"
          placeholder="e.g. Honolulu"
          value={town}
          onChangeText={setTown}
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Home dive spot"
          placeholder="Your go-to spot"
          value={homeSpot}
          onChangeText={setHomeSpot}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <Text style={styles.section}>DIVING</Text>
      <Text style={styles.fieldLabel}>I dive / do</Text>
      <View style={styles.chipRow}>
        {DIVE_TYPES.map((t) => (
          <ChoiceChip key={t} label={t} selected={diveTypes.has(t)} onPress={() => toggle(t)} />
        ))}
      </View>

      <View style={{ height: spacing.lg }} />
      <View style={styles.twoCol}>
        <Input
          label="Experience"
          placeholder="Level"
          value={experience}
          onChangeText={setExperience}
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Years"
          placeholder="Years"
          keyboardType="number-pad"
          value={years}
          onChangeText={setYears}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <View style={styles.actions}>
        <Button label="Back" variant="ghost" iconLeft="chevron-left" onPress={() => nav.goBack()} />
        <Button label="Continue" iconRight="arrow-right" onPress={() => nav.navigate('CreateAccountAlmostThere')} />
      </View>
    </Screen>
  );
}

function Select({
  value,
  placeholder,
  onPress,
}: {
  value: string;
  placeholder: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.select} onPress={onPress}>
      <Text style={[styles.selectText, !value && { color: colors.textMuted }]}>{value || placeholder}</Text>
      <Icon name="chevron-down" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: '#0a2540',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  bannerProgress: { width: '100%', marginTop: spacing.md },
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  photoCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoTitle: { ...typography.body, fontWeight: '600' },
  photoHint: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  uploadBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  uploadBtnText: { ...typography.bodySm, fontWeight: '600', color: colors.textPrimary },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  section: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.4,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  fieldLabel: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  selectText: { ...typography.body, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
});
