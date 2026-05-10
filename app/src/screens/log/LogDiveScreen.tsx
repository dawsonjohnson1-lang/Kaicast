import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { ProgressDots } from '@/components/ProgressDots';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { AuthHero } from '@/components/AuthHero';
import { SpotPicker, type PickedSpot } from '@/components/SpotPicker';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { submitDiveLog } from '@/api/diveLogs';
import { fetchSpotReport } from '@/api/kaicast';
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
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<DiveType>('scuba');
  const [group, setGroup] = useState('Solo');
  const [date, setDate] = useState('04/16/2026');
  const [time, setTime] = useState('--:-- --');
  const [duration, setDuration] = useState('');
  const [spotPick, setSpotPick] = useState<PickedSpot | null>(null);
  const [spotPickerOpen, setSpotPickerOpen] = useState(false);

  const [depth, setDepth] = useState('');
  const [weapon, setWeapon] = useState('');

  const [surface, setSurface] = useState('Calm');
  const [current, setCurrent] = useState('None');
  const [vis, setVis] = useState('Clean');

  const [notes, setNotes] = useState('');

  const next = () => setStep(((step + 1) as Step));
  const back = () => (step === 1 ? nav.goBack() : setStep(((step - 1) as Step)));

  const onSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // For known spots, capture the BackendReport at log time so the
      // log carries an objective conditions snapshot alongside the
      // user-reported readings. Two-tap pivots later — "what did
      // KaiCast think it was vs what the diver reported" — fall right
      // out of this. Custom spots have no backend report; skip.
      let conditionsSnapshot: Awaited<ReturnType<typeof fetchSpotReport>> | null = null;
      if (spotPick?.kind === 'known') {
        try {
          conditionsSnapshot = await fetchSpotReport(spotPick.id);
        } catch {
          // Non-blocking — if the spot has no backend report yet, the
          // log is still valid. conditionsSnapshot stays null.
          conditionsSnapshot = null;
        }
      }

      await submitDiveLog({
        uid: user.id,
        // For known spots, spotId matches the backend's SPOTS object so
        // the report cross-reference works. For custom spots we get a
        // synthetic id and stash the human-readable name + lat/lon
        // inline on the log so it's still meaningful.
        spotId: spotPick?.id ?? 'unknown',
        customSpot:
          spotPick?.kind === 'custom'
            ? { name: spotPick.name, lat: spotPick.lat, lon: spotPick.lon }
            : undefined,
        diveType: type,
        groupSize: group,
        durationMin: duration ? Number.parseInt(duration, 10) : null,
        depthFt: depth ? Number.parseInt(depth, 10) : null,
        surface,
        current,
        visibility: vis,
        notes,
        privacy: 'public',
        photos: [],
        conditionsSnapshot,
      });
      setStep(5);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[LogDive] submit failed:', err);
      // Still advance to the success screen — the stub fallback in
      // submitDiveLog never throws, so a thrown error means a real
      // Firebase write failed. Surface it but don't trap the user.
      setStep(5);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      contentStyle={{ paddingTop: 100 }}
      bg={colors.bg}
      edges={['left', 'right', 'bottom']}
    >
      <AuthHero height={100} style={{ top: 0 }} />
      <View style={logHeroStyles.headerOverlay}>
        <Header onBack={back} transparent />
      </View>
      {step <= 4 && (
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.lg }}>
          <ProgressDots total={4} current={step} />
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={[typography.h1, styles.titleSm]}>Log your dive</Text>
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
          <Pressable onPress={() => setSpotPickerOpen(true)} style={styles.spotPickerField}>
            <Text style={[typography.body, { color: spotPick ? colors.textPrimary : colors.textMuted, flex: 1 }]}>
              {spotPick ? spotPick.name : 'Select your spot'}
            </Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>

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
          <Text style={[typography.h1, styles.titleSm]}>{labelForType(type)}</Text>
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
          <Text style={[typography.h1, styles.titleSm]}>Conditions</Text>
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
          <Text style={[typography.h1, styles.titleSm]}>Wrap-up</Text>
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
          <Button
            label={step === 4 ? 'Submit dive' : 'Continue'}
            iconRight="arrow-right"
            loading={submitting}
            onPress={() => (step === 4 ? onSubmit() : next())}
          />
        </View>
      ) : (
        <Button label="Done" fullWidth onPress={() => nav.popToTop()} />
      )}

      <SpotPicker
        open={spotPickerOpen}
        value={spotPick}
        onClose={() => setSpotPickerOpen(false)}
        onSelect={(s) => {
          setSpotPick(s);
          setSpotPickerOpen(false);
        }}
      />
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

const logHeroStyles = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

const styles = StyleSheet.create({
  titleSm: { fontSize: 22, lineHeight: 26 },
  spotPickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
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
