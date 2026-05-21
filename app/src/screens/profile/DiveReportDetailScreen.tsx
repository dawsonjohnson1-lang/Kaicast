import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Avatar } from '@/components/Avatar';
import { Tag } from '@/components/Tag';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { db, firebaseConfigured } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useFollowing } from '@/hooks/useFollowing';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSpots } from '@/hooks/useSpots';
import { deleteDiveLog as deleteDiveLogApi } from '@/api/diveLogs';
import type { RootNav, RootStackParamList } from '@/navigation/types';

type DiveReportRoute = RouteProp<RootStackParamList, 'DiveReportDetail'>;

type LoadedLog = {
  id: string;
  uid: string;
  spotId: string;
  customSpotName?: string;
  loggedAt: Date | null;
  diveType?: string;
  depthFt?: number | null;
  durationMin?: number | null;
  visibilityFt?: number | null;
  rating?: number | null;
  surface?: string | null;
  current?: string | null;
  visibility?: string | null;
  waterTempF?: number | null;
  notes?: string;
  conditionsSnapshot?: Record<string, unknown> | null;
};

export function DiveReportDetailScreen() {
  const nav = useNavigation<RootNav>();
  const route = useRoute<DiveReportRoute>();
  const reportId = route.params?.reportId;
  const { user } = useAuth();

  const [log, setLog] = useState<LoadedLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId || !firebaseConfigured || !db) {
      setLog(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'diveLogs', reportId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError('This dive report is no longer available.');
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const ts = data.loggedAt as { toDate?: () => Date } | undefined;
        setLog({
          id: snap.id,
          uid: String(data.uid ?? ''),
          spotId: String(data.spotId ?? ''),
          customSpotName: (data.customSpot as { name?: string } | undefined)?.name,
          loggedAt: ts?.toDate?.() ?? null,
          diveType: data.diveType as string | undefined,
          depthFt: (data.depthFt as number | null) ?? null,
          durationMin: (data.durationMin as number | null) ?? null,
          visibilityFt: (data.visibilityFt as number | null) ?? null,
          rating: (data.rating as number | null) ?? null,
          surface: (data.surface as string | null) ?? null,
          current: (data.current as string | null) ?? null,
          visibility: (data.visibility as string | null) ?? null,
          waterTempF: (data.waterTempF as number | null) ?? null,
          notes: (data.notes as string | undefined) ?? '',
          conditionsSnapshot: (data.conditionsSnapshot as Record<string, unknown>) ?? null,
        });
      } catch (err) {
        if (!cancelled) setError((err as Error).message || 'Could not load report.');
      }
    })();
    return () => { cancelled = true; };
  }, [reportId]);

  const { spots } = useSpots();
  const spotName = useMemo(() => {
    if (!log) return '';
    if (log.customSpotName) return log.customSpotName;
    return spots.find((s) => s.id === log.spotId)?.name ?? log.spotId;
  }, [log, spots]);
  const spotRegion = useMemo(() => {
    if (!log) return '';
    return spots.find((s) => s.id === log.spotId)?.region ?? '';
  }, [log, spots]);

  const { profile: authorProfile } = useUserProfile(log?.uid);
  const { isFollowing, follow, unfollow, following: myFollowing } = useFollowing(user?.id);
  const isOwn = !!user?.id && !!log && user.id === log.uid;
  const followingAuthor = log ? isFollowing(log.uid) : false;
  const [followBusy, setFollowBusy] = useState(false);

  const onFollow = async () => {
    if (!user || !log || isOwn) return;
    setFollowBusy(true);
    try {
      if (followingAuthor) {
        await unfollow(user.id, log.uid);
      } else {
        await follow(
          { uid: user.id, name: user.name ?? 'Diver', handle: user.handle ?? '', photoUrl: user.photoUrl ?? null, homeSpot: null },
          {
            uid: log.uid,
            name: authorProfile?.name ?? 'Diver',
            handle: authorProfile?.handle ?? '',
            photoUrl: authorProfile?.photoUrl ?? null,
            homeSpot: null,
          },
        );
      }
    } catch (err) {
      Alert.alert('Couldn’t update follow status', (err as Error).message || 'Try again later.');
    } finally {
      setFollowBusy(false);
    }
  };

  const onShare = async () => {
    if (!log) return;
    const titlePart = spotName ? `${spotName} dive report` : 'KaiCast dive report';
    const url = `https://kaicast.app/r/${log.id}`;
    try {
      await Share.share({
        message: `${titlePart} on KaiCast: ${url}`,
        url,
        title: titlePart,
      });
    } catch {
      // user cancelled — silent
    }
  };

  const onMore = () => {
    if (!log) return;
    const options = isOwn
      ? ['Delete report', 'Cancel']
      : ['Report content', followingAuthor ? 'Unfollow diver' : 'Follow diver', 'Cancel'];
    const destructiveIndex = isOwn ? 0 : 0;
    const cancelIndex = options.length - 1;

    const handle = (idx: number) => {
      if (idx === cancelIndex) return;
      if (isOwn) {
        if (idx === 0) confirmDelete();
        return;
      }
      if (idx === 0) {
        Alert.alert(
          'Report content',
          'This report will be flagged for review. Thanks for keeping the community safe.',
          [{ text: 'OK' }],
        );
      } else if (idx === 1) {
        onFollow();
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        handle,
      );
    } else {
      Alert.alert('Options', undefined, options.map((opt, i) => ({
        text: opt,
        style: i === cancelIndex ? 'cancel' : i === destructiveIndex && isOwn ? 'destructive' : 'default',
        onPress: () => handle(i),
      })));
    }
  };

  const confirmDelete = () => {
    if (!log) return;
    Alert.alert(
      'Delete this report?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDiveLogApi(log.id);
              nav.goBack();
            } catch (err) {
              Alert.alert("Couldn't delete report", (err as Error).message || 'Try again later.');
            }
          },
        },
      ],
    );
  };

  if (error) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} transparent />
        <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
          <Text style={typography.h2}>Report unavailable</Text>
          <Text style={[typography.bodySm, { color: colors.textSecondary, marginTop: spacing.sm }]}>{error}</Text>
        </View>
      </Screen>
    );
  }

  if (!log) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} transparent />
        <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const dateLabel = log.loggedAt
    ? log.loggedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const timeLabel = log.loggedAt
    ? log.loggedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const heroSub = [spotRegion, dateLabel, timeLabel].filter(Boolean).join(' · ');

  const authorName = authorProfile?.name ?? 'Diver';
  const authorHandle = authorProfile?.handle ?? '';
  const initials = authorName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || 'KC';

  const followLabel = followBusy ? '…' : followingAuthor ? 'Following' : 'Follow';
  const diveTypeLabel = (log.diveType ?? 'freedive').toString();

  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header
        onBack={() => nav.goBack()}
        rightSlot={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={onMore} style={detailStyles.iconBtn}>
              <Icon name="menu" size={18} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={onShare} style={detailStyles.iconBtn}>
              <Icon name="share" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        }
        transparent
      />
      <View style={styles.hero}>
        <LinearGradient colors={['#06334a', '#04111e']} style={StyleSheet.absoluteFill} />
        <Tag variant={diveTypeLabel === 'spearfishing' ? 'spear' : 'freedive'} />
        <Text style={[typography.display, { fontSize: 36, marginTop: spacing.md }]}>{spotName}</Text>
        <View style={{ marginTop: spacing.sm }}>
          <Text style={styles.heroSub}>{heroSub}</Text>
        </View>
      </View>

      <View style={{ height: spacing.xl }} />

      <View style={styles.row}>
        <Avatar initials={initials} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{authorName}</Text>
          {authorHandle ? <Text style={styles.handle}>@{authorHandle}</Text> : null}
        </View>
        {!isOwn && (
          <Button
            label={followLabel}
            size="sm"
            variant={followingAuthor ? 'secondary' : 'outline'}
            onPress={onFollow}
            disabled={followBusy || !user}
          />
        )}
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.statsRow}>
          <Stat value={log.depthFt != null ? String(log.depthFt) : '—'} unit="ft" label="DEPTH" />
          <Stat value={log.durationMin != null ? String(log.durationMin) : '—'} unit="min" label="TIME" />
          <Stat value={log.visibilityFt != null ? String(log.visibilityFt) : '—'} unit="ft" label="VISIBILITY" />
          <Stat value={log.rating != null ? `${log.rating}` : '—'} unit="/5" label="RATING" />
        </View>
      </Card>

      <Section title="CONDITIONS">
        <Grid2
          left={{ label: 'SURFACE', value: friendly(log.surface, 'Unknown') }}
          right={{ label: 'CURRENT', value: friendly(log.current, 'Unknown') }}
        />
        <Grid2
          left={{ label: 'VISIBILITY', value: friendly(log.visibility, 'Unknown') }}
          right={{ label: 'WATER TEMP', value: log.waterTempF != null ? `${log.waterTempF}°F` : '—' }}
        />
      </Section>

      {!!log.notes && (
        <Section title="NOTES">
          <Text style={[typography.body, { color: colors.textPrimary, lineHeight: 22 }]}>{log.notes}</Text>
        </Section>
      )}

      {isOwn && (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <Button
            label="Edit report"
            variant="secondary"
            iconLeft="edit"
            style={{ flex: 1 }}
            onPress={() => Alert.alert('Coming soon', 'Editing reports is coming in the next update.')}
          />
          <Button
            label="Delete"
            variant="danger"
            iconLeft="trash"
            style={{ flex: 1 }}
            onPress={confirmDelete}
          />
        </View>
      )}

      {/* Suppress unused-var warning on myFollowing — placeholder until
          a "mutuals" badge is added next to the author. */}
      {myFollowing.length === -1 ? <Text /> : null}
    </Screen>
  );
}

function friendly(v: string | null | undefined, fallback: string): string {
  if (!v) return fallback;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={statStyles.stat}>
      <Text style={typography.h2}>{value}<Text style={statStyles.unit}> {unit}</Text></Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{title}</Text>
      <Card style={{ marginTop: spacing.sm }}>{children}</Card>
    </View>
  );
}

function Grid2({
  left,
  right,
}: {
  left: { label: string; value: string; sub?: string };
  right: { label: string; value: string; sub?: string };
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={typography.caption}>{left.label}</Text>
        <Text style={[typography.h3, { marginTop: 4 }]}>{left.value}</Text>
        {left.sub && <Text style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: 2 }}>{left.sub}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.caption}>{right.label}</Text>
        <Text style={[typography.h3, { marginTop: 4 }]}>{right.value}</Text>
        {right.sub && <Text style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: 2 }}>{right.sub}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderRadius: radius.lg, overflow: 'hidden', minHeight: 130 },
  heroSub: { ...typography.bodySm, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  handle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

const detailStyles = StyleSheet.create({
  iconBtn: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
});

const statStyles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center' },
  unit: { ...typography.bodySm, color: colors.textSecondary, fontSize: 14 },
});
