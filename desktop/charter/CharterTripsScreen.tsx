// CharterTripsScreen — Phase 3: real trip list + Spot Readiness
// Calendar toggle + Create-Trip wizard.
//
// Trip list pulls from useAllTrips with a Firestore status filter and
// renders each via TripCard (same component as the home screen). The
// Calendar toggle swaps the body to ReadinessCalendar — a 14-day
// grid of every spot in the org's library, color-coded by forecast.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { TripCard } from './TripCard';
import { CreateTripWizard } from './CreateTripWizard';
import { ReadinessCalendar } from './ReadinessCalendar';
import { useAllTrips, useCharterSpots } from './useCharterData';
import { useAuth } from '../hooks/useAuth';
import { db, firebaseConfigured } from '../firebase';
import type { CharterAccount, TripStatus } from './types';
import type { NavigateFn } from '../router';

const STATUS_FILTERS: TripStatus[] = ['planned', 'active', 'completed', 'cancelled'];

export function CharterTripsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { orgId } = useAuth();
  const [status, setStatus] = React.useState<TripStatus>('planned');
  const [view, setView] = React.useState<'list' | 'calendar'>('list');
  const [showWizard, setShowWizard] = React.useState(false);

  // Org doc — needed by the wizard to default the home harbor.
  const org = useCharterAccount(orgId);

  const { trips, loading, error } = useAllTrips(orgId, status);
  const { spots: orgSpots } = useCharterSpots(orgId);

  return (
    <CharterShell active="charter-trips" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trips</Text>
          <Text style={styles.subtitle}>Plan, file float plans, archive completed trips.</Text>
        </View>
        <Pressable
          onPress={() => orgId && setShowWizard(true)}
          disabled={!orgId}
          style={[styles.createBtn, !orgId && styles.createBtnDisabled]}
        >
          <Text style={[styles.createBtnText, !orgId && styles.createBtnTextDisabled]}>+ Create trip</Text>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.viewToggle}>
          {(['list', 'calendar'] as const).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.viewBtn, view === v && styles.viewBtnActive]}>
              <Text style={[styles.viewText, view === v && styles.viewTextActive]}>{v === 'list' ? 'Trip list' : 'Readiness calendar'}</Text>
            </Pressable>
          ))}
        </View>
        {view === 'list' ? (
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((f) => {
              const active = status === f;
              return (
                <Pressable key={f} onPress={() => setStatus(f)} style={[styles.filterChip, active && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {view === 'list' ? (
        loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Reading trips…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not load trips</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No {status} trips on file.</Text>
            <Text style={styles.emptyBody}>
              {orgId
                ? status === 'planned'
                  ? "Hit Create trip when you're ready to plan one — the wizard walks through basics, route, crew, manifest, and float plan."
                  : `Trips in this state will land here once they exist.`
                : 'Charter org not set on your user doc. See the home screen.'}
            </Text>
          </View>
        ) : (
          <View style={styles.tripsStack}>
            {trips.map((t) => <TripCard key={t.id} trip={t} />)}
          </View>
        )
      ) : (
        <ReadinessCalendar spots={orgSpots} />
      )}

      {showWizard && orgId ? (
        <CreateTripWizard
          orgId={orgId}
          org={org}
          onClose={() => setShowWizard(false)}
        />
      ) : null}
    </CharterShell>
  );
}

// ─── Live org-account read ────────────────────────────────────────────

function useCharterAccount(orgId: string | null | undefined): CharterAccount | null {
  const [acct, setAcct] = React.useState<CharterAccount | null>(null);
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) { setAcct(null); return; }
    const unsub = onSnapshot(
      doc(db, 'charter_accounts', orgId),
      (snap) => {
        if (!snap.exists()) { setAcct(null); return; }
        const data = snap.data() as Record<string, unknown>;
        const createdRaw = data.createdAt as { toDate?: () => Date } | undefined;
        setAcct({
          orgId,
          name: String(data.name ?? '—'),
          homeHarbor: (data.homeHarbor as CharterAccount['homeHarbor']) ?? { name: '', lat: 0, lng: 0 },
          tripTypes: Array.isArray(data.tripTypes) ? (data.tripTypes as CharterAccount['tripTypes']) : [],
          createdAt: createdRaw?.toDate?.() ?? null,
        });
      },
      () => setAcct(null),
    );
    return unsub;
  }, [orgId]);
  return acct;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4 },
  createBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  createBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  createBtnDisabled: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  createBtnTextDisabled: { color: colors.text4 },

  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  viewToggle: { flexDirection: 'row', padding: 3, gap: 2, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.sm },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm - 2 },
  viewBtnActive: { backgroundColor: colors.surface2 },
  viewText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text3 },
  viewTextActive: { color: colors.text1 },

  filterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  filterChipActive: { backgroundColor: colors.surface1, borderColor: colors.accent },
  filterChipText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text3 },
  filterChipTextActive: { color: colors.text1 },

  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },
  errorCard: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errorTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errorBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  emptyCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline, gap: 8 },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  tripsStack: { gap: 12 },
});
