import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Tag } from '@/components/Tag';
import { DiveReportCard } from '@/components/DiveReportCard';
import { Logo } from '@/components/Logo';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { diveReports, favoriteSpots } from '@/api/mockData';
import type { RootNav } from '@/navigation/types';

type Tab = 'Dashboard' | 'Dive Reports' | 'Friends' | 'Settings';
const TABS: Tab[] = ['Dashboard', 'Dive Reports', 'Friends', 'Settings'];

export function ProfileScreen() {
  const nav = useNavigation<RootNav>();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('Dashboard');
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header
        rightSlot={<Logo size={28} showWordmark color={colors.textPrimary} />}
        onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      />

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
            <Text style={[styles.tabLabel, tab === t && styles.tabActive]}>{t}</Text>
            {tab === t && <View style={styles.underline} />}
          </Pressable>
        ))}
      </View>

      <View style={styles.profileHead}>
        <Avatar initials={initials} size={96} ring />
        <Text style={[typography.h1, { marginTop: spacing.md }]}>{user?.name ?? 'Diver'}</Text>
        <Text style={styles.handle}>@{user?.handle ?? 'diver'} · KaiCast Forecaster</Text>
      </View>

      <Card style={styles.statsRow}>
        <Stat label="Dives" value="47" />
        <Divider />
        <Stat label="Friends" value="12" onPress={() => nav.navigate('Followers')} />
        <Divider />
        <Stat label="Spots" value={String(favoriteSpots.length)} />
      </Card>

      {tab === 'Dashboard' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Card>
            <Text style={typography.caption}>HIGHLIGHT THIS WEEK</Text>
            <Text style={[typography.h2, { marginTop: spacing.sm }]}>3 dives · 142 minutes</Text>
            <Text style={[typography.bodySm, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              Best visibility: 60ft at Electric Beach
            </Text>
          </Card>
          <Card>
            <Text style={typography.caption}>NEXT BEST WINDOW</Text>
            <Text style={[typography.h2, { marginTop: spacing.sm }]}>Tomorrow · 8–10 AM</Text>
            <Text style={[typography.bodySm, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              Three Tables — clean swell, rising tide
            </Text>
          </Card>
          <Button label="Log a new dive" iconLeft="plus" fullWidth onPress={() => nav.navigate('LogDive')} />
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
          <Pressable style={styles.signoutBtn} onPress={() => nav.navigate('ProfileSettings')}>
            <Text style={{ ...typography.body, color: colors.accent, fontWeight: '600' }}>All settings</Text>
          </Pressable>
          <Button label="Sign out" variant="danger" iconLeft="logout" onPress={signOut} />
          <Text style={styles.version}>KaiCast 1.0.0 (build 142)</Text>
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const Cmp: any = onPress ? Pressable : View;
  return (
    <Cmp onPress={onPress} style={statStyles.stat}>
      <Text style={typography.h2}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </Cmp>
  );
}

function Divider() { return <View style={statStyles.divider} />; }

function SettingRow({ icon, label, value, right }: { icon: any; label: string; value?: string; right?: string }) {
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
  tabs: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xl, paddingHorizontal: spacing.xl },
  tab: { paddingVertical: 8 },
  tabLabel: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  tabActive: { color: colors.textPrimary },
  underline: { height: 2, backgroundColor: colors.accent, marginTop: 4, borderRadius: 999 },
  profileHead: { alignItems: 'center', paddingHorizontal: spacing.xl },
  handle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.lg, marginTop: spacing.lg, marginHorizontal: spacing.xl },
  signoutBtn: { alignSelf: 'center', paddingVertical: spacing.md },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});

const statStyles = StyleSheet.create({
  stat: { alignItems: 'center', flex: 1 },
  label: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
});

const settingStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconWrap: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  value: { ...typography.bodySm, color: colors.textSecondary },
});
