import React, { useMemo } from 'react';
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
import {
  conditionAlerts as mockAlerts,
  diveReports as mockDiveReports,
  favoriteSpots as mockFavoriteSpots,
  featuredSpot as mockFeaturedSpot,
} from '@/api/mockData';
import { useAuth } from '@/hooks/useAuth';
import { useBestConditions } from '@/hooks/useBestConditions';
import { useAllReports } from '@/hooks/useAllReports';
import { useAlerts } from '@/hooks/useAlerts';
import { useCommunityReports } from '@/hooks/useCommunityReports';
import {
  cToF,
  ktsToMph,
  ratingToCondition,
  currentLabel,
  relativeTime,
} from '@/utils/transforms';
import type { ConditionAlert, DiveReport, Spot } from '@/types';
import type { DashboardNav } from '@/navigation/types';

export function HomeScreen() {
  const nav = useNavigation<DashboardNav>();
  const { user } = useAuth();

  const { best } = useBestConditions();
  const { reports: liveReports } = useAllReports();
  const { alerts: liveAlerts } = useAlerts(null);
  const { reports: liveCommunity } = useCommunityReports(null);

  const displayName = user?.name ?? 'Dawson';
  const initials = displayName.split(' ').map((s) => s[0]).join('').slice(0, 2);

  // Featured / hero — live `meta/best_conditions` first, then mock fallback.
  const featured = useMemo(() => {
    const top = best?.top?.[0];
    if (!top) return mockFeaturedSpot;
    return {
      id: top.spot,
      name: top.spotName,
      region: 'Oahu',
      lat: top.spotLat,
      lon: top.spotLon,
      rating: ratingToCondition(top.rating),
      ratingLabel: top.rating ?? 'EXCELLENT',
      visibilityFt: top.visibilityFeet ?? 0,
      windMph: top.windKts == null ? 0 : ktsToMph(top.windKts),
      airTempF: top.airTempC == null ? 0 : cToF(top.airTempC),
      current: currentLabel(top.windKts ?? 0),
      progress: Math.min(1, Math.max(0, (top.score ?? 50) / 100)),
    } satisfies Spot & {
      airTempF: number;
      windMph: number;
      current: string;
      progress: number;
      ratingLabel: string;
    };
  }, [best]);

  // Favorite spots strip — live reports sorted by score, mock fallback.
  const favoriteSpots: Spot[] = useMemo(() => {
    if (!liveReports.length) return mockFavoriteSpots;
    return liveReports
      .slice()
      .sort((a, b) => (b.now?.rating?.score ?? 0) - (a.now?.rating?.score ?? 0))
      .slice(0, 6)
      .map((r) => ({
        id: r.spot,
        name: r.spotName,
        region: 'Oahu',
        lat: r.spotLat,
        lon: r.spotLon,
        rating: ratingToCondition(r.now?.rating?.rating),
        visibilityFt: r.now?.visibility?.estimatedVisibilityFeet ?? 0,
      }));
  }, [liveReports]);

  // Condition alerts — live, mock fallback.
  const alerts: ConditionAlert[] = useMemo(() => {
    if (!liveAlerts.length) return mockAlerts;
    return liveAlerts.map((a) => ({
      id: a.id ?? `${a.spotId}_${a.generatedAt}`,
      spotName: a.spotName,
      message: a.message,
      severity: a.severity,
    }));
  }, [liveAlerts]);

  // Friends' reports — live community reports, mock fallback.
  const communityCards: DiveReport[] = useMemo(() => {
    if (!liveCommunity.length) return mockDiveReports;
    return liveCommunity.slice(0, 5).map((c) => ({
      id: c.id ?? `${c.userId}_${c.loggedAt}`,
      authorInitials: (c.displayName || '??').split(' ').map((s) => s[0]).join('').slice(0, 2),
      authorName: c.displayName,
      spotName: c.spotName,
      postedAgo: relativeTime(c.loggedAt),
      diveType: c.diveType,
      depthFt: c.reportedVisibilityFt ?? c.depthFt ?? 0,
      current: (c.reportedCurrent ?? 'NONE') as DiveReport['current'],
      surface: (c.reportedEntryCondition ?? 'SAFE') as DiveReport['surface'],
      visibility: (c.waterQuality ?? 'CLEAN') as DiveReport['visibility'],
      comment: c.notes ?? '',
      likes: c.likesCount ?? 0,
      replies: c.commentsCount ?? 0,
    }));
  }, [liveCommunity]);

  return (
    <Screen>
      <AppBar
        userName={displayName.toUpperCase()}
        userLocation="OAHU, HAWAII"
        initials={initials}
        photoUri={user?.photoUrl}
        photoSource={require('../../../assets/dawson.png')}
        onAvatarPress={() => nav.navigate('Profile')}
      />

      <FeaturedSpotCard
        spot={featured}
        onPress={() => nav.navigate('SpotDetail', { spotId: featured.id })}
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
        {alerts.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </View>

      <View style={{ height: spacing.xxl }} />
      <SectionTitle title="Friends' Reports" action="See all" />
      <View style={{ gap: spacing.md }}>
        {communityCards.map((r) => (
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
