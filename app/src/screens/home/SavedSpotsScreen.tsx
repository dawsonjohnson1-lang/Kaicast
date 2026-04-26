import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { SpotMiniCard } from '@/components/SpotMiniCard';
import { colors, spacing, typography } from '@/theme';
import { favoriteSpots } from '@/api/mockData';
import { useAuth } from '@/hooks/useAuth';
import type { DashboardNav } from '@/navigation/types';

export function SavedSpotsScreen() {
  const nav = useNavigation<DashboardNav>();
  const { user } = useAuth();
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);

  return (
    <Screen>
      <AppBar userName={(user?.name ?? 'Diver').toUpperCase()} initials={initials} onAvatarPress={() => nav.navigate('Profile')} />
      <Text style={typography.h1}>Saved Spots</Text>
      <Text style={styles.sub}>{favoriteSpots.length} spots in your dive bag</Text>

      <View style={styles.grid}>
        {favoriteSpots.map((s) => (
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
