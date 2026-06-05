// LogTripCard — one row on the Daily Log home screen. Shows trip
// number, title, departure time, guest count, type, and a Draft /
// Complete chip. Tap → opens TripLogScreen for that trip.
//
// Named LogTripCard (not TripCard) because the charter dashboard
// already has a TripCard.tsx that wraps the mock Trip type from
// @/types/charter — different shape, different visual hierarchy.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/Card';
import { Tag } from '@/components/Tag';
import { colors, radius, spacing, typography } from '@/theme';
import { TRIP_TYPE_LABEL, type CharterLogTrip } from '@/types/charterLog';

type Props = {
  trip: CharterLogTrip;
  onPress: () => void;
};

export function LogTripCard({ trip, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card style={styles.card} bordered>
        <View style={styles.headerRow}>
          <View style={styles.numBubble}>
            <Text style={styles.numText}>{trip.tripNum}</Text>
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>{trip.title}</Text>
            <Text style={styles.sub}>
              {trip.departureTime || '—:—'}
              {trip.returnTime ? ` → ${trip.returnTime}` : ''}
              {' · '}
              {trip.passengerCount} {trip.passengerCount === 1 ? 'guest' : 'guests'}
            </Text>
          </View>
          <Tag
            variant={trip.complete ? 'excellent' : 'neutral'}
            label={trip.complete ? 'COMPLETE' : 'DRAFT'}
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaText}>{TRIP_TYPE_LABEL[trip.type]}</Text>
          </View>
          {trip.primarySite ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaText} numberOfLines={1}>{trip.primarySite}</Text>
            </View>
          ) : null}
          {trip.incident && trip.incident !== 'None' ? (
            <Tag variant="hazard" label="INCIDENT" />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  numBubble: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    ...typography.bodySm,
    color: colors.accent,
    fontWeight: '700',
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  sub: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 11,
  },
});
