import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography, RATING_COLORS, RATING_LABELS } from '@/theme';
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
        <FauxMap />

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
            const rating = s.rating ?? 'good';
            const ratingColor = RATING_COLORS[rating];
            const ratingLabel = RATING_LABELS[rating];
            return (
              <Pressable key={s.id} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} style={styles.row}>
                <View style={[styles.pin, { backgroundColor: s.coverColor ?? colors.cardAlt }]}>
                  <Icon name="pin" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>{s.name}</Text>
                  <Text style={styles.region}>{s.region} · {s.visibilityFt} ft vis</Text>
                </View>
                <View style={[styles.ratingPill, { borderColor: ratingColor }]}>
                  <View style={[styles.ratingPillDot, { backgroundColor: ratingColor }]} />
                  <Text style={[styles.ratingPillText, { color: ratingColor }]}>{ratingLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Screen>
  );
}

function FauxMap() {
  return (
    <View style={mapStyles.wrap}>
      <Svg width="100%" height="100%" viewBox="0 0 400 380">
        {Array.from({ length: 8 }).map((_, i) => (
          <Path
            key={i}
            d={`M 0 ${30 + i * 45} L 400 ${30 + i * 45}`}
            stroke="#0e1a2c"
            strokeDasharray="2,4"
            strokeWidth={1}
          />
        ))}
        <Path d="M 80 230 q 10 -25 35 -20 q 25 5 30 20 q 10 25 -10 25 q -25 5 -55 -25 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Path d="M 175 245 q 15 -20 50 -10 q 35 5 30 25 q -10 20 -50 15 q -40 -5 -30 -30 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Path d="M 235 265 q 25 -10 65 -5 q 40 5 50 25 q 5 25 -45 30 q -50 0 -75 -25 q -10 -15 5 -25 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Circle cx="195" cy="245" r="14" fill={colors.accent} fillOpacity={0.18} />
        <Circle cx="195" cy="245" r="8" fill={colors.accent} />
        <Circle cx="195" cy="245" r="4" fill="#fff" />
      </Svg>
      <Text style={mapStyles.label1}>Tropic of Cancer</Text>
      <Text style={mapStyles.label2}>HAWAIIAN TROUGH</Text>
      <Text style={mapStyles.island1}>Ni'ihau</Text>
      <Text style={mapStyles.island2}>O'ahu</Text>
      <Text style={mapStyles.island3}>Moloka'i</Text>
      <Text style={mapStyles.island4}>Lana'i</Text>
      <Text style={mapStyles.island5}>Maui</Text>
      <Text style={mapStyles.maps}>Maps · Legal</Text>
    </View>
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
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  ratingPillDot: { width: 6, height: 6, borderRadius: 999 },
  ratingPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});

const mapStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label1: { position: 'absolute', top: 90, left: 60, color: colors.textDim, fontSize: 11, letterSpacing: 1 },
  label2: { position: 'absolute', top: 150, left: 110, color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  island1: { position: 'absolute', top: 230, left: 30, color: colors.textSecondary, fontSize: 10 },
  island2: { position: 'absolute', top: 268, left: 175, color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  island3: { position: 'absolute', top: 248, left: 270, color: colors.textSecondary, fontSize: 10 },
  island4: { position: 'absolute', top: 290, left: 270, color: colors.textSecondary, fontSize: 10 },
  island5: { position: 'absolute', top: 280, left: 330, color: colors.textSecondary, fontSize: 10 },
  maps: { position: 'absolute', bottom: 40, left: spacing.lg, color: colors.textDim, fontSize: 10 },
});
