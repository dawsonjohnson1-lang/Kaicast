import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { FeaturedSpotCard } from '@/components/FeaturedSpotCard';
import { SectionTitle } from '@/components/SectionTitle';
import { SpotMiniCard } from '@/components/SpotMiniCard';
import { AlertRow } from '@/components/AlertRow';
import { DiveReportCard } from '@/components/DiveReportCard';
import { Button } from '@/components/Button';
import { spacing } from '@/theme';
import { diveReports, featuredSpot } from '@/api/mockData';
import { useAuth } from '@/hooks/useAuth';
import { useSpots } from '@/hooks/useSpots';
import { useSpotReport } from '@/hooks/useSpotReport';
import { useAlerts } from '@/hooks/useAlerts';
import { useFavorites } from '@/hooks/useFavorites';
import type { DashboardNav } from '@/navigation/types';

export function HomeScreen() {
  const nav = useNavigation<DashboardNav>();
  const { user } = useAuth();
  const { spots } = useSpots();
  const { favorites } = useFavorites(user?.id);
  // Show user's favorites first; fall back to top 4 spots when they
  // haven't favorited anything yet so the carousel never goes empty.
  const userFavorites = spots.filter((s) => favorites.has(s.id));
  const favoriteSpots = userFavorites.length ? userFavorites : spots.slice(0, 4);
  // Featured spot prefers the user's first favorite when they have
  // one — otherwise rotates through the canonical list by week of
  // year so the home hero isn't the same spot every day forever.
  // Falls back to the static mock only while spots[] is still loading.
  const rotatingIdx = (() => {
    if (!spots.length) return 0;
    const week = Math.floor(Date.now() / (7 * 86400000));
    return week % spots.length;
  })();
  const headlineSpot =
    userFavorites[0] ?? spots[rotatingIdx] ?? featuredSpot;
  const { backend: alertReport } = useSpotReport(headlineSpot);
  const conditionAlerts = useAlerts(headlineSpot.name, alertReport);

  const displayName = user?.name ?? 'Dawson';
  const initials = displayName.split(' ').map((s) => s[0]).join('').slice(0, 2);

  return (
    <Screen>
      <AppBar
        userName={displayName.toUpperCase()}
        userLocation="OAHU, HAWAII"
        initials={initials}
        photoUri={user?.photoUrl}
        onAvatarPress={() => nav.navigate('Profile')}
      />

      <FeaturedSpotCard
        spot={headlineSpot}
        onPress={() => nav.navigate('SpotDetail', { spotId: headlineSpot.id })}
      />

      <View style={{ height: spacing.xxl }} />
      <SectionTitle title="Favorite Spots" action="See all" onActionPress={() => nav.navigate('Saved')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {favoriteSpots.map((s) => (
          <SpotMiniCard key={s.id} spot={s} width={172} onPress={() => nav.navigate('SpotDetail', { spotId: s.id })} />
        ))}
      </ScrollView>

      <View style={{ height: spacing.xxl }} />
      <SectionTitle title="Condition Alerts" />
      <View style={{ gap: spacing.md }}>
        {conditionAlerts.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </View>

      <View style={{ height: spacing.xxl }} />
      <SectionTitle title="Friends' Reports" action="See all" />
      <View style={{ gap: spacing.md }}>
        {diveReports.map((r) => (
          <DiveReportCard
            key={r.id}
            report={r}
            onPress={() => nav.navigate('DiveReportDetail', { reportId: r.id })}
          />
        ))}
      </View>

      <View style={{ height: spacing.xxl }} />
      <Button label="Log Your Dive" variant="outline" fullWidth onPress={() => nav.navigate('LogDive')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hRow: { gap: spacing.md, paddingRight: spacing.xl },
});
