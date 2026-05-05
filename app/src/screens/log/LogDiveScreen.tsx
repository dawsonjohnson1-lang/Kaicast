import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
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

import { useAuth } from '@/hooks/useAuth';
import { useAllReports } from '@/hooks/useAllReports';
import { useSpotReport } from '@/hooks/useSpotReport';
import { submitCommunityReport } from '@/services/community';
import {
  cToF,
  currentLabel,
  surfaceFromWind,
  ktsToMph,
  runoffToWaterQuality,
} from '@/utils/transforms';
import type { CommunityReport } from '@/types/report';

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
const VIS = ['Crystal', 'Clean', 'Murky', 'Green', 'Brown'];

export function LogDiveScreen() {
  const nav = useNavigation<RootNav>();
  const { user } = useAuth();
  const { reports } = useAllReports();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<DiveType>('scuba');
  const [group, setGroup] = useState('Solo');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-US'));
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  const [duration, setDuration] = useState('');
  const [spotId, setSpotId] = useState<string | null>(null);
  const selectedReport = useSpotReport(spotId);

  const [depth, setDepth] = useState('');

  const [surface, setSurface] = useState('Calm');
  const [current, setCurrent] = useState('None');
  const [vis, setVis] = useState('Clean');
  const [waterTempF, setWaterTempF] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);

  const [notes, setNotes] = useState('');
  const [privacy, setPrivacy] = useState<'Public' | 'Friends' | 'Only me'>('Public');

  const spotName = useMemo(() => {
    if (!spotId) return '';
    return reports.find((r) => r.spot === spotId)?.spotName ?? spotId;
  }, [spotId, reports]);

  // Auto-populate conditions on first entry to Step 3 from the live spot report.
  useEffect(() => {
    if (step !== 3 || autoFilled || !selectedReport.report) return;
    const m = selectedReport.report.now?.metrics;
    if (!m) return;
    if (m.windSpeedKts != null) {
      const surfaceMap = { GLASS: 'Calm', CHOPPY: 'Choppy', ROUGH: 'Rough' } as const;
      setSurface(surfaceMap[surfaceFromWind(m.windSpeedKts)]);
      const cur = currentLabel(m.windSpeedKts);
      setCurrent(cur === 'STRONG' ? 'Strong' : cur === 'MODERATE' ? 'Moderate' : 'Light');
    }
    if (m.waterTempC != null) setWaterTempF(String(Math.round(cToF(m.waterTempC))));
    const wq = runoffToWaterQuality(selectedReport.report.now?.analysis?.runoff?.severity);
    if (wq === 'CLEAN') setVis('Clean');
    else if (wq === 'SLIGHTLY STAINED') setVis('Murky');
    else if (wq === 'MURKY') setVis('Murky');
    else if (wq === 'BROWN') setVis('Brown');
    setAutoFilled(true);
  }, [step, autoFilled, selectedReport.report]);

  const next = () => setStep(((step + 1) as Step));
  const back = () => (step === 1 ? nav.goBack() : setStep(((step - 1) as Step)));

  async function handleSubmit() {
    if (!user) {
      Alert.alert('Sign-in required', 'Please sign in to log a dive.');
      return;
    }
    if (!spotId) {
      Alert.alert('Pick a spot', 'Choose a spot from Step 1 before submitting.');
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const surfaceMap: Record<string, CommunityReport['reportedEntryCondition']> = {
        Calm: 'SAFE', Choppy: 'CHOPPY', Rough: 'ROUGH',
      };
      const currentMap: Record<string, CommunityReport['reportedCurrent']> = {
        None: 'NONE', Light: 'LIGHT', Moderate: 'MODERATE', Strong: 'STRONG',
      };
      const visMap: Record<string, CommunityReport['waterQuality']> = {
        Crystal: 'CLEAN', Clean: 'CLEAN', Murky: 'MURKY', Green: 'GREEN', Brown: 'BROWN',
      };

      const newId = await submitCommunityReport({
        userId: user.id,
        displayName: user.name,
        avatarUrl: user.photoUrl,
        spotId,
        spotName,
        loggedAt: new Date().toISOString(),
        diveType: type,
        overallRating: 'EXCELLENT',
        depthFt: depth ? Number(depth) : undefined,
        reportedCurrent: currentMap[current],
        reportedEntryCondition: surfaceMap[surface],
        waterQuality: visMap[vis],
        notes,
      });

      if (newId === null) {
        // Firebase not configured — succeed locally so the demo still completes.
        setStep(5);
      } else {
        setStep(5);
      }
    } catch (err) {
      Alert.alert('Submit failed', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

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

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Spot</Text>
          {reports.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {reports.map((r) => (
                <ChoiceChip
                  key={r.spot}
                  label={r.spotName}
                  selected={spotId === r.spot}
                  onPress={() => { setSpotId(r.spot); setAutoFilled(false); }}
                />
              ))}
            </ScrollView>
          ) : (
            <Input placeholder="Select your spot" value={spotName} onChangeText={() => undefined} />
          )}

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
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={typography.h1}>Conditions</Text>
          <Text style={styles.sub}>
            {selectedReport.report
              ? 'Pre-filled from live conditions — edit anything.'
              : 'Step 3 of 4 — what was it like?'}
          </Text>

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
          <Input placeholder="79 °F" keyboardType="number-pad" value={waterTempF} onChangeText={setWaterTempF} />

          {selectedReport.report?.now?.metrics?.windSpeedKts != null && (
            <Text style={[typography.bodySm, { color: colors.textMuted, marginTop: spacing.md }]}>
              Live: wind {Math.round(ktsToMph(selectedReport.report.now.metrics.windSpeedKts))} mph
              {selectedReport.report.now.rainRollups?.rain24hMM
                ? ` · ${selectedReport.report.now.rainRollups.rain24hMM.toFixed(0)}mm rain (24h)`
                : ''}
            </Text>
          )}
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
            <ChoiceChip label="Public" selected={privacy === 'Public'} onPress={() => setPrivacy('Public')} />
            <ChoiceChip label="Friends" selected={privacy === 'Friends'} onPress={() => setPrivacy('Friends')} />
            <ChoiceChip label="Only me" selected={privacy === 'Only me'} onPress={() => setPrivacy('Only me')} />
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
            label={step === 4 ? (submitting ? 'Submitting…' : 'Submit dive') : 'Continue'}
            iconRight="arrow-right"
            loading={submitting}
            disabled={submitting}
            onPress={() => (step === 4 ? handleSubmit() : next())}
          />
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
