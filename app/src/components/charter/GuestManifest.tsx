// GuestManifest — read-only-ish list of guests on this trip.
//
// Source: FareHarbor bookings denormalized onto the trip. Per-guest
// data isn't populated by the current sync (fh_trips only carries
// booked-count). When the array is empty we render a count-only
// stub so the screen is usable today; full guest sync is a separate
// backend task.
//
// Captain CAN toggle individual guests no-show when manifest is
// present. Cert level is only shown when trip.type === 'scuba'.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Tag } from '@/components/Tag';
import { colors, radius, spacing, typography } from '@/theme';
import type { GuestStatus, TripType } from '@/types/charterLog';

type Props = {
  guests: GuestStatus[];
  tripType: TripType;
  /** Total booked count (used when guests[] is empty). */
  bookedCount: number;
  onGuestsChange: (next: GuestStatus[]) => void;
};

export function GuestManifest({ guests, tripType, bookedCount, onGuestsChange }: Props) {
  const showCert = tripType === 'scuba';

  if (guests.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>
          {bookedCount} {bookedCount === 1 ? 'guest' : 'guests'} booked
        </Text>
        <Text style={styles.emptyBody}>
          Per-guest manifest pending FareHarbor sync. You can still mark the trip
          complete; guest names will appear here once the booking detail sync ships.
        </Text>
      </View>
    );
  }

  const setStatus = (id: string, next: GuestStatus['status']) => {
    onGuestsChange(guests.map((g) => (g.id === id ? { ...g, status: next } : g)));
  };

  return (
    <View style={styles.wrap}>
      {guests.map((g) => (
        <View key={g.id} style={styles.row}>
          <View style={styles.idCol}>
            <Text style={styles.name}>{g.name}</Text>
            {g.phone ? <Text style={styles.phone}>{g.phone}</Text> : null}
            {showCert && g.certLevel ? (
              <Text style={styles.cert}>{g.certLevel}</Text>
            ) : null}
          </View>
          <View style={styles.statusCol}>
            <Tag
              variant={g.waiverSigned ? 'excellent' : 'warn'}
              label={g.waiverSigned ? 'WAIVER ✓' : 'WAIVER MISSING'}
            />
            <View style={styles.statusToggles}>
              <Pressable
                onPress={() => setStatus(g.id, g.status === 'no_show' ? 'checked_in' : 'no_show')}
                style={[
                  styles.statusPill,
                  g.status === 'no_show' && styles.statusPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    g.status === 'no_show' && styles.statusPillTextActive,
                  ]}
                >
                  {g.status === 'no_show' ? 'No-show' : 'Mark no-show'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idCol: { flex: 1, gap: 2 },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  phone: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  cert: {
    ...typography.bodySm,
    color: colors.accent,
    fontSize: 11,
  },
  statusCol: { gap: 6, alignItems: 'flex-end' },
  statusToggles: { flexDirection: 'row', gap: spacing.xs },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillActive: {
    backgroundColor: colors.hazardSoft,
    borderColor: colors.hazard,
  },
  statusPillText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillTextActive: { color: colors.hazard },
  emptyWrap: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
});
