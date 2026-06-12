// CharterDashboard — entry screen for the Charter subscription tier.
// Reads { role, vessel, trips, crew } via useCharterRole and renders
// the role-specific dashboard.
//
// Includes a small dev-only role-switcher in the header so the four
// dashboards can be previewed without re-seeding Firestore. Remove
// or hide-behind-__DEV__ before App Store submission.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useCharterRole } from '@/hooks/useCharterRole';
import { useCharterAccount } from '@/hooks/useCharterAccount';
import { CharterMap } from '@/components/charter/CharterMap';
import type { CharterRole } from '@/types/charter';
import { ROLE_LABEL } from '@/types/charter';

import { OwnerDashboard } from './roles/OwnerDashboard';
import { CaptainDashboard } from './roles/CaptainDashboard';
import { ManagerDashboard } from './roles/ManagerDashboard';
import { CrewDashboard } from './roles/CrewDashboard';

import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ALL_ROLES: CharterRole[] = ['owner', 'captain', 'manager', 'crew'];

export function CharterDashboard() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  // Charter-tier gate — read accountType from /users/{uid}. Mirrors
  // desktop's CHARTER_ROUTES check in router.ts. Non-charter users
  // who somehow land here (deep link, dev nav, etc.) see an upgrade
  // surface instead of the dashboard.
  const { profile, loading: profileLoading } = useUserProfile(user?.id);
  const isCharter = profile?.accountType === 'charter';
  const { role, vessel, crew, trips, setRole } = useCharterRole();
  // Real org data (harbor / vessels / operating spots) for the map —
  // null/empty until the account has an orgId + provisioned doc.
  const { account: charterAccount, spots: charterSpots } = useCharterAccount(profile?.orgId);

  // While the profile snapshot is still loading we render nothing —
  // showing the upgrade screen prematurely would flash for charter
  // users on cold start.
  if (profileLoading) {
    return <Screen contentStyle={{ paddingTop: 0 }} edges={['top', 'left', 'right', 'bottom']}><View /></Screen>;
  }

  if (!isCharter) {
    return (
      <Screen contentStyle={{ paddingTop: 0 }} edges={['top', 'left', 'right', 'bottom']}>
        <Header title="Charter" onBack={() => nav.goBack()} transparent />
        <View style={gateStyles.wrap}>
          <View style={gateStyles.iconWrap}>
            <Icon name="lock" size={28} color={colors.accent} />
          </View>
          <Text style={gateStyles.title}>Charter tier required</Text>
          <Text style={gateStyles.body}>
            The Charter dashboard is part of KaiCast Charter — the subscription tier for
            dive boats and tour operators. Owners, captains, managers, and crew get a
            shared view of vessel scheduling, crew connection state, and per-trip conditions.
          </Text>
          <View style={{ height: spacing.lg }} />
          <Button
            label="Learn more about Charter"
            fullWidth
            onPress={() => nav.goBack()}
          />
          <Pressable onPress={() => nav.goBack()} style={{ marginTop: spacing.lg }}>
            <Text style={gateStyles.dismiss}>Back to KaiCast</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const onSpotTap = (spotId: string) => {
    if (!spotId) return;
    nav.navigate('SpotDetail', { spotId });
  };
  const onLogConditions = (_spotId: string) => {
    nav.navigate('LogDive');
  };

  return (
    <Screen contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }} edges={['top', 'left', 'right', 'bottom']}>
      {/* Dev-only role switcher — collapsed pill bar so it stays out of
          the way but is one tap to swap roles in the sim. */}
      <View style={devStyles.bar}>
        <Text style={devStyles.label}>DEV · ROLE</Text>
        {ALL_ROLES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={[devStyles.chip, role === r && devStyles.chipOn]}
          >
            <Text style={[devStyles.chipText, role === r && devStyles.chipTextOn]}>
              {ROLE_LABEL[r]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Charter map — operating spots + harbor (with docked vessels on
          tap). Pulls the real charter_accounts/{orgId} doc; renders a
          Hawaii overview when no harbor is set yet. */}
      <View style={mapStyles.mapWrap}>
        <CharterMap account={charterAccount} spots={charterSpots} />
      </View>

      {role === 'owner' && (
        <OwnerDashboard vessel={vessel} trips={trips} crew={crew} onSpotTap={onSpotTap} />
      )}
      {role === 'captain' && (
        <CaptainDashboard
          vessel={vessel}
          trips={trips}
          crew={crew}
          onSpotTap={onSpotTap}
          onLogConditions={onLogConditions}
        />
      )}
      {role === 'manager' && (
        <ManagerDashboard vessel={vessel} trips={trips} crew={crew} onSpotTap={onSpotTap} />
      )}
      {role === 'crew' && (
        <CrewDashboard
          vessel={vessel}
          trips={trips}
          viewerUserId={user?.id ?? ''}
          onSpotTap={onSpotTap}
          onLogConditions={onLogConditions}
        />
      )}
    </Screen>
  );
}

const devStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { ...typography.caption, color: colors.textMuted, letterSpacing: 1.2, marginRight: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', letterSpacing: 1 },
  chipTextOn: { color: colors.accent },
});

const mapStyles = StyleSheet.create({
  mapWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});

const gateStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  dismiss: { ...typography.bodySm, color: colors.textMuted, fontWeight: '600' },
});
