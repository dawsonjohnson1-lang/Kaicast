import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Button } from '@/components/Button';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useSpots } from '@/hooks/useSpots';
import {
  updateUserSetting,
  reauthWithPassword,
  pathRequiresReauth,
} from '@/api/updateUserSetting';
import { deleteAccount } from '@/api/deleteAccount';
import {
  CERTIFICATION_LABELS,
  CERTIFICATION_VALUES,
  PREFERRED_DIVE_TYPE_LABELS,
  PREFERRED_DIVE_TYPE_VALUES,
  UNITS_LABELS,
  UNITS_VALUES,
  SETTINGS_PATHS,
  LEGAL_LINKS,
  type Certification,
  type PreferredDiveType,
  type SettingsPath,
  type Units,
} from '@/shared/userSettings';
import type { RootNav } from '@/navigation/types';

// Settings screen — canonical Firestore-backed surface, mirrored on
// desktop's SettingsTabBody. Same fields, same source of truth,
// same write path (updateUserSetting callable).
//
// Render pattern: snapshot value (from useUserSettings) is the
// baseline; `pending` map holds in-flight optimistic values until the
// snapshot catches up. On callable error, the pending entry is dropped
// and we surface an Alert.

type PendingMap = Partial<Record<SettingsPath, string | boolean>>;

type PickerSpec =
  | { kind: 'enum'; path: SettingsPath; title: string; options: ReadonlyArray<{ value: string; label: string }>; current: string }
  | { kind: 'spot'; current: string }
  | { kind: 'text'; path: SettingsPath; title: string; placeholder: string; current: string; keyboard?: 'phone-pad' | 'default'; needsReauth?: boolean };

export function ProfileSettingsScreen() {
  const nav = useNavigation<RootNav>();
  const { signOut, user } = useAuth();
  const { settings, loading } = useUserSettings(user?.id);
  const [pending, setPending] = useState<PendingMap>({});
  const [picker, setPicker] = useState<PickerSpec | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Snapshot value, overridden by any in-flight optimistic write.
  const read = <T extends string | boolean,>(path: SettingsPath, fallback: T): T => {
    const p = pending[path];
    if (p !== undefined) return p as T;
    if (!settings) return fallback;
    return readFromSettings(settings, path) as T;
  };

  const write = async (path: SettingsPath, value: string | boolean, opts?: { acknowledgedReauth?: boolean }) => {
    setPending((m) => ({ ...m, [path]: value }));
    try {
      await updateUserSetting({ path, value, acknowledgedReauth: opts?.acknowledgedReauth === true });
      // Live snapshot will catch up; clear pending so the snapshot wins
      // (avoids a stale optimistic value lingering if the server
      // normalized it differently).
      setPending((m) => {
        const next = { ...m };
        delete next[path];
        return next;
      });
    } catch (err: any) {
      setPending((m) => {
        const next = { ...m };
        delete next[path];
        return next;
      });
      Alert.alert('Couldn’t save', err?.message ?? 'Please try again.');
    }
  };

  const onPickerCommit = async (value: string, p: PickerSpec) => {
    setPicker(null);
    if (p.kind === 'spot') {
      await write(SETTINGS_PATHS.homeSpotId, value);
    } else if (p.kind === 'enum') {
      await write(p.path, value);
    } else if (p.kind === 'text') {
      await write(p.path, value, { acknowledgedReauth: p.needsReauth });
    }
  };

  const certVal = read<Certification>(SETTINGS_PATHS.certification, 'none' as Certification);
  const diveTypeVal = read<PreferredDiveType>(SETTINGS_PATHS.preferredDiveType, 'scuba' as PreferredDiveType);
  const unitsVal = read<Units>(SETTINGS_PATHS.units, 'imperial' as Units);
  const homeSpotIdVal = read<string>(SETTINGS_PATHS.homeSpotId, '');
  const phoneVal = read<string>(SETTINGS_PATHS.phone, '');
  const emailVal = settings?.email ?? user?.email ?? '';

  const pushEnabled = read<boolean>(SETTINGS_PATHS.pushEnabled, true);
  const pushConditions = read<boolean>(SETTINGS_PATHS.pushCategoryConditionAlerts, true);
  const pushFriends = read<boolean>(SETTINGS_PATHS.pushCategoryFriendReports, true);
  const pushSystem = read<boolean>(SETTINGS_PATHS.pushCategorySystem, true);

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header title="Settings" onBack={() => nav.goBack()} transparent />

      {loading && !settings ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : null}

      <SectionHeader>ACCOUNT</SectionHeader>
      <Card padding={0}>
        {/* Email is a Firebase Auth identity; editing it requires the
            verifyBeforeUpdateEmail flow which we haven't wired yet.
            Display-only for v1 — see CHANGES.md. */}
        <Row icon="mail" label="Email" value={emailVal} />
        <Row
          icon="phone"
          label="Phone"
          value={phoneVal || 'Add phone'}
          onPress={() =>
            setPicker({
              kind: 'text',
              path: SETTINGS_PATHS.phone,
              title: 'Phone (E.164)',
              placeholder: '+18085550129',
              current: phoneVal,
              keyboard: 'phone-pad',
              needsReauth: pathRequiresReauth(SETTINGS_PATHS.phone),
            })
          }
        />
        <Row
          icon="lock"
          label="Password & security"
          onPress={() => {
            // Deep-link to Firebase Auth's hosted password reset for
            // v1. Once we ship an in-app flow this can be replaced.
            const email = encodeURIComponent(emailVal);
            // Note: no PII in URL query for the user-doc path — this
            // hands the email to Firebase's own reset domain only.
            Linking.openURL(`https://accounts.google.com/AccountChooser?Email=${email}`).catch(
              () => Alert.alert('Couldn’t open', 'Try resetting via the sign-in screen.'),
            );
          }}
        />
      </Card>

      <SectionHeader>DIVER PROFILE</SectionHeader>
      <Card padding={0}>
        <Row
          icon="shield"
          label="Certification"
          value={CERTIFICATION_LABELS[certVal]}
          onPress={() =>
            setPicker({
              kind: 'enum',
              path: SETTINGS_PATHS.certification,
              title: 'Certification',
              options: CERTIFICATION_VALUES.map((v) => ({ value: v, label: CERTIFICATION_LABELS[v] })),
              current: certVal,
            })
          }
        />
        <Row
          icon="fish"
          label="Preferred dive type"
          value={PREFERRED_DIVE_TYPE_LABELS[diveTypeVal]}
          onPress={() =>
            setPicker({
              kind: 'enum',
              path: SETTINGS_PATHS.preferredDiveType,
              title: 'Preferred dive type',
              options: PREFERRED_DIVE_TYPE_VALUES.map((v) => ({ value: v, label: PREFERRED_DIVE_TYPE_LABELS[v] })),
              current: diveTypeVal,
            })
          }
        />
        <Row
          icon="pin"
          label="Home spot"
          value={homeSpotIdVal || 'Pick a spot'}
          onPress={() => setPicker({ kind: 'spot', current: homeSpotIdVal })}
        />
      </Card>

      <SectionHeader>PREFERENCES</SectionHeader>
      <Card padding={0}>
        <ToggleRow
          icon="bell"
          label="Push notifications"
          sub="Master toggle"
          value={pushEnabled}
          onValueChange={(v) => write(SETTINGS_PATHS.pushEnabled, v)}
        />
        <ToggleRow
          icon="eye"
          label="Condition alerts"
          sub="Best-window and runoff warnings at your favorite spots"
          value={pushConditions && pushEnabled}
          disabled={!pushEnabled}
          onValueChange={(v) => write(SETTINGS_PATHS.pushCategoryConditionAlerts, v)}
        />
        <ToggleRow
          icon="comment"
          label="Friend reports"
          sub="When people you follow log a dive"
          value={pushFriends && pushEnabled}
          disabled={!pushEnabled}
          onValueChange={(v) => write(SETTINGS_PATHS.pushCategoryFriendReports, v)}
        />
        <ToggleRow
          icon="bell"
          label="System"
          sub="Service announcements, sign-in alerts"
          value={pushSystem && pushEnabled}
          disabled={!pushEnabled}
          onValueChange={(v) => write(SETTINGS_PATHS.pushCategorySystem, v)}
        />
        <Row
          icon="globe"
          label="Units"
          value={UNITS_LABELS[unitsVal]}
          onPress={() =>
            setPicker({
              kind: 'enum',
              path: SETTINGS_PATHS.units,
              title: 'Units',
              options: UNITS_VALUES.map((v) => ({ value: v, label: UNITS_LABELS[v] })),
              current: unitsVal,
            })
          }
        />
      </Card>

      <SectionHeader>LEGAL & SUPPORT</SectionHeader>
      <Card padding={0}>
        <Row label="Privacy Policy" onPress={() => Linking.openURL(LEGAL_LINKS.privacyPolicy)} />
        <Row label="Terms of Service" onPress={() => Linking.openURL(LEGAL_LINKS.termsOfService)} />
        <Row label="Help & support" onPress={() => Linking.openURL(LEGAL_LINKS.supportMailto)} />
      </Card>

      <View style={{ height: spacing.xxl }} />
      <Button label="Sign out" variant="danger" iconLeft="logout" fullWidth onPress={signOut} />
      <Pressable style={styles.delete} onPress={() => setDeleteOpen(true)}>
        <Text style={{ ...typography.bodySm, color: colors.textMuted }}>Delete account</Text>
      </Pressable>
      <Text style={styles.version}>KaiCast 1.0.0</Text>

      <PickerModal spec={picker} onClose={() => setPicker(null)} onCommit={onPickerCommit} />
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </Screen>
  );
}

function readFromSettings(s: NonNullable<ReturnType<typeof useUserSettings>['settings']>, path: SettingsPath): string | boolean {
  switch (path) {
    case SETTINGS_PATHS.email:                       return s.email;
    case SETTINGS_PATHS.phone:                       return s.phone;
    case SETTINGS_PATHS.certification:               return s.profile.certification;
    case SETTINGS_PATHS.preferredDiveType:           return s.profile.preferredDiveType;
    case SETTINGS_PATHS.homeSpotId:                  return s.profile.homeSpotId;
    case SETTINGS_PATHS.units:                       return s.prefs.units;
    case SETTINGS_PATHS.pushEnabled:                 return s.prefs.pushNotifications.enabled;
    case SETTINGS_PATHS.pushCategoryConditionAlerts: return s.prefs.pushNotifications.categories.conditionAlerts;
    case SETTINGS_PATHS.pushCategoryFriendReports:   return s.prefs.pushNotifications.categories.friendReports;
    case SETTINGS_PATHS.pushCategorySystem:          return s.prefs.pushNotifications.categories.system;
  }
}

function PickerModal({
  spec,
  onClose,
  onCommit,
}: {
  spec: PickerSpec | null;
  onClose: () => void;
  onCommit: (value: string, spec: PickerSpec) => void;
}) {
  // Re-auth two-step: first capture password (needsReauth=true), then
  // capture the new value. `phase` tracks which screen we're on.
  const [phase, setPhase] = useState<'reauth' | 'value'>('value');
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState(false);

  React.useEffect(() => {
    if (spec) {
      setDraft(spec.kind !== 'spot' ? spec.current : '');
      setPassword('');
      setPhase(spec.kind === 'text' && spec.needsReauth ? 'reauth' : 'value');
    }
  }, [spec]);

  if (!spec) return null;

  const submitReauth = async () => {
    setWorking(true);
    try {
      await reauthWithPassword(password);
      setPhase('value');
    } catch (err: any) {
      Alert.alert('Re-auth failed', err?.message ?? 'Wrong password?');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal visible={!!spec} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={() => undefined}>
          <View style={modalStyles.handle} />
          {phase === 'reauth' && spec.kind === 'text' ? (
            <>
              <Text style={modalStyles.title}>Confirm your password</Text>
              <Text style={modalStyles.sub}>
                Changing {spec.title.toLowerCase()} requires re-authentication.
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                style={modalStyles.input}
              />
              <View style={modalStyles.actions}>
                <Button label="Cancel" variant="ghost" onPress={onClose} />
                <Button label="Continue" loading={working} onPress={submitReauth} />
              </View>
            </>
          ) : null}

          {phase === 'value' && spec.kind === 'enum' ? (
            <>
              <Text style={modalStyles.title}>{spec.title}</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {spec.options.map((opt) => {
                  const isCur = opt.value === spec.current;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[modalStyles.optionRow, isCur && modalStyles.optionRowSel]}
                      onPress={() => onCommit(opt.value, spec)}
                    >
                      <Text style={modalStyles.optionText}>{opt.label}</Text>
                      {isCur ? <Icon name="check" size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {phase === 'value' && spec.kind === 'spot' ? (
            <SpotPicker current={spec.current} onPick={(spotId) => onCommit(spotId, spec)} />
          ) : null}

          {phase === 'value' && spec.kind === 'text' ? (
            <>
              <Text style={modalStyles.title}>{spec.title}</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                keyboardType={spec.keyboard ?? 'default'}
                placeholder={spec.placeholder}
                placeholderTextColor={colors.textMuted}
                style={modalStyles.input}
              />
              <View style={modalStyles.actions}>
                <Button label="Cancel" variant="ghost" onPress={onClose} />
                <Button label="Save" onPress={() => onCommit(draft.trim(), spec)} />
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SpotPicker({ current, onPick }: { current: string; onPick: (spotId: string) => void }) {
  const { spots } = useSpots();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return spots;
    return spots.filter((s) => s.name.toLowerCase().includes(needle) || s.region.toLowerCase().includes(needle));
  }, [q, spots]);
  return (
    <>
      <Text style={modalStyles.title}>Home spot</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Filter spots…"
        placeholderTextColor={colors.textMuted}
        style={modalStyles.input}
      />
      <ScrollView style={{ maxHeight: 360 }}>
        {filtered.map((s) => {
          const isCur = s.id === current;
          return (
            <Pressable
              key={s.id}
              style={[modalStyles.optionRow, isCur && modalStyles.optionRowSel]}
              onPress={() => onPick(s.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.optionText}>{s.name}</Text>
                <Text style={modalStyles.optionSub}>{s.region}</Text>
              </View>
              {isCur ? <Icon name="check" size={16} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const submit = async () => {
    setWorking(true);
    try {
      await deleteAccount(password);
      onClose();
    } catch (err: any) {
      Alert.alert('Couldn’t delete', err?.message ?? 'Wrong password or recent sign-in required.');
    } finally {
      setWorking(false);
    }
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={() => undefined}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Delete account</Text>
          <Text style={modalStyles.sub}>
            This is permanent. Your profile, dive logs, and stats will be removed.
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            style={modalStyles.input}
          />
          <View style={modalStyles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button label="Delete" variant="danger" loading={working} onPress={submit} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper style={rowStyles.row} onPress={onPress}>
      {icon && (
        <View style={rowStyles.iconWrap}>
          <Icon name={icon} size={18} color={colors.textSecondary} />
        </View>
      )}
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      {value ? (
        <Text style={rowStyles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Icon name="chevron-right" size={16} color={colors.textMuted} /> : null}
    </Wrapper>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
  disabled,
}: {
  icon?: IconName;
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[rowStyles.row, disabled && { opacity: 0.45 }]}>
      {icon && (
        <View style={rowStyles.iconWrap}>
          <Icon name={icon} size={18} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={typography.body}>{label}</Text>
        {sub && (
          <Text style={{ ...typography.bodySm, color: colors.textMuted, marginTop: 2 }}>{sub}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  delete: { alignSelf: 'center', marginTop: spacing.md },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  loading: { ...typography.bodySm, color: colors.textMuted, paddingHorizontal: spacing.lg },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...typography.bodySm, color: colors.textSecondary, marginRight: spacing.sm, maxWidth: 180 },
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
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  title: { ...typography.h3 },
  sub: { ...typography.bodySm, color: colors.textMuted },
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  optionRowSel: { backgroundColor: colors.cardAlt },
  optionText: { ...typography.body, color: colors.textPrimary },
  optionSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
