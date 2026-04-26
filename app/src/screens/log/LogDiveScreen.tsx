import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { ProgressDots } from '@/components/ProgressDots';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import type { DiveType } from '@/types';
import type { RootNav } from '@/navigation/types';

type Step = 1 | 2 | 3 | 4 | 5;

const DIVE_TYPES: { id: DiveType; label: string }[] = [
  { id: 'scuba', label: 'Scuba' },
  { id: 'freedive', label: 'Freediving' },
  { id: 'spear', label: 'Spearfishing' },
  { id: 'snorkel', label: 'Snorkeling' },
];

const GROUP_SIZES = ['Solo', 'With a buddy', 'Small group', 'Guide'];
const SURFACE = ['Calm', 'Choppy', 'Rough'];
const CURRENT = ['None', 'Light', 'Moderate', 'Strong'];
const VIS = ['Crystal', 'Clean', 'Murky', 'Green'];

export function LogDiveScreen() {
  const nav = useNavigation<RootNav>();
  const [step, setStep] = useState<Step>(1);

  const [type, setType] = useState<DiveType>('scuba');
  const [group, setGroup] = useState('Solo');
  const [date, setDate] = useState('04/16/2026');
  const [time, setTime] = useState('--:-- --');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');

  const [depth, setDepth] = useState('');
  const [weapon, setWeapon] = useState('');

  const [surface, setSurface] = useState('Calm');
  const [current, setCurrent] = useState('None');
  const [vis, setVis] = useState('Clean');

  const [notes, setNotes] = useState('');

  const next = () => setStep(((step + 1) as Step));
  const back = () => (step === 1 ? nav.goBack() : setStep(((step - 1) as Step)));

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header onBack={back} transparent />
      {step <= 4 && (
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.lg }}>
          <ProgressDots total={4} current={step} />
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={typography.h1}>Log your dive</Text>
          <Text style={styles.sub}>Fill in the details — change anytime</Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>I dive / do</Text>
          <View style={styles.chipRow}>
            {DIVE_TYPES.map((d) => (
              <ChoiceChip key={d.id} label={d.label} selected={type === d.id} onPress={() => setType(d.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Date & time</Text>
          <View style={styles.row2}>
            <Input value={date} onChangeText={setDate} containerStyle={{ flex: 1 }} />
            <Input value={time} onChangeText={setTime} containerStyle={{ flex: 1 }} />
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Location</Text>
          <Input placeholder="Select your spot" value={location} onChangeText={setLocation} />

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Size or type of group</Text>
          <View style={styles.chipRow}>
            {GROUP_SIZES.map((g) => (
              <ChoiceChip key={g} label={g} selected={group === g} onPress={() => setGroup(g)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Duration</Text>
          <Input placeholder="e.g 45 minutes" value={duration} onChangeText={setDuration} />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={typography.h1}>{labelForType(type)}</Text>
          <Text style={styles.sub}>Step 2 of 4 — activity-specific details</Text>

          <View style={{ height: spacing.xl }} />
          <Input label="Max depth (ft)" placeholder="40" keyboardType="number-pad" value={depth} onChangeText={setDepth} />
          {(type === 'spear') && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Weapon" placeholder="Speargun (band)" value={weapon} onChangeText={setWeapon} />
              <View style={{ height: spacing.lg }} />
              <Input label="Catch" placeholder="2 × Uku (4 lb, 3 lb)" />
            </>
          )}
          {type === 'scuba' && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Tank" placeholder="Aluminum 80, Nitrox 32%" />
              <View style={{ height: spacing.lg }} />
              <Input label="Bottom time (min)" placeholder="45" keyboardType="number-pad" />
            </>
          )}
          {type === 'freedive' && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Discipline" placeholder="Constant weight (CWT)" />
              <View style={{ height: spacing.lg }} />
              <Input label="Best dive time" placeholder="2:15" />
            </>
          )}
          {type === 'snorkel' && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Highlights" placeholder="Saw a turtle and reef sharks" />
            </>
          )}
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={typography.h1}>Conditions</Text>
          <Text style={styles.sub}>Step 3 of 4 — what was it like?</Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Surface</Text>
          <View style={styles.chipRow}>
            {SURFACE.map((s) => <ChoiceChip key={s} label={s} selected={surface === s} onPress={() => setSurface(s)} />)}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Current</Text>
          <View style={styles.chipRow}>
            {CURRENT.map((c) => <ChoiceChip key={c} label={c} selected={current === c} onPress={() => setCurrent(c)} />)}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Visibility</Text>
          <View style={styles.chipRow}>
            {VIS.map((v) => <ChoiceChip key={v} label={v} selected={vis === v} onPress={() => setVis(v)} />)}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Water temp</Text>
          <Input placeholder="79 °F" keyboardType="number-pad" />
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={typography.h1}>Wrap-up</Text>
          <Text style={styles.sub}>Step 4 of 4 — share what made it special</Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Notes</Text>
          <TextInput
            placeholder="Crystal clear today..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
            value={notes}
            onChangeText={setNotes}
            style={styles.textarea}
          />

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Privacy</Text>
          <View style={styles.chipRow}>
            <ChoiceChip label="Public" selected />
            <ChoiceChip label="Friends" />
            <ChoiceChip label="Only me" />
          </View>
        </View>
      )}

      {step === 5 && (
        <View style={styles.successWrap}>
          <View style={styles.checkBubble}>
            <Icon name="check" size={42} color="#0a1626" />
          </View>
          <Text style={[typography.h1, { textAlign: 'center', marginTop: spacing.xl }]}>Dive logged!</Text>
          <Text style={[styles.sub, { textAlign: 'center', marginTop: spacing.sm }]}>
            Your dive has been added to your profile. Friends can see and react to your report.
          </Text>
          <View style={{ height: spacing.xxl }} />
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={typography.body}>Share to feed</Text>
              <Icon name="check" size={20} color={colors.excellent} />
            </View>
          </Card>
        </View>
      )}

      <View style={{ height: spacing.xxxl }} />
      {step < 5 ? (
        <View style={styles.actions}>
          <Button label="Back" variant="ghost" iconLeft="chevron-left" onPress={back} />
          <Button label={step === 4 ? 'Submit dive' : 'Continue'} iconRight="arrow-right" onPress={() => (step === 4 ? setStep(5) : next())} />
        </View>
      ) : (
        <Button label="Done" fullWidth onPress={() => nav.popToTop()} />
      )}
    </Screen>
  );
}

function labelForType(t: DiveType) {
  switch (t) {
    case 'scuba': return 'Scuba details';
    case 'freedive': return 'Freediving details';
    case 'spear': return 'Spearfishing details';
    case 'snorkel': return 'Snorkel details';
  }
}

const styles = StyleSheet.create({
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  textarea: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 140,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  successWrap: { alignItems: 'center', marginTop: spacing.xxxl },
  checkBubble: { width: 84, height: 84, borderRadius: 999, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
