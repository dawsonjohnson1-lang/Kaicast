// CharterBriefScreen — PUBLIC read-only briefing share page.
//
// This route is the only charter URL that doesn't require auth. The
// share token in `?t=…` is required and is validated server-side by
// the getCharterBrief Cloud Function (the trip doc itself is not
// publicly readable per firestore.rules). The function returns only
// the fields safe to share with someone holding the link.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { HazardStrip } from './HazardStrip';
import { useSpotReport, tierFromRating } from '../data/getReport';
import type { RouteParams } from '../router';

const BRIEF_ENDPOINT = 'https://us-central1-kaicast-207dc.cloudfunctions.net/getCharterBrief';

interface BriefResponse {
  trip: {
    id: string;
    date: string | null;
    departureTime: string;
    returnTime: string;
    tripType: string;
    headcount: number;
    departureHarbor: { name: string; lat: number | null; lng: number | null };
    spots: Array<{ id: string; name: string; lat: number | null; lng: number | null }>;
    crew:  Array<{ name: string; role: string }>;
    floatPlanFiled: boolean;
  };
  org: { name: string } | null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; brief: BriefResponse }
  | { kind: 'error'; status: number; message: string };

export function CharterBriefScreen({ params }: { params?: RouteParams }) {
  const tripId = params?.tripId ?? null;
  const token  = params?.briefToken ?? null;
  const [state, setState] = React.useState<State>({ kind: 'idle' });

  React.useEffect(() => {
    if (!tripId || !token) {
      setState({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    const url = `${BRIEF_ENDPOINT}?tripId=${encodeURIComponent(tripId)}&t=${encodeURIComponent(token)}`;
    fetch(url)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          let msg = res.statusText;
          try {
            const body = await res.json() as { error?: string };
            if (body?.error) msg = body.error;
          } catch { /* ignore */ }
          setState({ kind: 'error', status: res.status, message: msg });
          return;
        }
        const json = await res.json() as BriefResponse;
        setState({ kind: 'ready', brief: json });
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: 'error', status: 0, message: (err as Error).message || 'Network error' });
      });
    return () => { cancelled = true; };
  }, [tripId, token]);

  return (
    <View style={styles.page}>
      <View style={styles.printable}>
        <View style={styles.header}>
          <Text style={styles.kicker}>CREW BRIEFING</Text>
          <Text style={styles.title}>
            {(() => {
              if (state.kind !== 'ready') return 'KaiCast Charter';
              return state.brief.org?.name ?? 'KaiCast Charter';
            })()}
          </Text>
        </View>

        {!tripId || !token ? (
          <ErrCard title="Link is incomplete">
            A valid brief URL looks like{' '}
            <Text style={styles.mono}>/charter/brief/&lt;tripId&gt;?t=&lt;token&gt;</Text>. Ask the
            captain who sent you to resend the link.
          </ErrCard>
        ) : state.kind === 'loading' || state.kind === 'idle' ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Reading briefing…</Text>
          </View>
        ) : state.kind === 'error' ? (
          <ErrCard title={state.status === 404 ? 'Briefing not found' : state.status === 410 ? 'Trip was cancelled' : 'Could not load briefing'}>
            {state.status === 404
              ? 'The share link may have been revoked, or the trip was deleted. Ask the captain to send you a fresh link.'
              : state.status === 410
                ? 'This trip is no longer on the schedule. Talk to the captain before heading out.'
                : `(${state.status}) ${state.message}`}
          </ErrCard>
        ) : (
          <BriefBody brief={state.brief} />
        )}

        <Text style={styles.footer}>
          KaiCast Charter Brief · forecast data updates hourly · GPS coordinates accurate to ~5 m
        </Text>
      </View>
    </View>
  );
}

// ─── Briefing body ───────────────────────────────────────────────────

function BriefBody({ brief }: { brief: BriefResponse }) {
  const { trip } = brief;
  const dateObj = trip.date ? new Date(trip.date) : null;
  return (
    <View style={{ gap: 24 }}>
      {/* When + where */}
      <Section label="WHEN">
        <Text style={styles.bigLine}>
          {dateObj
            ? dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
            : '—'}
        </Text>
        <Text style={styles.meta}>
          Departs {trip.departureTime} · returns {trip.returnTime}
        </Text>
      </Section>

      <Section label="WHERE FROM">
        <Text style={styles.bigLine}>{trip.departureHarbor.name || '—'}</Text>
        {trip.departureHarbor.lat != null && trip.departureHarbor.lng != null ? (
          <Text style={styles.coords}>{formatCoord(trip.departureHarbor.lat, trip.departureHarbor.lng)}</Text>
        ) : null}
      </Section>

      {/* Route + per-spot conditions */}
      <Section label={`ROUTE — ${trip.tripType.toUpperCase()}, ${trip.headcount} ${trip.headcount === 1 ? 'passenger' : 'passengers'}`}>
        {trip.spots.length === 0 ? (
          <Text style={styles.muted}>No spots on the route.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {trip.spots.map((s, i) => (
              <BriefSpotRow
                key={`${s.id}-${i}`}
                index={i + 1}
                spot={s}
                tripDate={dateObj}
                departureTime={trip.departureTime}
              />
            ))}
          </View>
        )}
      </Section>

      {/* Today's hazard strip — reuses the same component as the home
          screen but works fine here too. NWS + box-jelly are both
          public-data calls so no auth is needed. */}
      <Section label="ACTIVE HAZARDS TODAY">
        <HazardStrip />
      </Section>

      {/* Crew — names + roles only, no certs, no contact info. */}
      <Section label="CREW">
        {trip.crew.length === 0 ? (
          <Text style={styles.muted}>No crew listed on this trip.</Text>
        ) : (
          <View style={styles.crewRows}>
            {trip.crew.map((c, i) => (
              <View key={i} style={styles.crewRow}>
                <Text style={styles.crewName}>{c.name}</Text>
                <Text style={styles.crewRole}>{c.role.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Float plan summary */}
      <Section label="FLOAT PLAN">
        <Text style={styles.meta}>
          {trip.floatPlanFiled
            ? '✓ Float plan filed with the captain\'s designated shore contact.'
            : 'Float plan not yet filed — captain will confirm before departure.'}
        </Text>
      </Section>
    </View>
  );
}

// ─── Per-spot row with live forecast ─────────────────────────────────

function BriefSpotRow({
  index,
  spot,
  tripDate,
  departureTime,
}: {
  index: number;
  spot: { id: string; name: string; lat: number | null; lng: number | null };
  tripDate: Date | null;
  departureTime: string;
}) {
  // Try to fetch a public forecast keyed by the spot's id. If the
  // charter-private spot doesn't link to a canonical KaiCast spot,
  // useSpotReport will return null/loading and we just show the
  // spot name without a tier badge.
  const { data: report } = useSpotReport(spot.id);
  const tier = report?.now?.rating ? tierFromRating(report.now.rating) : null;

  const tierColor =
    tier === 'excellent' ? '#09A1FB' :
    tier === 'great' || tier === 'good' ? '#3DDC84' :
    tier === 'fair' ? '#F5A623' :
    tier === 'no-go' ? '#F73726' :
    colors.text3;

  return (
    <View style={styles.spotRow}>
      <View style={styles.spotIndex}><Text style={styles.spotIndexText}>{index}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.spotName}>{spot.name}</Text>
        {spot.lat != null && spot.lng != null ? (
          <Text style={styles.coords}>{formatCoord(spot.lat, spot.lng)}</Text>
        ) : null}
      </View>
      {tier ? (
        <View style={[styles.tierBadge, { borderColor: tierColor }]}>
          <Text style={[styles.tierBadgeText, { color: tierColor }]}>{tier.toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ErrCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.errCard}>
      <Text style={styles.errTitle}>{title}</Text>
      <Text style={styles.errBody}>{children}</Text>
    </View>
  );
}

function formatCoord(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', padding: 24 },
  printable: {
    width: '100%', maxWidth: 760,
    backgroundColor: colors.surface0, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.hairline,
    padding: 36, gap: 24,
  },

  header: { gap: 6, borderBottomWidth: 1, borderBottomColor: colors.hairline, paddingBottom: 18 },
  kicker: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.accent },
  title: { fontFamily: fonts.display, fontSize: 28, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },

  section: { gap: 10 },
  sectionLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1.5 },
  sectionBody: { gap: 6 },

  bigLine: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  meta:    { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  muted:   { fontFamily: fonts.body, fontSize: 13, color: colors.text3, fontStyle: 'italic' },
  coords:  { fontFamily: fonts.mono, fontSize: 12, color: colors.text3 },
  mono:    { fontFamily: fonts.mono, color: colors.text3, fontSize: 12 },

  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  spotIndex: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  spotIndexText: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '800', color: colors.text1 },
  spotName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text1 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  tierBadgeText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  crewRows: { gap: 6 },
  crewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.sm, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.hairline,
  },
  crewName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text1 },
  crewRole: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 1.5 },

  errCard: {
    padding: 20, borderRadius: radius.md,
    backgroundColor: 'rgba(247,55,38,0.10)',
    borderWidth: 1, borderColor: '#F73726',
    gap: 8,
  },
  errTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },

  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },

  footer: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.text4, textAlign: 'center',
    letterSpacing: 1, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.hairline,
  },
});
