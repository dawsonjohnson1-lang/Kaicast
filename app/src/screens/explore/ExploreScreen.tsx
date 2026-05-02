import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { Icon } from '@/components/Icon';
import { Tag } from '@/components/Tag';
import { SpotMap } from '@/components/Map';
import { colors, radius, spacing, typography } from '@/theme';
import { exploreSpots } from '@/api/mockData';
import { useAuth } from '@/hooks/useAuth';
import type { RootNav } from '@/navigation/types';

type Filter = 'Dive Spots' | 'Favorite Spots';
const FILTERS: Filter[] = ['Dive Spots', 'Favorite Spots'];

export function ExploreScreen() {
  const nav = useNavigation<RootNav>();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('Dive Spots');
  const initials = (user?.name ?? 'D').split(' ').map((s) => s[0]).join('').slice(0, 2);

  return (
    <Screen scroll={false} padding={0}>
      <View style={styles.mapWrap}>
        <LinearGradient
          colors={['#04111e', '#062138', '#04111e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.appBarPad}>
          <AppBar userName={(user?.name ?? 'Diver').toUpperCase()} initials={initials} />
        </View>
        <SpotMap
          spots={exploreSpots}
          onSpotPress={(spot) => nav.navigate('SpotDetail', { spotId: spot.id })}
        />

        <View style={styles.fabs}>
          <Pressable style={styles.fab}><Icon name="search" size={18} color={colors.textPrimary} /></Pressable>
          <Pressable style={styles.fab}><Icon name="send" size={18} color={colors.textPrimary} /></Pressable>
          <Pressable style={styles.fab}><Icon name="globe" size={18} color={colors.textPrimary} /></Pressable>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterPill, filter === f && styles.filterPillActive]}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <Text style={styles.helper}>Move map to find dive spots, buoys, and conditions near you.</Text>
          {exploreSpots.map((s) => {
            const ratingTag = s.rating === 'excellent' ? 'excellent' : s.rating === 'good' ? 'good' : s.rating === 'caution' ? 'warn' : 'hazard';
            return (
              <Pressable key={s.id} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} style={styles.row}>
                <View style={[styles.pin, { backgroundColor: s.coverColor ?? colors.cardAlt }]}>
                  <Icon name="pin" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{s.name}</Text>
                  <Text style={styles.region}>{s.region} · {s.visibilityFt} ft vis</Text>
                </View>
                <Tag variant={ratingTag} dot />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapWrap: { height: '60%', overflow: 'hidden' },
  appBarPad: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  fabs: { position: 'absolute', right: spacing.xl, bottom: spacing.xl, gap: spacing.sm },
  fab: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: colors.cardAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xl,
  },
  handle: { alignSelf: 'center', width: 48, height: 4, borderRadius: 999, backgroundColor: colors.border, marginBottom: spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  filterPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'transparent' },
  filterPillActive: { backgroundColor: colors.accentSoft },
  filterText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.accent },
  helper: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pin: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  region: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});
