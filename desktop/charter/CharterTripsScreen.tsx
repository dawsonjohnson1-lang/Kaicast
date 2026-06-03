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
import {
  useFareHarborIntegration, useFareHarborTrips, useHarbors,
} from './fareharbor/useFareHarbor';
import { FhTripCard } from './fareharbor/FhTripCard';

const STATUS_FILTERS: TripStatus[] = ['planned', 'active', 'completed', 'cancelled'];

type ViewMode = 'list' | 'calendar' | 'fareharbor';

export function CharterTripsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { orgId } = useAuth();
  const [status, setStatus] = React.useState<TripStatus>('planned');
  const [view, setView] = React.useState<ViewMode>('list');
  const [showWizard, setShowWizard] = React.useState(false);

  // Org doc — needed by the wizard to default the home harbor.
  const org = useCharterAccount(orgId);

  const { trips, loading, error } = useAllTrips(orgId, status);
  const { spots: orgSpots } = useCharterSpots(orgId);
  const { integration: fhIntegration } = useFareHarborIntegration(orgId);
  const fhConnected = !!fhIntegration?.shortname && !!fhIntegration?.userApiKey;

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
          {(['list', 'calendar', 'fareharbor'] as const).map((v) => {
            const label = v === 'list' ? 'Trip list'
              : v === 'calendar' ? 'Readiness calendar'
              : 'FareHarbor';
            return (
              <Pressable key={v} onPress={() => setView(v)} style={[styles.viewBtn, view === v && styles.viewBtnActive]}>
                <Text style={[styles.viewText, view === v && styles.viewTextActive]}>{label}</Text>
                {v === 'fareharbor' && fhConnected ? <View style={styles.viewDot} /> : null}
              </Pressable>
            );
          })}
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
      ) : view === 'calendar' ? (
        <ReadinessCalendar spots={orgSpots} />
      ) : (
        <FareHarborTripsView orgId={orgId} org={org} connected={fhConnected} onNavigate={onNavigate} />
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

// ─── FareHarbor view ─────────────────────────────────────────────────

/** Slice of incoming fh_trips for a charter org, grouped by date, with
 *  cancelled trips hidden by default and a quick "show cancelled"
 *  toggle. Uses the same condition-badge pattern as TripCard. */
function FareHarborTripsView({
  orgId, org, connected, onNavigate,
}: {
  orgId: string | null | undefined;
  org: CharterAccount | null;
  connected: boolean;
  onNavigate?: NavigateFn;
}) {
  const [showCancelled, setShowCancelled] = React.useState(false);

  // Fetch a wider window so the section can group across this week
  // and next.
  const { fromDate, toDate } = React.useMemo(() => {
    const today = todayHstYmd();
    return { fromDate: today, toDate: addDaysYmd(today, 60) };
  }, []);

  const { trips, loading, error } = useFareHarborTrips(orgId, {
    fromDate, toDate, hideCancelled: !showCancelled,
  });
  const { harbors: globalHarbors } = useHarbors();

  if (!orgId) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Charter org not set on your user doc.</Text>
        <Text style={styles.emptyBody}>See the home screen for the setup banner.</Text>
      </View>
    );
  }
  if (!connected) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>FareHarbor isn't connected yet.</Text>
        <Text style={styles.emptyBody}>
          Connect your FareHarbor account in Settings → FareHarbor. Bookable availabilities
          will appear here automatically after the first sync.
        </Text>
        <Pressable onPress={() => onNavigate?.('charter-settings')} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Open Settings →</Text>
        </Pressable>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Reading FareHarbor trips…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Could not load FareHarbor trips</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }
  if (trips.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No upcoming FareHarbor trips.</Text>
        <Text style={styles.emptyBody}>
          The next sync runs within 30 minutes. New availabilities you create or open in
          FareHarbor will show up here automatically.
        </Text>
      </View>
    );
  }

  // Group by date so each calendar day reads as one block.
  const byDate = new Map<string, typeof trips>();
  for (const t of trips) {
    const arr = byDate.get(t.date) ?? [];
    arr.push(t);
    byDate.set(t.date, arr);
  }
  const dates = Array.from(byDate.keys()).sort();

  const enrichedCount = trips.filter((t) =>
    t.tripType != null && !!t.harborId && t.boatIds.length > 0 && t.kaicastSpotIds.length > 0,
  ).length;

  return (
    <View style={styles.fhWrap}>
      <View style={styles.fhSummaryRow}>
        <Text style={styles.fhSummaryText}>
          <Text style={styles.fhSummaryNum}>{trips.length}</Text> trips · next 60 days ·{' '}
          <Text style={styles.fhSummaryNum}>{enrichedCount}</Text> with full enrichment
        </Text>
        <Pressable onPress={() => setShowCancelled((v) => !v)} style={styles.fhToggle}>
          <Text style={styles.fhToggleText}>{showCancelled ? 'Hide cancelled' : 'Show cancelled'}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 16 }}>
        {dates.map((date) => {
          const dayTrips = byDate.get(date)!;
          return (
            <View key={date} style={styles.dayBlock}>
              <Text style={styles.dayLabel}>{formatDateLabel(date)}</Text>
              <View style={{ gap: 10 }}>
                {dayTrips.map((t) => (
                  <FhTripCard
                    key={t.fhAvailabilityPk}
                    trip={t}
                    fleet={org?.fleet ?? []}
                    orgHarbors={org?.harbors ?? []}
                    globalHarborName={globalHarbors.find((h) => h.harborId === t.harborId)?.name}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function todayHstYmd(): string {
  // HST is UTC-10, no DST. Use the UTC view shifted -10h.
  const d = new Date(Date.now() - 10 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
  const base = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
}
function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const todayYmd = todayHstYmd();
  if (ymd === todayYmd) return `Today · ${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  if (ymd === addDaysYmd(todayYmd, 1)) return `Tomorrow · ${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
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
        const updatedRaw = data.updatedAt as { toDate?: () => Date } | undefined;
        setAcct({
          orgId,
          name: String(data.name ?? '—'),
          contactEmail: String(data.contactEmail ?? ''),
          contactPhone: String(data.contactPhone ?? ''),
          description: data.description == null ? null : String(data.description),
          setupComplete: data.setupComplete === true,
          fleet: Array.isArray(data.fleet) ? (data.fleet as CharterAccount['fleet']) : [],
          harbors: Array.isArray(data.harbors) ? (data.harbors as CharterAccount['harbors']) : [],
          operationsProfile: Array.isArray(data.operationsProfile)
            ? (data.operationsProfile as CharterAccount['operationsProfile'])
            : [],
          homeHarbor: (data.homeHarbor as CharterAccount['homeHarbor']) ?? { name: '', lat: 0, lng: 0 },
          tripTypes: Array.isArray(data.tripTypes) ? (data.tripTypes as CharterAccount['tripTypes']) : [],
          createdAt: createdRaw?.toDate?.() ?? null,
          updatedAt: updatedRaw?.toDate?.() ?? null,
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
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.sm - 2 },
  viewBtnActive: { backgroundColor: colors.surface2 },
  viewText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text3 },
  viewTextActive: { color: colors.text1 },
  viewDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#3DDC84' },

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

  primaryBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent, marginTop: 6 },
  primaryBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.bg },

  fhWrap: { gap: 14 },
  fhSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  fhSummaryText: { fontFamily: fonts.body, fontSize: 12, color: colors.text2 },
  fhSummaryNum: { fontFamily: fonts.mono, fontWeight: '700', color: colors.text1 },
  fhToggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  fhToggleText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text2 },

  dayBlock: { gap: 8 },
  dayLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.accent, fontWeight: '700', letterSpacing: 1, marginLeft: 4 },
});
