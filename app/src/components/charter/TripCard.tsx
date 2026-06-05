// TripCard — scheduled-trip card. Used by Owner (horizontal scroll),
// Captain (today's trip / upcoming list), and Manager (full list).
//
// The condition score is the hero element — large monospace number,
// colored per the existing RATING_COLORS spectrum so it matches the
// rest of the app.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography, RATING_COLORS } from '@/theme';
import {
  type Trip,
  TRIP_CONDITION_TO_TIER,
  TRIP_CONDITION_LABEL,
} from '@/types/charter';

type Props = {
  trip: Trip;
  onPress?: () => void;
  /** Hero variant — used by Captain's "Today's Trip" card; bigger
   *  condition score, more breathing room. */
  hero?: boolean;
  /** Compact horizontal card variant — used by Owner's "Upcoming Trips"
   *  carousel. Fixed width. */
  compact?: boolean;
};

export function TripCard({ trip, onPress, hero, compact }: Props) {
  const tier = TRIP_CONDITION_TO_TIER[trip.conditionLabel];
  const color = RATING_COLORS[tier];
  const Wrapper: any = onPress ? Pressable : View;

  const scoreFontSize = hero ? 64 : compact ? 36 : 44;

  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.card,
        compact && styles.cardCompact,
        hero && styles.cardHero,
        { borderColor: hexAt(color, 0.30) },
      ]}
    >
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.spot} numberOfLines={1}>{trip.spotName}</Text>
          <Text style={styles.when}>{formatWhen(trip.date)}</Text>
        </View>
        {trip.status !== 'scheduled' ? (
          <View style={[styles.statusPill, { borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{trip.status.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.scoreRow, hero && { backgroundColor: hexAt(color, 0.10), borderRadius: radius.md, padding: spacing.md }]}>
        <Text style={[styles.score, { color, fontSize: scoreFontSize }]}>{trip.conditionScore}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.scoreLabel, { color }]}>
            {TRIP_CONDITION_LABEL[trip.conditionLabel].toUpperCase()}
          </Text>
          <Text style={styles.scoreSub}>CONDITION SCORE · 0-100</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Meta label="Guests" value={String(trip.guestCount)} />
        <View style={styles.metaDivider} />
        <Meta label="Crew" value={String(trip.crewIds.length)} />
        {trip.notes ? (
          <>
            <View style={styles.metaDivider} />
            <Text style={styles.notes} numberOfLines={1}>{trip.notes}</Text>
          </>
        ) : null}
      </View>
    </Wrapper>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function hexAt(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatWhen(d: Date): string {
  const dt = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const tm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${dt.toUpperCase()} · ${tm}`;
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  cardCompact: { width: 260, padding: spacing.md, gap: spacing.sm },
  cardHero: { padding: spacing.xl, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  spot: { ...typography.h3, color: colors.textPrimary },
  when: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  score: { fontFamily: 'JetBrainsMono-Bold', fontWeight: '800', lineHeight: 64 },
  scoreLabel: { ...typography.caption, fontWeight: '800', letterSpacing: 1.4 },
  scoreSub: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaDivider: { width: 1, height: 24, backgroundColor: colors.border },
  metaValue: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  metaLabel: { ...typography.caption, color: colors.textMuted, letterSpacing: 1 },
  notes: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusText: { ...typography.caption, fontWeight: '800', letterSpacing: 1.2 },
});
