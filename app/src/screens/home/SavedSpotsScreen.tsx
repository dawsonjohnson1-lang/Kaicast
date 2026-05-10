import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { SpotMiniCard } from '@/components/SpotMiniCard';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSpots } from '@/hooks/useSpots';
import type { DashboardNav } from '@/navigation/types';

export function SavedSpotsScreen() {
  const nav = useNavigation<DashboardNav>();
  const { user } = useAuth();
  const { spots } = useSpots();
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);

  // For now, treat the spots collection as the user's "saved" set —
  // we don't yet have a per-user favorites list. Once that lands,
  // swap this for a user-scoped query.
  const saved = spots;

  return (
    <Screen>
      <AppBar userName={(user?.name ?? 'Diver').toUpperCase()} initials={initials} onAvatarPress={() => nav.navigate('Profile')} />
      <Text style={typography.h1}>Saved Spots</Text>
      <Text style={styles.sub}>{saved.length} spots in your dive bag</Text>

      <View style={styles.grid}>
        {saved.map((s) => (
          <View key={s.id} style={{ width: '48%' }}>
            <SpotMiniCard spot={s} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.body, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
});
