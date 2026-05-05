import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { ProgressDots } from '@/components/ProgressDots';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { AuthHero } from '@/components/AuthHero';
import { colors, radius, spacing, typography } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type DiveActivity =
  | 'scuba'
  | 'freedive'
  | 'spear'
  | 'snorkel'
  | 'underwater_photo'
  | 'technical';

const ACTIVITIES: { id: DiveActivity; label: string }[] = [
  { id: 'scuba', label: 'Scuba' },
  { id: 'freedive', label: 'Freediving' },
  { id: 'spear', label: 'Spearfishing' },
  { id: 'snorkel', label: 'Snorkeling' },
  { id: 'underwater_photo', label: 'Underwater photo' },
  { id: 'technical', label: 'Technical' },
];

const ISLANDS = [
  "O'ahu",
  'Maui',
  "Hawai'i (Big Island)",
  "Kaua'i",
  "Moloka'i",
  "Lāna'i",
  'Other',
];

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export function CreateAccountStep1Screen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [island, setIsland] = useState<string | null>(null);
  const [hometown, setHometown] = useState('');
  const [homeSpot, setHomeSpot] = useState('');
  const [activities, setActivities] = useState<Set<DiveActivity>>(new Set(['freedive']));
  const [experience, setExperience] = useState<string | null>(null);
  const [years, setYears] = useState('');
  const [islandPickerOpen, setIslandPickerOpen] = useState(false);
  const [expPickerOpen, setExpPickerOpen] = useState(false);

  const initials = `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '+';
  const photoSource = photoUri ? { uri: photoUri } : undefined;

  const onUploadPhoto = () => {
    // TODO(image-picker): wire to expo-image-picker once installed; enforce
    // JPG/PNG only and a 1 MB max-size check on the picked asset.
    Alert.alert(
      'Upload photo',
      'Photo upload requires expo-image-picker. Install it and replace this stub with launchImageLibraryAsync.',
    );
  };

  const toggleActivity = (id: DiveActivity) => {
    setActivities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onContinue = () => {
    nav.navigate('CreateAccountAlmostThere');
  };

  return (
    <Screen contentStyle={{ paddingTop: 0 }} bg={colors.bg}>
      <AuthHero height={260} />
      <Header onBack={() => nav.goBack()} transparent />

      <View style={{ marginTop: spacing.md }}>
        <ProgressDots total={3} current={1} />
      </View>

      <Text style={[typography.h1, { marginTop: spacing.xl }]}>Tell us about yourself</Text>
      <Text style={s.sub}>Help us personalise your Kaicast experience.</Text>

      <View style={s.photoRow}>
        <Avatar size={96} ring imageSource={photoSource} initials={initials} />
        <View style={{ flex: 1, gap: 4 }}>
          <Pressable onPress={onUploadPhoto} style={s.uploadBtn}>
            <Icon name="plus" size={14} color={colors.accent} />
            <Text style={s.uploadText}>Upload photo</Text>
          </Pressable>
          <Text style={s.uploadHint}>JPG or PNG · max 1 MB</Text>
        </View>
      </View>

      <Row>
        <Input label="First name" value={first} onChangeText={setFirst} placeholder="Dawson" containerStyle={{ flex: 1 }} />
        <Input label="Last name" value={last} onChangeText={setLast} placeholder="Johnson" containerStyle={{ flex: 1 }} />
      </Row>

      <View style={{ height: spacing.lg }} />
      <Input label="Nickname" value={nickname} onChangeText={setNickname} placeholder="Big Dawg" />

      <View style={{ height: spacing.lg }} />
      <Input
        label="Username"
        value={handle}
        onChangeText={(v) => setHandle(v.replace(/[^a-z0-9_]/gi, ''))}
        placeholder="@yourhandle"
        autoCapitalize="none"
      />

      <SectionLabel>LOCATION</SectionLabel>
      <DropdownField
        label="Select your island"
        value={island}
        onPress={() => setIslandPickerOpen(true)}
      />
      <View style={{ height: spacing.lg }} />
      <Row>
        <Input label="Home town" value={hometown} onChangeText={setHometown} placeholder="Honolulu" containerStyle={{ flex: 1 }} />
        <Input label="Home dive spot" value={homeSpot} onChangeText={setHomeSpot} placeholder="Three Tables" containerStyle={{ flex: 1 }} />
      </Row>

      <SectionLabel>DIVING</SectionLabel>
      <Text style={s.fieldLabel}>I dive / do</Text>
      <View style={s.chipGrid}>
        {ACTIVITIES.map((a) => (
          <ChoiceChip
            key={a.id}
            label={a.label}
            selected={activities.has(a.id)}
            onPress={() => toggleActivity(a.id)}
          />
        ))}
      </View>

      <View style={{ height: spacing.lg }} />
      <Row>
        <View style={{ flex: 1 }}>
          <DropdownField
            label="Experience level"
            value={experience}
            onPress={() => setExpPickerOpen(true)}
          />
        </View>
        <Input label="Years" value={years} onChangeText={(v) => setYears(v.replace(/[^0-9]/g, ''))} placeholder="3" keyboardType="number-pad" containerStyle={{ flex: 1 }} />
      </Row>

      <View style={{ height: spacing.xxxl }} />

      <View style={s.actions}>
        <Button label="Back" variant="ghost" iconLeft="chevron-left" onPress={() => nav.goBack()} />
        <Button label="Continue" iconRight="arrow-right" onPress={onContinue} />
      </View>

      <PickerModal
        title="Select your island"
        options={ISLANDS}
        value={island}
        open={islandPickerOpen}
        onClose={() => setIslandPickerOpen(false)}
        onSelect={(v) => { setIsland(v); setIslandPickerOpen(false); }}
      />
      <PickerModal
        title="Experience level"
        options={EXPERIENCE_LEVELS}
        value={experience}
        open={expPickerOpen}
        onClose={() => setExpPickerOpen(false)}
        onSelect={(v) => { setExperience(v); setExpPickerOpen(false); }}
      />
    </Screen>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

function DropdownField({ label, value, onPress }: { label: string; value: string | null; onPress: () => void }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={s.dropdownLabel}>{label}</Text>
      <Pressable onPress={onPress} style={s.dropdown}>
        <Text style={[typography.body, { color: value ? colors.textPrimary : colors.textMuted }]}>
          {value ?? 'Choose…'}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function PickerModal({
  title,
  options,
  value,
  open,
  onClose,
  onSelect,
}: {
  title: string;
  options: string[];
  value: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (v: string) => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={() => undefined}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>{title}</Text>
          <ScrollView>
            {options.map((opt) => {
              const selected = value === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => onSelect(opt)}
                  style={[modalStyles.option, selected && { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={[typography.body, selected && { color: colors.accent, fontWeight: '700' }]}>{opt}</Text>
                  {selected ? <Icon name="check" size={16} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  uploadText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  uploadHint: { ...typography.caption, color: colors.textMuted, marginLeft: 4 },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  dropdownLabel: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h3, marginBottom: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
