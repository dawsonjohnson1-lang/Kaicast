import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { SpotMiniCard } from '@/components/SpotMiniCard';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSpots } from '@/hooks/useSpots';
import { useFavorites } from '@/hooks/useFavorites';
import type { DashboardNav } from '@/navigation/types';

export function SavedSpotsScreen() {
  const nav = useNavigation<DashboardNav>();
  const { user } = useAuth();
  const { spots } = useSpots();
  const { favorites } = useFavorites(user?.id);
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);

  // Filter the canonical spots list to just the ones this user has
  // favorited via the heart icon on Spot Detail.
  const saved = useMemo(
    () => spots.filter((s) => favorites.has(s.id)),
    [spots, favorites],
  );

  return (
    <Screen>
      <AppBar
        userName={(user?.name ?? 'Diver').toUpperCase()}
        initials={initials}
        onAvatarPress={() => nav.navigate('Profile')}
      />
      <Text style={typography.h1}>Saved Spots</Text>
      <Text style={styles.sub}>
        {saved.length === 0
          ? 'No spots saved yet'
          : `${saved.length} spot${saved.length === 1 ? '' : 's'} in your dive bag`}
      </Text>

      {saved.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Icon name="heart" size={28} color={colors.accent} />
          </View>
          <Text style={[typography.h3, { textAlign: 'center', marginTop: spacing.md }]}>
            Build your dive bag
          </Text>
          <Text style={styles.emptyText}>
            Tap the heart icon on any spot to save it here. You'll see live conditions for everything in your bag at a glance.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {saved.map((s) => (
            <View key={s.id} style={{ width: '48%' }}>
              <SpotMiniCard spot={s} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.body, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
});
