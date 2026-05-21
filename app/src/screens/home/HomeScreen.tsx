import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { AppBar } from '@/components/AppBar';
import { FeaturedSpotCard } from '@/components/FeaturedSpotCard';
import { SectionTitle } from '@/components/SectionTitle';
import { SpotMiniCard } from '@/components/SpotMiniCard';
import { AlertRow } from '@/components/AlertRow';
import { DiveReportCard } from '@/components/DiveReportCard';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSpots } from '@/hooks/useSpots';
import { useSpotReport } from '@/hooks/useSpotReport';
import { useAlerts } from '@/hooks/useAlerts';
import { useFavorites } from '@/hooks/useFavorites';
import { useFollowing } from '@/hooks/useFollowing';
import { useFriendsDiveLogs, diveLogToReport } from '@/hooks/useDiveLogs';
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
  const rotatingIdx = (() => {
    if (!spots.length) return 0;
    const week = Math.floor(Date.now() / (7 * 86400000));
    return week % spots.length;
  })();
  const headlineSpot = userFavorites[0] ?? spots[rotatingIdx] ?? null;
  const { backend: alertReport } = useSpotReport(headlineSpot ?? undefined);
  const conditionAlerts = useAlerts(headlineSpot?.name ?? '', alertReport);

  // Friends' feed: only show dive logs whose authors the viewer follows.
  const { following } = useFollowing(user?.id);
  const followedUids = useMemo(() => following.map((e) => e.uid), [following]);
  const { logs: friendLogs } = useFriendsDiveLogs(followedUids, 10);
  const spotsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spots) m.set(s.id, s.name);
    return m;
  }, [spots]);
  const friendsLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of following) m.set(e.uid, e.name);
    return m;
  }, [following]);
  const friendReports = useMemo(
    () => friendLogs.map((l) => diveLogToReport(
      l,
      friendsLookup.get(l.uid) ?? 'Diver',
      spotsById.get(l.spotId) ?? l.spotId,
    )),
    [friendLogs, friendsLookup, spotsById],
  );

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

      {headlineSpot && (
        <FeaturedSpotCard
          spot={headlineSpot}
          onPress={() => nav.navigate('SpotDetail', { spotId: headlineSpot.id })}
        />
      )}

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
      <SectionTitle title="Friends' Reports" />
      {friendReports.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {friendReports.map((r) => (
            <DiveReportCard
              key={r.id}
              report={r}
              onPress={() => nav.navigate('DiveReportDetail', { reportId: r.id })}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyFeed}>
          <Text style={[typography.h3, { textAlign: 'center' }]}>
            {followedUids.length === 0 ? 'Follow other divers' : 'No reports yet'}
          </Text>
          <Text style={[typography.bodySm, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
            {followedUids.length === 0
              ? 'Find divers to follow and their dive reports will show up here.'
              : "When the people you follow log a dive, you'll see it here."}
          </Text>
          {followedUids.length === 0 && (
            <Button
              label="Discover divers"
              variant="outline"
              onPress={() => nav.navigate('Profile')}
              style={{ marginTop: spacing.lg }}
            />
          )}
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
      <Button label="Log Your Dive" variant="outline" fullWidth onPress={() => nav.navigate('LogDive')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hRow: { gap: spacing.md, paddingRight: spacing.xl },
  emptyFeed: {
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
  },
});
