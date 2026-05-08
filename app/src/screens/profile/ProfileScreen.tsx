import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon, IconName } from '@/components/Icon';
import { Tag } from '@/components/Tag';
import { DiveReportCard } from '@/components/DiveReportCard';
import { SpotMiniCard } from '@/components/SpotMiniCard';
import { Logo } from '@/components/Logo';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { diveReports, favoriteSpots } from '@/api/mockData';
import type { RootStackParamList, TabParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Tab = 'Dashboard' | 'Dive Reports' | 'Friends' | 'Settings';
const TABS: Tab[] = ['Dashboard', 'Dive Reports', 'Friends', 'Settings'];

const FOLLOWERS_COUNT = 45;
const FOLLOWING_COUNT = 12;

export function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const { user, signOut } = useAuth();
  const photo = useProfilePhoto();
  const [tab, setTab] = useState<Tab>('Dashboard');
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);
  const displayName = (user?.name ?? 'Diver').toUpperCase();
  const handle = user?.handle ?? 'diver';

  const onClose = () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Dashboard');
  };

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <View style={styles.headerRow}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Icon name="x" size={20} color={colors.textPrimary} />
        </Pressable>
        <Logo size={22} showWordmark />
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.profileHead}>
        <Avatar size={132} ring imageSource={photo} initials={initials} />
        <Text style={[typography.display, { marginTop: spacing.lg }]}>{displayName}</Text>
        <Text style={styles.handle}>@{handle}</Text>
        <Text style={styles.location}>OAHU, HAWAII</Text>
        <View style={styles.statsRow}>
          <Pressable style={styles.statCol} onPress={() => nav.navigate('Followers')}>
            <Text style={styles.statBold}>{FOLLOWERS_COUNT}</Text>
            <Text style={styles.statMuted}>Followers</Text>
          </Pressable>
          <Pressable style={styles.statCol} onPress={() => nav.navigate('Following')}>
            <Text style={styles.statBold}>{FOLLOWING_COUNT}</Text>
            <Text style={styles.statMuted}>Following</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ height: spacing.lg }} />
      <Button label="+ Add New Dive Log" fullWidth onPress={() => nav.navigate('LogDive')} />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
            <Text style={[styles.tabLabel, tab === t && styles.tabActive]}>{t}</Text>
            {tab === t && <View style={styles.underline} />}
          </Pressable>
        ))}
      </View>

      {tab === 'Dashboard' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          <View style={styles.tileGrid}>
            <StatTile value="65" unit="ft" label="MAX DEPTH REPORTED"   borderColor={colors.excellent} />
            <StatTile value="6"  unit=""   label="DIFFERENT SPOTS DIVED" borderColor={colors.accent} />
            <StatTile value="25" unit=""   label="LOGGED DIVES"          borderColor={colors.scuba} />
          </View>

          <View>
            <SectionHeader title="Favorite Spots" actionLabel="See all" onAction={() => nav.navigate('Saved')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {favoriteSpots.map((s) => (
                <SpotMiniCard key={s.id} spot={s} width={172} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} />
              ))}
            </ScrollView>
          </View>

          <View>
            <SectionHeader title="Your Reports" actionLabel="See all" onAction={() => {}} />
            <View style={{ gap: spacing.md }}>
              {diveReports.map((r) => (
                <DiveReportCard key={r.id} report={r} onPress={() => nav.navigate('DiveReportDetail', { reportId: r.id })} />
              ))}
            </View>
          </View>

          <Button label="Log Your Dive" fullWidth onPress={() => nav.navigate('LogDive')} />
        </View>
      )}

      {tab === 'Dive Reports' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {diveReports.map((r) => (
            <DiveReportCard key={r.id} report={r} onPress={() => nav.navigate('DiveReportDetail', { reportId: r.id })} />
          ))}
        </View>
      )}

      {tab === 'Friends' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button label="12 Followers" variant="secondary" onPress={() => nav.navigate('Followers')} style={{ flex: 1 }} />
            <Button label="34 Following" variant="secondary" onPress={() => nav.navigate('Following')} style={{ flex: 1 }} />
          </View>
          {[
            { name: 'Mike Kahale', handle: '@mike_kahale' },
            { name: 'Sara Lopes', handle: '@saralopes' },
            { name: 'Tomo Tanaka', handle: '@tomo' },
          ].map((f) => (
            <Card key={f.handle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar initials={f.name.split(' ').map((s) => s[0]).join('')} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{f.name}</Text>
                  <Text style={{ ...typography.bodySm, color: colors.textSecondary }}>{f.handle}</Text>
                </View>
                <Tag variant="freedive" label="Following" />
              </View>
            </Card>
          ))}
        </View>
      )}

      {tab === 'Settings' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Card padding={0}>
            <SettingRow icon="mail" label="Email" value="dawson@kaicast.com" />
            <SettingRow icon="phone" label="Phone" value="+1 (808) 555-0129" />
            <SettingRow icon="lock" label="Password & security" />
          </Card>
          <Card padding={0}>
            <SettingRow icon="shield" label="Certification" value="PADI Rescue" />
            <SettingRow icon="fish" label="Preferred dive type" value="Spearfishing" />
            <SettingRow icon="pin" label="Home spot" value={user?.homeSpot ?? "Three Tables, O'ahu"} />
          </Card>
          <Card padding={0}>
            <SettingRow icon="bell" label="Push notifications" right="On" />
            <SettingRow icon="globe" label="Units" value="Imperial (ft, °F, PSI)" />
          </Card>
          <Pressable style={styles.allSettingsBtn} onPress={() => nav.navigate('ProfileSettings')}>
            <Text style={{ ...typography.body, color: colors.accent, fontWeight: '600' }}>All settings</Text>
          </Pressable>
          <Button label="Sign out" variant="danger" iconLeft="logout" onPress={signOut} />
          <Text style={styles.version}>KaiCast 1.0.0 (build 142)</Text>
        </View>
      )}
    </Screen>
  );
}

function StatTile({ value, unit, label, borderColor }: { value: string; unit: string; label: string; borderColor: string }) {
  return (
    <Pressable style={[tileStyles.tile, { borderColor }]}>
      <View style={tileStyles.row}>
        <Text style={tileStyles.value}>{value}</Text>
        {unit ? <Text style={tileStyles.unit}>{unit}</Text> : null}
      </View>
      <Text style={tileStyles.label}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={typography.h3}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction}>
          <Text style={styles.seeAll}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SettingRow({ icon, label, value, right }: { icon: IconName; label: string; value?: string; right?: string }) {
  return (
    <View style={settingStyles.row}>
      <View style={settingStyles.iconWrap}>
        <Icon name={icon} size={18} color={colors.textSecondary} />
      </View>
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      {value ? <Text style={settingStyles.value}>{value}</Text> : null}
      {right ? <Text style={[settingStyles.value, { color: colors.accent }]}>{right}</Text> : null}
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHead: { alignItems: 'center' },
  handle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  location: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  statCol: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statBold: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statMuted: { ...typography.bodySm, color: colors.textSecondary },
  tabs: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  tab: { paddingVertical: 8 },
  tabLabel: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  tabActive: { color: colors.textPrimary },
  underline: { height: 2, backgroundColor: colors.accent, marginTop: 4, borderRadius: 999 },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  seeAll: { ...typography.bodySm, color: colors.accent, fontWeight: '600' },
  hRow: { gap: spacing.md, paddingRight: spacing.xl },
  allSettingsBtn: { alignSelf: 'center', paddingVertical: spacing.md },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});

const tileStyles = StyleSheet.create({
  tile: {
    flexBasis: '31%',
    flexGrow: 1,
    height: 120,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.card,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  value: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  unit: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  value: { ...typography.bodySm, color: colors.textSecondary },
});
