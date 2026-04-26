import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import type { RootNav } from '@/navigation/types';

export function ProfileSettingsScreen() {
  const nav = useNavigation<RootNav>();
  const { signOut, user } = useAuth();
  const [push, setPush] = useState(true);
  const [vis, setVis] = useState(true);
  const [community, setCommunity] = useState(false);
  const [news, setNews] = useState(true);
  const [shareLoc, setShareLoc] = useState(false);
  const [leader, setLeader] = useState(true);

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header title="Settings" onBack={() => nav.goBack()} transparent />

      <SectionHeader>ACCOUNT</SectionHeader>
      <Card padding={0}>
        <Row icon="mail" label="Email" value={user?.email ?? '—'} />
        <Row icon="phone" label="Phone" value="+1 (808) 555-0129" />
        <Row icon="lock" label="Password & security" />
      </Card>

      <SectionHeader>DIVER PROFILE</SectionHeader>
      <Card padding={0}>
        <Row icon="shield" label="Certification" value="PADI Rescue" />
        <Row icon="fish" label="Years diving" value="8 years" />
        <Row icon="pin" label="Home spot" value={user?.homeSpot ?? "Three Tables, O'ahu"} />
        <Row icon="fish" label="Preferred dive type" value="Spearfishing" />
        <Row icon="bookmark" label="Gear profiles" value="3 saved" />
      </Card>

      <SectionHeader>PREFERENCES</SectionHeader>
      <Card padding={0}>
        <Row icon="globe" label="Units" value="Imperial (ft, °F, PSI)" />
        <Row icon="fish" label="Default dive type" value="Spearfishing" />
        <Row icon="globe" label="Language" value="English" />
        <Row icon="moon" label="Appearance" value="Dark" />
      </Card>

      <SectionHeader>PRIVACY</SectionHeader>
      <Card padding={0}>
        <Row icon="eye" label="Dive log visibility" value="Friends" />
        <ToggleRow icon="pin" label="Share spot locations" value={shareLoc} onValueChange={setShareLoc} />
        <ToggleRow icon="star" label="Show me in leaderboards" value={leader} onValueChange={setLeader} />
      </Card>

      <SectionHeader>NOTIFICATIONS</SectionHeader>
      <Card padding={0}>
        <ToggleRow icon="bell" label="Push notifications" sub="Conditions, reports, alerts" value={push} onValueChange={setPush} />
        <ToggleRow icon="eye" label="Visibility alerts" value={vis} onValueChange={setVis} />
        <ToggleRow icon="comment" label="Community reports" value={community} onValueChange={setCommunity} />
        <ToggleRow icon="mail" label="Newsletter" value={news} onValueChange={setNews} />
      </Card>

      <SectionHeader>DATA & SUPPORT</SectionHeader>
      <Card padding={0}>
        <Row icon="share" label="Export my dive log" />
        <Row icon="shield" label="Help & FAQ" />
        <Row icon="mail" label="Contact support" />
        <Row icon="star" label="Rate KaiCast" />
      </Card>

      <SectionHeader>LEGAL</SectionHeader>
      <Card padding={0}>
        <Row label="Terms of service" />
        <Row label="Privacy policy" />
      </Card>

      <View style={{ height: spacing.xxl }} />
      <Button label="Sign out" variant="danger" iconLeft="logout" fullWidth onPress={signOut} />
      <Pressable style={styles.delete}>
        <Text style={{ ...typography.bodySm, color: colors.textMuted }}>Delete account</Text>
      </Pressable>
      <Text style={styles.version}>KaiCast 1.0.0 (build 142)</Text>
    </Screen>
  );
}

function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Row({ icon, label, value }: { icon?: IconName; label: string; value?: string }) {
  return (
    <View style={rowStyles.row}>
      {icon && <View style={rowStyles.iconWrap}><Icon name={icon} size={18} color={colors.textSecondary} /></View>}
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      {value ? <Text style={rowStyles.value}>{value}</Text> : null}
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </View>
  );
}

function ToggleRow({ icon, label, sub, value, onValueChange }: { icon?: IconName; label: string; sub?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={rowStyles.row}>
      {icon && <View style={rowStyles.iconWrap}><Icon name={icon} size={18} color={colors.textSecondary} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={typography.body}>{label}</Text>
        {sub && <Text style={{ ...typography.bodySm, color: colors.textMuted, marginTop: 2 }}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  delete: { alignSelf: 'center', marginTop: spacing.md },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconWrap: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  value: { ...typography.bodySm, color: colors.textSecondary, marginRight: spacing.sm },
});
