// CharterHomeScreen — "the 4am screen". One view, everything for today.
//
// Phase 2 wired up:
//   ✓ Today's-trips query (useTodayTrips, live onSnapshot)
//   ✓ Per-trip go/no-go badge (TripCard reads kaicast_reports)
//   ✓ Hazard strip (moon-phase box-jelly + NWS marine alerts)
//   ✓ Quick actions (link out to /charter/log, /charter/trips)
//
// Still placeholder: DOH brown-water, shark reports, vog index — each
// needs a server-side ingestion before they can plug into HazardStrip
// (see Phase 7 in the task list).

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { AlertsBanner } from './AlertsBanner';
import { HazardStrip } from './HazardStrip';
import { TripCard } from './TripCard';
import { useTodayTrips } from './useTodayTrips';
import { useAuth } from '../hooks/useAuth';
import type { NavigateFn } from '../router';

export function CharterHomeScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { user, orgId } = useAuth();
  const { trips, loading, error } = useTodayTrips(orgId);

  return (
    <CharterShell active="charter-home" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>TODAY · {formatToday()}</Text>
          <Text style={styles.title}>Operations</Text>
          <Text style={styles.subtitle}>
            {orgId
              ? `${trips.length === 0 ? 'No trips' : `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}`} on the board · ${user?.email ?? 'captain'}`
              : `Charter account not provisioned — set users/${user?.uid ?? '???'}.orgId before this view shows real data.`}
          </Text>
        </View>
        <View style={styles.quickActionsRow}>
          <QuickAction label="Trips" onPress={() => onNavigate?.('charter-trips')} />
          <QuickAction label="Captain's Log" onPress={() => onNavigate?.('charter-log')} emphasis />
        </View>
      </View>

      {/* Good Window alerts banner — appears only when a spot just
          crossed back into Good or better. Otherwise renders null. */}
      <AlertsBanner orgId={orgId} onNavigate={onNavigate} />

      {/* Hazard strip — composes moon-phase + NWS marine alerts. */}
      <HazardStrip />

      {/* Today's trips */}
      <View style={styles.tripsSection}>
        <View style={styles.tripsHeader}>
          <Text style={styles.sectionTitle}>Today's trips</Text>
          {error ? (
            <Text style={styles.errorBadge}>Could not load: {error}</Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Reading trips for {formatToday()}…</Text>
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {orgId ? `No trips planned for ${formatToday()}.` : 'No org set on your user doc.'}
            </Text>
            <Text style={styles.emptyBody}>
              {orgId
                ? "Hit Create trip when you're ready to plan one — the Trips screen has the multi-stop route builder and float-plan filing."
                : `Set users/${user?.uid ?? '???'}.accountType = 'charter' and users/${user?.uid ?? '???'}.orgId = <your-org-id> in Firestore, then refresh.`}
            </Text>
            {orgId ? (
              <Pressable style={styles.emptyCta} onPress={() => onNavigate?.('charter-trips')}>
                <Text style={styles.emptyCtaText}>Open Trip Planner →</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.tripsStack}>
            {trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
          </View>
        )}
      </View>
    </CharterShell>
  );
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'Pacific/Honolulu',
  });
}

function QuickAction({ label, onPress, emphasis }: { label: string; onPress?: () => void; emphasis?: boolean }) {
  return (
    <Pressable style={[styles.qaBtn, emphasis && styles.qaBtnEmphasis]} onPress={onPress}>
      <Text style={[styles.qaText, emphasis && styles.qaTextEmphasis]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 700 },

  quickActionsRow: { flexDirection: 'row', gap: 8 },
  qaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  qaBtnEmphasis: { backgroundColor: colors.accent, borderColor: colors.accent },
  qaText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text1 },
  qaTextEmphasis: { color: colors.bg },

  tripsSection: { gap: 14 },
  tripsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  errorBadge: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#F73726',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(247,55,38,0.10)',
  },

  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },
  emptyCard: {
    padding: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 10,
  },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  emptyCta: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.08)',
  },
  emptyCtaText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  tripsStack: { gap: 12 },
});
