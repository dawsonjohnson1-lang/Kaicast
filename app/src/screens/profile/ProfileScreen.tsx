import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking, Share, Modal, TextInput, Alert } from 'react-native';
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
import { useUserProfile } from '@/hooks/useUserProfile';
import { setUserProfile } from '@/api/userProfile';
import { useUserDiveLogs, diveLogToReport } from '@/hooks/useDiveLogs';
import { useUserStats } from '@/hooks/useUserStats';
import { useSpots } from '@/hooks/useSpots';
import { useFollowing } from '@/hooks/useFollowing';
import * as Notifications from 'expo-notifications';
import { registerForPush } from '@/api/push';
import { LEGAL_URLS } from '@/constants/legal';
import { useFavorites } from '@/hooks/useFavorites';
import type { RootStackParamList, TabParamList } from '@/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Tab = 'Dashboard' | 'Dive Reports' | 'Friends' | 'Settings';
const TABS: Tab[] = ['Dashboard', 'Dive Reports', 'Friends', 'Settings'];

export function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const { logs: userLogs } = useUserDiveLogs(user?.id);
  const { spots } = useSpots();
  const { counts: followCounts, following: followingList, followers: followersList } = useFollowing(user?.id);
  const followersUidSet = useMemo(() => new Set(followersList.map((f) => f.uid)), [followersList]);
  const fallbackPhoto = useProfilePhoto();
  // Resolve spot ids → human names so log cards show "Electric Beach"
  // not "electric-beach". Custom spots already carry their own name
  // inline on the log; this lookup only matters for known spot ids.
  const spotsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spots) m.set(s.id, s.name);
    return m;
  }, [spots]);

  const authorName = profile?.name ?? user?.name ?? 'You';
  const userReports = userLogs.map((l) =>
    diveLogToReport(l, authorName, spotsById.get(l.spotId) ?? l.spotId),
  );

  // Live profile stats come from /users/{uid}/stats/summary, written by
  // the aggregateUserStats Cloud Function. Single writer, both clients
  // read the same numbers — see functions/aggregations/userStats.js.
  const { stats } = useUserStats(user?.id);
  const totalDives = stats?.totalDives ?? 0;
  const deepestDiveFt = stats?.deepestDive ?? 0;
  const totalBottomTimeHours = stats
    ? Math.round((stats.totalBottomTime / 3600) * 10) / 10
    : 0;

  // Real favorites (heart icon on Spot Detail) → carousel content.
  const { favorites: favoriteIds } = useFavorites(user?.id);
  const favoriteSpots = useMemo(
    () => spots.filter((s) => favoriteIds.has(s.id)),
    [spots, favoriteIds],
  );
  const [tab, setTab] = useState<Tab>('Dashboard');
  // Edit-profile sheet — fields mirror desktop's EditableSettingsRow
  // section under Account in ProfileScreen.tsx.
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: '',
    handle: '',
    homeIsland: '',
    homeTown: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const openEdit = () => {
    setEditDraft({
      name: profile?.name ?? '',
      handle: (profile?.handle ?? '').replace(/^@/, ''),
      homeIsland: profile?.homeIsland ?? '',
      homeTown: profile?.homeTown ?? '',
    });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!user) return;
    const trimmedName = editDraft.name.trim();
    const trimmedHandle = editDraft.handle.trim();
    if (!trimmedName) {
      Alert.alert('Required', "Display name can't be blank.");
      return;
    }
    if (trimmedHandle && !/^[a-z0-9_]{2,20}$/i.test(trimmedHandle)) {
      Alert.alert('Invalid username', 'Use 2–20 letters, numbers, or underscores.');
      return;
    }
    setEditSaving(true);
    try {
      await setUserProfile(user.id, {
        name: trimmedName,
        handle: trimmedHandle || undefined,
        homeIsland: editDraft.homeIsland.trim() || undefined,
        homeTown: editDraft.homeTown.trim() || undefined,
      });
      setEditOpen(false);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Please try again.';
      Alert.alert("Couldn't save", msg);
    } finally {
      setEditSaving(false);
    }
  };

  // Prefer the live profile doc when present; fall back to the auth
  // user blob (which itself falls back to email-derived defaults).
  const displayName = (profile?.name ?? user?.name ?? 'Diver').toUpperCase();
  const handle = profile?.handle ?? user?.handle ?? 'diver';
  const initials = (profile?.firstName || profile?.name || user?.name || 'D')
    .split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const photoSource = profile?.photoUrl ? { uri: profile.photoUrl } : fallbackPhoto;
  const homeLocation =
    [profile?.homeIsland, profile?.homeTown].filter(Boolean).join(', ').toUpperCase() ||
    'OAHU, HAWAII';

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
        <Avatar size={132} ring imageSource={photoSource} initials={initials} />
        <Text style={[typography.display, { marginTop: spacing.lg }]}>{displayName}</Text>
        <Text style={styles.handle}>@{handle}</Text>
        <Text style={styles.location}>{homeLocation}</Text>
        <Pressable style={editProfileStyles.cta} onPress={openEdit} hitSlop={6}>
          <Icon name="edit" size={13} color={colors.textSecondary} />
          <Text style={editProfileStyles.ctaText}>Edit profile</Text>
        </Pressable>
        <View style={styles.statsRow}>
          <Pressable style={styles.statCol} onPress={() => nav.navigate('Followers')}>
            <Text style={styles.statBold}>{followCounts.followers}</Text>
            <Text style={styles.statMuted}>Followers</Text>
          </Pressable>
          <Pressable style={styles.statCol} onPress={() => nav.navigate('Following')}>
            <Text style={styles.statBold}>{followCounts.following}</Text>
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
            <StatTile value={String(totalDives)}                                 unit=""   label="DIVES LOGGED"          borderColor={colors.excellent} />
            <StatTile value={String(deepestDiveFt)}                              unit="ft" label="PERSONAL DEPTH RECORD" borderColor={colors.accent} />
            <StatTile value={Number.isInteger(totalBottomTimeHours) ? String(totalBottomTimeHours) : totalBottomTimeHours.toFixed(1)} unit="h"  label="TOTAL BOTTOM TIME"     borderColor={colors.scuba} />
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
            <SectionHeader title="Your Reports" actionLabel="See all" onAction={() => setTab('Dive Reports')} />
            {userReports.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {userReports.map((r) => (
                  <DiveReportCard key={r.id} report={r} onPress={() => nav.navigate('DiveReportDetail', { reportId: r.id })} />
                ))}
              </View>
            ) : (
              <Text style={{ ...typography.bodySm, color: colors.textSecondary }}>
                No dives logged yet. Tap "Log Your Dive" below to add your first.
              </Text>
            )}
          </View>

          <Button label="Log Your Dive" fullWidth onPress={() => nav.navigate('LogDive')} />
        </View>
      )}

      {tab === 'Dive Reports' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {userReports.length > 0 ? (
            userReports.map((r) => (
              <DiveReportCard key={r.id} report={r} onPress={() => nav.navigate('DiveReportDetail', { reportId: r.id })} />
            ))
          ) : (
            <Text style={{ ...typography.bodySm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
              You haven't logged any dives yet.
            </Text>
          )}
        </View>
      )}

      {tab === 'Friends' && (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              label={`${followCounts.followers} Followers`}
              variant="secondary"
              onPress={() => nav.navigate('Followers')}
              style={{ flex: 1 }}
            />
            <Button
              label={`${followCounts.following} Following`}
              variant="secondary"
              onPress={() => nav.navigate('Following')}
              style={{ flex: 1 }}
            />
          </View>
          <Button
            label="Find divers"
            variant="primary"
            iconLeft="search"
            fullWidth
            onPress={() => nav.navigate('DiscoverUsers')}
          />
          <Button
            label="Invite friends to KaiCast"
            variant="secondary"
            iconLeft="share"
            fullWidth
            onPress={async () => {
              try {
                await Share.share({
                  message: 'Track Hawaii dive conditions on KaiCast — water temp, visibility, currents, swell. Join me: https://kaicast.app/',
                  url: 'https://kaicast.app/',
                  title: 'KaiCast',
                });
              } catch {
                // user cancelled — silent (matches DiveReportDetailScreen)
              }
            }}
          />
          {followingList.length === 0 ? (
            <Card>
              <Text style={[typography.bodySm, { color: colors.textSecondary, textAlign: 'center' }]}>
                You're not following anyone yet.
              </Text>
            </Card>
          ) : (
            followingList.slice(0, 5).map((f) => {
              const initials = f.name.split(' ').map((s) => s[0]).filter(Boolean).join('').slice(0, 2);
              const handle = f.handle ? `@${f.handle.replace(/^@/, '')}` : '';
              const mutual = followersUidSet.has(f.uid);
              return (
                <Card key={f.uid}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Avatar
                      initials={initials}
                      size={42}
                      imageSource={f.photoUrl ? { uri: f.photoUrl } : undefined}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={typography.h3}>{f.name || 'Diver'}</Text>
                      <Text style={{ ...typography.bodySm, color: colors.textSecondary }}>{handle}</Text>
                    </View>
                    {mutual && <Tag variant="freedive" label="Mutual" />}
                  </View>
                </Card>
              );
            })
          )}
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
            <PushNotificationRow uid={user?.id} />
            <SettingRow icon="globe" label="Units" value="Imperial (ft, °F, PSI)" />
          </Card>
          <Card padding={0}>
            <LegalRow icon="shield" label="Privacy Policy" url={LEGAL_URLS.privacy} />
            <LegalRow icon="lock" label="Terms of Service" url={LEGAL_URLS.terms} />
          </Card>
          <Pressable style={styles.allSettingsBtn} onPress={() => nav.navigate('ProfileSettings')}>
            <Text style={{ ...typography.body, color: colors.accent, fontWeight: '600' }}>All settings</Text>
          </Pressable>
          <Button label="Sign out" variant="danger" iconLeft="logout" onPress={signOut} />
          <Pressable
            style={styles.deleteAccountBtn}
            onPress={() => nav.navigate('DeleteAccount')}
            hitSlop={8}
          >
            <Text style={styles.deleteAccountText}>Delete account</Text>
          </Pressable>
          <Text style={styles.version}>KaiCast 1.0.0 (build 142)</Text>
        </View>
      )}

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={editProfileStyles.backdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={editProfileStyles.sheet} onPress={() => undefined}>
            <View style={editProfileStyles.handle} />
            <Text style={editProfileStyles.title}>Edit profile</Text>

            <Text style={editProfileStyles.label}>Display name</Text>
            <TextInput
              value={editDraft.name}
              onChangeText={(v) => setEditDraft((p) => ({ ...p, name: v }))}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={editProfileStyles.input}
              autoCapitalize="words"
            />

            <Text style={editProfileStyles.label}>Username</Text>
            <View style={editProfileStyles.atRow}>
              <Text style={editProfileStyles.atSign}>@</Text>
              <TextInput
                value={editDraft.handle}
                onChangeText={(v) => setEditDraft((p) => ({ ...p, handle: v.replace(/^@/, '') }))}
                placeholder="yourhandle"
                placeholderTextColor={colors.textMuted}
                style={[editProfileStyles.input, { flex: 1, marginTop: 0 }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={editProfileStyles.label}>Home island</Text>
            <TextInput
              value={editDraft.homeIsland}
              onChangeText={(v) => setEditDraft((p) => ({ ...p, homeIsland: v }))}
              placeholder="Oahu"
              placeholderTextColor={colors.textMuted}
              style={editProfileStyles.input}
              autoCapitalize="words"
            />

            <Text style={editProfileStyles.label}>Home town</Text>
            <TextInput
              value={editDraft.homeTown}
              onChangeText={(v) => setEditDraft((p) => ({ ...p, homeTown: v }))}
              placeholder="Honolulu"
              placeholderTextColor={colors.textMuted}
              style={editProfileStyles.input}
              autoCapitalize="words"
            />

            <View style={editProfileStyles.actions}>
              <Button label="Cancel" variant="ghost" onPress={() => setEditOpen(false)} />
              <Button label="Save" loading={editSaving} onPress={saveEdit} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const editProfileStyles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  ctaText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
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
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 999,
    backgroundColor: colors.border,
  },
  title: { ...typography.h3, marginBottom: spacing.sm },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
    marginTop: 4,
  },
  atRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  atSign: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});

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

function PushNotificationRow({ uid }: { uid: string | undefined }) {
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (!cancelled) setEnabled(status === 'granted');
    });
    return () => { cancelled = true; };
  }, []);

  const onToggle = async () => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      if (!enabled) {
        const tok = await registerForPush(uid);
        setEnabled(!!tok);
      } else {
        // Can't programmatically revoke iOS permission — surface an
        // alert pointing the user at OS Settings on a real follow-up.
        // For now, just unset the in-app indicator.
        setEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const right = busy ? '…' : enabled === true ? 'On' : 'Off';
  return (
    <Pressable style={settingStyles.row} onPress={onToggle} disabled={busy}>
      <View style={settingStyles.iconWrap}>
        <Icon name="bell" size={18} color={colors.textSecondary} />
      </View>
      <Text style={[typography.body, { flex: 1 }]}>Push notifications</Text>
      <Text style={[settingStyles.value, { color: enabled ? colors.accent : colors.textSecondary }]}>{right}</Text>
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function LegalRow({ icon, label, url }: { icon: IconName; label: string; url: string }) {
  return (
    <Pressable style={settingStyles.row} onPress={() => Linking.openURL(url).catch(() => undefined)}>
      <View style={settingStyles.iconWrap}>
        <Icon name={icon} size={18} color={colors.textSecondary} />
      </View>
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      <Icon name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
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
  deleteAccountBtn: { alignSelf: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  deleteAccountText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
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
