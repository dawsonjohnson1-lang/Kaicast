import React from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { DiveReportCard } from '@/components/DiveReportCard';
import { colors, radius, spacing, typography } from '@/theme';
import { diveReports } from '@/api/mockData';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import type { RootStackParamList } from '@/navigation/types';
import type { Spot } from '@/types';

import DirectSunlightSvg from '@/assets/direct-sunlight.svg';
import TideSvg from '@/assets/tide.svg';
import WaveHeightSvg from '@/assets/wave-height.svg';
import WindSvg from '@/assets/wind.svg';

type Props = {
  spot: Spot;
};

const FALLBACK_DESCRIPTION =
  'Spot details coming soon. Conditions, entry points, and marine life will appear here once we publish the spot guide.';

const MAPS_API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '').trim();
const HAS_MAPS_KEY = MAPS_API_KEY.length > 0;

function staticMapUrl(lat: number, lon: number): string {
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lon}` +
    `&zoom=16` +
    `&size=600x300` +
    `&scale=2` +
    `&maptype=satellite` +
    `&key=${MAPS_API_KEY}`
  );
}

function googleMapsDeepLink(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

const IDEAL_CONDITIONS: { Icon: React.FC<any>; title: string; desc: string }[] = [
  {
    Icon: DirectSunlightSvg,
    title: 'Direct Sunlight',
    desc: 'Mornings before haze sets in. Best between 9 AM and noon.',
  },
  {
    Icon: TideSvg,
    title: 'Mid Tide',
    desc: 'Rising mid-tide cleans the inside reef and lifts visibility.',
  },
  {
    Icon: WaveHeightSvg,
    title: 'Small Swell',
    desc: 'Under 3 ft from the SW. North wraps blow out the channel.',
  },
  {
    Icon: WindSvg,
    title: 'Light Trades',
    desc: 'Under 12 mph from the NE. Heavier trades chop the surface.',
  },
];

type StatBarSpec = {
  label: string;
  value: string;
  leftLabel: string;
  rightLabel: string;
  position: number; // 0–1
  fromColor: string;
  toColor: string;
};

const STAT_BARS: StatBarSpec[] = [
  { label: 'ABILITY LEVEL',  value: 'Intermediate–Advanced', leftLabel: 'Beginner', rightLabel: 'Expert',   position: 0.65, fromColor: colors.excellent, toColor: colors.hazard },
  { label: 'CROWD FACTOR',   value: 'Heavy',                 leftLabel: 'Mellow',   rightLabel: 'Crowded',  position: 0.85, fromColor: colors.excellent, toColor: colors.warn },
  { label: 'MARINE LIFE',    value: 'Abundant',              leftLabel: 'Dead',     rightLabel: 'Abundant', position: 0.95, fromColor: colors.warn,      toColor: colors.excellent },
  { label: 'WATER QUALITY',  value: 'Clean',                 leftLabel: 'Clean',    rightLabel: 'Dirty',    position: 0.10, fromColor: colors.excellent, toColor: colors.hazard },
];

export function GuideTab({ spot }: Props) {
  const description = spot.description ?? FALLBACK_DESCRIPTION;
  const photo = useProfilePhoto();

  const openInMaps = async () => {
    const url = googleMapsDeepLink(spot.lat, spot.lon);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Cannot open Maps', url);
    } catch {
      Alert.alert('Cannot open Maps', url);
    }
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <ForecasterCredit photo={photo} />

      <MapPreview spot={spot} photo={photo} onOpenMaps={openInMaps} />

      <View>
        <Text style={typography.caption}>IDEAL DIVE CONDITIONS</Text>
        <View style={{ height: spacing.md }} />
        <View style={styles.conditionsGrid}>
          {IDEAL_CONDITIONS.map((c) => (
            <ConditionCard key={c.title} Icon={c.Icon} title={c.title} desc={c.desc} />
          ))}
        </View>
      </View>

      <View>
        <Text style={typography.h3}>{spot.name} Dive Guide</Text>
        <Text style={styles.guideBody}>{description}</Text>
      </View>

      <View>
        <Text style={typography.caption}>SPOT STATS</Text>
        <View style={{ height: spacing.md }} />
        <View style={styles.statsGrid}>
          {STAT_BARS.map((s) => (
            <StatBar key={s.label} {...s} />
          ))}
        </View>
      </View>

      <View>
        <Text style={typography.h3}>Community Reports</Text>
        <View style={{ height: spacing.md }} />
        <View style={{ gap: spacing.md }}>
          {diveReports.map((r) => (
            <CommunityReportRow key={r.id} reportId={r.id} report={r} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── MapPreview ─────────────────────────────────────────────────────
function MapPreview({
  spot,
  photo,
  onOpenMaps,
}: {
  spot: Spot;
  photo?: any;
  onOpenMaps: () => void;
}) {
  return (
    <Pressable onPress={onOpenMaps} style={mapStyles.card}>
      {HAS_MAPS_KEY ? (
        <Image
          source={{ uri: staticMapUrl(spot.lat, spot.lon) }}
          style={mapStyles.tile}
          resizeMode="cover"
          accessibilityLabel={`Satellite map of ${spot.name}`}
        />
      ) : (
        <View style={[mapStyles.tile, mapStyles.placeholder]}>
          <Text style={mapStyles.placeholderTitle}>Satellite preview unavailable</Text>
          <Text style={mapStyles.placeholderSub}>
            Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in app/.env to enable the tile.
          </Text>
        </View>
      )}
      <View style={mapStyles.playWrap} pointerEvents="none">
        <View style={mapStyles.playCircle}>
          <Icon name="arrow-right" size={20} color={colors.textPrimary} />
        </View>
      </View>
      <View style={mapStyles.viewPillWrap} pointerEvents="none">
        <View style={mapStyles.viewPill}>
          <Text style={mapStyles.viewPillText}>View on Google Maps</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── ForecasterCredit ───────────────────────────────────────────────
function ForecasterCredit({ photo }: { photo?: any }) {
  return (
    <View style={creditStyles.row}>
      <Avatar size={48} ring imageSource={photo} initials="DJ" />
      <View style={creditStyles.id}>
        <Text style={creditStyles.idName}>DAWSON JOHNSON</Text>
        <Text style={creditStyles.idRole}>KAICAST FORECASTER</Text>
      </View>
      <View style={creditStyles.divider} />
      <Text style={creditStyles.tagline}>
        Kaicast forecasters are vetted local professionals to make sure you are getting the best info
      </Text>
    </View>
  );
}

// ─── ConditionCard (2x2 grid item) ──────────────────────────────────
function ConditionCard({ Icon, title, desc }: { Icon: React.FC<any>; title: string; desc: string }) {
  return (
    <View style={conditionStyles.card}>
      <View style={conditionStyles.iconWrap}>
        <Icon width={24} height={24} />
      </View>
      <Text style={conditionStyles.title}>{title}</Text>
      <Text style={conditionStyles.desc} numberOfLines={2}>
        {desc}
      </Text>
    </View>
  );
}

// ─── StatBar (gradient bar with positioned marker) ──────────────────
function StatBar({ label, value, leftLabel, rightLabel, position, fromColor, toColor }: StatBarSpec) {
  return (
    <View style={statStyles.col}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <View style={statStyles.barTrack}>
        <LinearGradient
          colors={[fromColor, toColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[statStyles.marker, { left: `${Math.max(0, Math.min(1, position)) * 100}%` }]} />
      </View>
      <View style={statStyles.endRow}>
        <Text style={statStyles.endLabel}>{leftLabel}</Text>
        <Text style={statStyles.endLabel}>{rightLabel}</Text>
      </View>
    </View>
  );
}

// ─── CommunityReportRow ─────────────────────────────────────────────
// Small wrapper so the report row navigates to the detail screen.
function CommunityReportRow({ reportId, report }: { reportId: string; report: any }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <DiveReportCard report={report} onPress={() => nav.navigate('DiveReportDetail', { reportId })} />;
}

const styles = StyleSheet.create({
  conditionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  guideBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, rowGap: spacing.lg },
});

const mapStyles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
  tile: { width: '100%', aspectRatio: 2, backgroundColor: colors.cardAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  placeholderTitle: { ...typography.h3 },
  placeholderSub: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center' },
  playWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 64, alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPillWrap: { position: 'absolute', left: 0, right: 0, bottom: 16, alignItems: 'center' },
  viewPill: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  viewPillText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '700' },
});

const creditStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  id: { gap: 2 },
  idName: { ...typography.bodySm, fontWeight: '700', letterSpacing: 0.6, color: colors.textPrimary },
  idRole: { fontSize: 9, fontWeight: '700', letterSpacing: 1, color: colors.accent },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: spacing.sm },
  tagline: {
    flex: 1,
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});

const conditionStyles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 120,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.body, fontWeight: '700', marginTop: spacing.xs },
  desc: { ...typography.bodySm, color: colors.textMuted, lineHeight: 16 },
});

const statStyles = StyleSheet.create({
  col: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: 4,
  },
  value: { ...typography.body, fontWeight: '700', marginBottom: spacing.sm },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.bg,
    marginLeft: -6, // center on the position
  },
  endRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  endLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.6 },
});
