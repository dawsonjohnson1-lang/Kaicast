import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { setUserProfile } from '@/api/userProfile';
import type { RootNav } from '@/navigation/types';

type EditField = null | { key: 'name' | 'handle'; label: string; value: string; placeholder: string };

export function ProfileSettingsScreen() {
  const nav = useNavigation<RootNav>();
  const { signOut, user } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const [push, setPush] = useState(true);
  const [vis, setVis] = useState(true);
  const [community, setCommunity] = useState(false);
  const [news, setNews] = useState(true);
  const [shareLoc, setShareLoc] = useState(false);
  const [leader, setLeader] = useState(true);
  const [editing, setEditing] = useState<EditField>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const displayName = profile?.name ?? user?.name ?? '—';
  const handle = profile?.handle ?? user?.handle ?? '—';

  const startEdit = (field: NonNullable<EditField>) => {
    setEditing(field);
    setDraft(field.value);
  };

  const saveEdit = async () => {
    if (!editing || !user) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      Alert.alert('Required', `${editing.label} can't be blank.`);
      return;
    }
    if (editing.key === 'handle' && !/^[a-z0-9_]{2,20}$/i.test(trimmed)) {
      Alert.alert('Invalid username', 'Use 2–20 letters, numbers, or underscores.');
      return;
    }
    setSaving(true);
    try {
      await setUserProfile(user.id, { [editing.key]: trimmed });
      setEditing(null);
    } catch (err: any) {
      Alert.alert('Couldn’t save', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header title="Settings" onBack={() => nav.goBack()} transparent />

      <SectionHeader>DISPLAY</SectionHeader>
      <Card padding={0}>
        <Row
          icon="profile"
          label="Display name"
          value={displayName}
          onPress={() =>
            startEdit({ key: 'name', label: 'Display name', value: displayName === '—' ? '' : displayName, placeholder: 'Dawson Johnson' })
          }
        />
        <Row
          icon="edit"
          label="Username"
          value={handle.startsWith('@') ? handle : `@${handle}`}
          onPress={() =>
            startEdit({ key: 'handle', label: 'Username', value: handle === '—' ? '' : handle, placeholder: 'bigdawg' })
          }
        />
      </Card>

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

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={modalStyles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={modalStyles.sheet} onPress={() => undefined}>
            <View style={modalStyles.handle} />
            <Text style={modalStyles.title}>{editing?.label}</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={editing?.placeholder}
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize={editing?.key === 'handle' ? 'none' : 'words'}
              autoCorrect={false}
              style={modalStyles.input}
              maxLength={40}
            />
            <View style={modalStyles.actions}>
              <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} />
              <Button label="Save" loading={saving} onPress={saveEdit} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Row({ icon, label, value, onPress }: { icon?: IconName; label: string; value?: string; onPress?: () => void }) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper style={rowStyles.row} onPress={onPress}>
      {icon && <View style={rowStyles.iconWrap}><Icon name={icon} size={18} color={colors.textSecondary} /></View>}
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      {value ? <Text style={rowStyles.value}>{value}</Text> : null}
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </Wrapper>
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

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 999,
    backgroundColor: colors.border,
  },
  title: { ...typography.h3 },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
});
