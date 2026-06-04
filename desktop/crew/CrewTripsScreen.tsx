// CrewTripsScreen — My Trips for the active org.
//
// D2 scope: list view. Each card carries date, departure time, the
// trip type, the crew member's role on this trip (always the same as
// their org-wide role for now — per-trip role overrides are out of
// scope), and a "View brief" link. Trip detail (read-only spots,
// route, conditions, hazards, manifest, float plan) lands in D3
// alongside the Captain's Log filer + "Log my dive" handoff.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useAuth } from '../hooks/useAuth';
import { CrewShell } from './CrewShell';
import { useActiveMembership } from './useActiveMembership';
import { useCrewTrips } from './useCrewTrips';
import type { Trip, TripStatus, TripType } from '../charter/types';
import type { NavigateFn } from '../router';

type StatusFilter = 'upcoming' | 'completed' | 'all';

const TYPE_LABEL: Record<TripType, string> = {
  dive: 'Dive',
  snorkel: 'Snorkel',
  spearfishing: 'Spearfishing',
  freedive: 'Freedive',
};

export function CrewTripsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const auth = useAuth();
  const { membership } = useActiveMembership();
  const { trips, loading, error, noCrewRecord } = useCrewTrips(membership?.orgId);
  const [filter, setFilter] = React.useState<StatusFilter>('upcoming');

  const filtered = React.useMemo(() => {
    if (filter === 'all') return trips;
    if (filter === 'completed') {
      return trips.filter((t) => t.status === 'completed' || t.status === 'cancelled');
    }
    // 'upcoming' = planned + active
    return trips.filter((t) => t.status === 'planned' || t.status === 'active');
  }, [trips, filter]);

  return (
    <CrewShell active="crew-trips" onNavigate={onNavigate}>
      <View style={styles.header}>
        <Text style={styles.title}>My trips</Text>
        <Text style={styles.subtitle}>
          Trips you're assigned to at {membership?.orgName ?? 'this org'}. Filter by status; tap a trip for the brief.
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(['upcoming', 'completed', 'all'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'upcoming' ? 'Upcoming' : f === 'completed' ? 'Completed' : 'All'}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.countMeta}>
          {loading ? '' : `${filtered.length} of ${trips.length}`}
        </Text>
      </View>

      {!auth.user ? null : loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Reading trips…</Text>
        </View>
      ) : error ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not load trips</Text>
          <Text style={styles.errBody}>{error}</Text>
        </View>
      ) : noCrewRecord ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>You're not on the crew roster yet</Text>
          <Text style={styles.emptyBody}>
            Trip assignments are tied to your crew record. Once the admin adds you to the roster (or your invite-accept auto-creates the record), your assigned trips show up here.
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {trips.length === 0
              ? 'No trip assignments yet'
              : filter === 'upcoming'
                ? 'Nothing upcoming'
                : 'No completed trips in this filter'}
          </Text>
          <Text style={styles.emptyBody}>
            {trips.length === 0
              ? 'The admin assigns crew to trips when planning. Once you\'re on one, the brief lands here.'
              : 'Try the other filter.'}
          </Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {filtered.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              roleLabel={membership ? roleLabelFor(membership.role) : null}
              onView={() => onNavigate?.('crew-brief', { tripId: t.id })}
            />
          ))}
        </View>
      )}
    </CrewShell>
  );
}

function TripCard({
  trip,
  roleLabel,
  onView,
}: {
  trip: Trip;
  roleLabel: string | null;
  onView: () => void;
}) {
  const dateLabel = trip.date instanceof Date && !Number.isNaN(trip.date.getTime())
    ? trip.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : '—';
  const tripTypeLabel = TYPE_LABEL[trip.tripType];
  const statusLabel = STATUS_LABEL[trip.status];
  const statusColor = STATUS_COLOR[trip.status];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardDate}>{dateLabel}</Text>
          <Text style={styles.cardTimes}>
            {trip.departureTime || '—:—'}{trip.returnTime ? ` → ${trip.returnTime}` : ''}
          </Text>
        </View>
        <View style={[styles.statusChip, { borderColor: statusColor }]}>
          <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Meta label="Type" value={tripTypeLabel} />
        <Meta label="Headcount" value={String(trip.headcount || '—')} />
        {roleLabel ? <Meta label="My role" value={roleLabel} /> : null}
        <Meta
          label="Float plan"
          value={trip.floatPlanFiled ? 'Filed' : 'Not filed'}
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.spotsText} numberOfLines={1}>
          {trip.spots.length === 0
            ? 'No spots set'
            : `${trip.spots.length} stop${trip.spots.length === 1 ? '' : 's'} — ${trip.spots.join(', ')}`}
        </Text>
        <Pressable style={styles.viewBtn} onPress={onView}>
          <Text style={styles.viewBtnText}>View brief →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function roleLabelFor(role: import('../hooks/useAuth').OrgRole): string {
  if (role === 'captain')    return 'Captain';
  if (role === 'divemaster') return 'Divemaster';
  if (role === 'instructor') return 'Instructor';
  if (role === 'manager')    return 'Manager';
  return 'Deckhand';
}

const STATUS_LABEL: Record<TripStatus, string> = {
  planned:   'Planned',
  active:    'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<TripStatus, string> = {
  planned:   '#09A1FB',
  active:    '#3DDC84',
  completed: '#A6A6A6',
  cancelled: '#F73726',
};

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    maxWidth: 600,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  filterBtnActive: { backgroundColor: colors.surface1, borderColor: colors.accent },
  filterText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text3 },
  filterTextActive: { color: colors.text1 },
  countMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginLeft: 'auto' },

  loadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18,
    borderRadius: radius.md, backgroundColor: colors.surface0,
    borderWidth: 1, borderColor: colors.hairline,
  },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },

  errCard: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: 'rgba(247,55,38,0.10)',
    borderWidth: 1,
    borderColor: '#F73726',
  },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },

  emptyCard: {
    padding: 24,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
    maxWidth: 640,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 20,
  },

  stack: { gap: 12 },
  card: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardDate: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  cardTimes: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    fontWeight: '600',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  spotsText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.08)',
  },
  viewBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
});
