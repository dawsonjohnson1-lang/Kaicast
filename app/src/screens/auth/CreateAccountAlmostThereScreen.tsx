import React, { useState } from 'react';
import { View, Text, Pressable, Switch, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { ChoiceChip } from '@/components/ChoiceChip';
import { ProgressBars } from '@/components/ProgressBars';
import { Icon } from '@/components/Icon';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';

const DIVE_TIMES = ['Early morning', 'Midday', 'Afternoon', 'Sunset', 'Night'];
const COMPANY = ['Solo', 'With a buddy', 'Small group', 'Guided'];

export function CreateAccountAlmostThereScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();

  const [time, setTime] = useState('Early morning');
  const [company, setCompany] = useState('Solo');
  const [howHeard, setHowHeard] = useState('');

  const [visibilityAlerts, setVisibilityAlerts] = useState(true);
  const [runoffWarnings, setRunoffWarnings] = useState(true);
  const [bestWindow, setBestWindow] = useState(true);
  const [newsletter, setNewsletter] = useState(true);
  const [newFeatures, setNewFeatures] = useState(true);
  const [communityReports, setCommunityReports] = useState(false);

  const finish = () =>
    signIn({
      id: 'demo',
      name: 'Dawson',
      handle: 'bigdawg',
      email: 'dawson@kaicast.com',
      homeSpot: "Three Tables, O'ahu",
    });

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <View style={styles.banner}>
        <Image
          source={require('../../../assets/hero-underwater.jpg')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(24,24,24,0.2)' }]} />
        <LinearGradient
          colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFill}
        />
        <Logo size={28} showWordmark={false} />
        <View style={styles.bannerProgress}>
          <ProgressBars total={3} current={3} />
        </View>
      </View>

      <Text style={typography.h1}>Almost there</Text>
      <Text style={styles.sub}>Set your preferences — change these anytime in settings.</Text>

      <Text style={styles.section}>DIVE PREFERENCES</Text>
      <Text style={styles.fieldLabel}>Preferred dive time</Text>
      <View style={styles.chipRow}>
        {DIVE_TIMES.map((t) => (
          <ChoiceChip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />
        ))}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>I usually dive</Text>
      <View style={styles.chipRow}>
        {COMPANY.map((c) => (
          <ChoiceChip key={c} label={c} selected={company === c} onPress={() => setCompany(c)} />
        ))}
      </View>

      <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>How did you hear about Kaicast?</Text>
      <Pressable style={styles.select} onPress={() => setHowHeard(howHeard ? '' : 'A friend')}>
        <Text style={[styles.selectText, !howHeard && { color: colors.textMuted }]}>
          {howHeard || 'Select one'}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Text style={styles.section}>FORECAST NOTIFICATIONS</Text>
      <ToggleRow
        title="Visibility alerts"
        sub="When conditions improve at your spots"
        value={visibilityAlerts}
        onChange={setVisibilityAlerts}
      />
      <ToggleRow
        title="Runoff warnings"
        sub="High runoff risk at your spots"
        value={runoffWarnings}
        onChange={setRunoffWarnings}
      />
      <ToggleRow
        title="Best conditions window"
        sub="Peak visibility alerts"
        value={bestWindow}
        onChange={setBestWindow}
      />

      <Text style={styles.section}>COMMUNITY & UPDATES</Text>
      <ToggleRow
        title="Newsletter"
        sub="Ocean conditions, tips & news"
        value={newsletter}
        onChange={setNewsletter}
      />
      <ToggleRow
        title="New features"
        sub="Be first to know what we ship"
        value={newFeatures}
        onChange={setNewFeatures}
      />
      <ToggleRow
        title="Community dive reports"
        sub="Reports from divers at your spots"
        value={communityReports}
        onChange={setCommunityReports}
      />

      <View style={styles.actions}>
        <Button label="Back" variant="ghost" iconLeft="chevron-left" onPress={() => nav.goBack()} />
        <Button label="Finish setup" iconRight="arrow-right" onPress={finish} />
      </View>
    </Screen>
  );
}

function ToggleRow({
  title,
  sub,
  value,
  onChange,
}: {
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#2a2a2a', true: colors.accent }}
        thumbColor="#ffffff"
        ios_backgroundColor="#2a2a2a"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  bannerProgress: { width: '100%', marginTop: spacing.md },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: spacing.sm, marginBottom: spacing.xl },
  section: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  toggleTitle: { ...typography.body, fontWeight: '600' },
  toggleSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
});
