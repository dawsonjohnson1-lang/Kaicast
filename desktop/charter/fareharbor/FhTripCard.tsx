// FhTripCard — renders one synced FareHarbor trip on /charter/trips.
//
// Mirrors TripCard's shape but reads from a FhTrip doc (booked,
// capacity, FH product name) and the denormalized enrichment fields
// (kaicastSpotIds, harborId, boatIds). The condition badge uses the
// same useSpotReport hook as the native trip card so the rating is
// derived live from the spot's hourly windows.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../tokens';
import { useSpotReport, tierFromRating, type BackendReport } from '../../data/getReport';
import { SPOTS as CANONICAL_SPOTS } from '../../data/spots';
import type { Vessel, OrgHarbor } from '../types';
import type { FhTrip } from './types';
import { FH_TRIP_TYPE_META } from './types';

type Tier = 'excellent' | 'great' | 'good' | 'fair' | 'no-go';

const TIER_COLOR: Record<Tier, string> = {
  excellent: '#09A1FB',
  great:     '#3DDC84',
  good:      '#3DDC84',
  fair:      '#F5A623',
  'no-go':   '#F73726',
};

const TIER_LABEL: Record<Tier, string> = {
  excellent: 'EXCELLENT',
  great:     'GO',
  good:      'GO',
  fair:      'BORDERLINE',
  'no-go':   'NO-GO',
};

interface Props {
  trip: FhTrip;
  /** Org fleet so we can resolve boatIds → vessel names. */
  fleet: Vessel[];
  /** Org harbors so we can show the harbor name (or fall back to harborId). */
  orgHarbors: OrgHarbor[];
  /** Charter-side harbor label — falls back to global /harbors lookup
   *  by harborId if the captain hasn't named a matching home harbor. */
  globalHarborName?: string;
}

export function FhTripCard({ trip, fleet, orgHarbors, globalHarborName }: Props) {
  const primarySpotId = trip.kaicastSpotIds[0] ?? null;
  const { data: report, loading: reportLoading } = useSpotReport(primarySpotId ?? undefined);

  const windowMatch = React.useMemo(
    () => report ? findWindowForDeparture(report, trip.date, trip.startTime) : null,
    [report, trip.date, trip.startTime],
  );

  const tier: Tier | null = report
    ? windowMatch
      ? tierFromRating(windowMatch.rating as { label?: string; rating?: string; score?: number } | undefined)
      : tierFromRating(report.now?.rating as { label?: string; rating?: string; score?: number } | undefined)
    : null;

  const enriched =
    trip.tripType != null
    && !!trip.harborId
    && trip.boatIds.length > 0
    && trip.kaicastSpotIds.length > 0;

  const meta = trip.tripType ? FH_TRIP_TYPE_META[trip.tripType] : null;
  const primarySpotName = primarySpotId
    ? (CANONICAL_SPOTS.find((s) => s.id === primarySpotId)?.name ?? primarySpotId)
    : null;
  const remainingSpots = trip.kaicastSpotIds.length > 1 ? trip.kaicastSpotIds.length - 1 : 0;
  const boats = trip.boatIds
    .map((id) => fleet.find((v) => v.vesselId === id))
    .filter((v): v is Vessel => !!v);
  const orgHarbor = orgHarbors.find((h) => h.harborId === trip.harborId);
  const harborLabel = orgHarbor?.name || globalHarborName || trip.harborId || null;

  const fillPct = trip.capacity > 0 ? Math.min(1, trip.booked / trip.capacity) : 0;
  const fillTone: Tier =
    fillPct >= 0.9 ? 'no-go'    // ≥90% — likely sold out
    : fillPct >= 0.7 ? 'fair'   // 70–89%
    : fillPct >= 0.4 ? 'good'   // 40–69%
    : fillPct > 0    ? 'great'  // partially booked
    : 'no-go';                  // 0 booked — caller decides if that's a problem
  const fillBarColor = trip.booked === 0 ? colors.hairlineStrong : TIER_COLOR[fillTone];

  return (
    <View style={[styles.card, !enriched && styles.cardUnenriched]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.depTime}>{trip.startTime}</Text>
            <Text style={styles.depReturn}>→ {trip.endTime}</Text>
            {meta ? <Text style={styles.typeBadge}>{meta.icon} {meta.label}</Text> : null}
            <View style={styles.fhBadge}>
              <Text style={styles.fhBadgeText}>FH #{trip.fhAvailabilityPk}</Text>
            </View>
          </View>
          <Text style={styles.tripName} numberOfLines={1}>{trip.tripName || '(unnamed FareHarbor product)'}</Text>
          {primarySpotName ? (
            <Text style={styles.spotMeta}>
              {primarySpotName}{remainingSpots > 0 ? ` · +${remainingSpots} more ${remainingSpots === 1 ? 'stop' : 'stops'}` : ''}
            </Text>
          ) : (
            <Text style={styles.spotMetaWarn}>No KaiCast spots mapped — set up in Settings → FareHarbor</Text>
          )}
        </View>

        <View style={styles.badgeCol}>
          {!enriched ? (
            <View style={[styles.badge, { borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.10)' }]}>
              <View style={[styles.badgeDot, { backgroundColor: '#F5A623' }]} />
              <Text style={[styles.badgeLabel, { color: '#F5A623' }]}>SETUP</Text>
            </View>
          ) : reportLoading ? (
            <View style={[styles.badge, { borderColor: colors.hairlineStrong }]}>
              <Text style={[styles.badgeLabel, { color: colors.text3 }]}>READING…</Text>
            </View>
          ) : tier ? (
            <View style={[styles.badge, { borderColor: TIER_COLOR[tier], backgroundColor: tintFor(tier) }]}>
              <View style={[styles.badgeDot, { backgroundColor: TIER_COLOR[tier] }]} />
              <Text style={[styles.badgeLabel, { color: TIER_COLOR[tier] }]}>{TIER_LABEL[tier]}</Text>
            </View>
          ) : (
            <View style={[styles.badge, { borderColor: colors.hairlineStrong }]}>
              <Text style={[styles.badgeLabel, { color: colors.text3 }]}>NO DATA</Text>
            </View>
          )}
        </View>
      </View>

      {/* Capacity bar — booked / capacity */}
      {trip.capacity > 0 ? (
        <View style={styles.fillRow}>
          <View style={styles.fillBarTrack}>
            <View style={[styles.fillBarFill, { width: `${fillPct * 100}%`, backgroundColor: fillBarColor }]} />
          </View>
          <Text style={styles.fillLabel}>
            {trip.booked}/{trip.capacity} booked
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.footerLabel}>
          {harborLabel ? `⚓ ${harborLabel}` : 'No harbor set'}
          {boats.length > 0 ? ` · ${boats.map((b) => b.name).join(', ')}` : ''}
          {trip.lastSynced ? ` · synced ${timeAgo(trip.lastSynced)}` : ''}
        </Text>
      </View>
    </View>
  );
}

function tintFor(t: Tier): string {
  return ({
    excellent: 'rgba(9,161,251,0.10)',
    great:     'rgba(61,220,132,0.10)',
    good:      'rgba(61,220,132,0.10)',
    fair:      'rgba(245,166,35,0.10)',
    'no-go':   'rgba(247,55,38,0.10)',
  } as const)[t];
}

function findWindowForDeparture(
  report: BackendReport,
  tripDate: string,
  departureTime: string,
): { rating?: unknown; visibility?: unknown; wind?: unknown; swell?: unknown } | null {
  // tripDate is HST date YYYY-MM-DD; we treat departureTime as HST.
  // Reports' `startIso` are ISO with offset, so compare on absolute ms.
  const [hStr, mStr] = departureTime.split(':');
  const hour = Number.parseInt(hStr ?? '0', 10);
  const minute = Number.parseInt(mStr ?? '0', 10);
  // HST is UTC-10 with no DST.
  const tripStart = new Date(`${tripDate}T${pad2(hour)}:${pad2(minute)}:00-10:00`);
  const targetMs = tripStart.getTime();
  const windows = (report.windows as Array<{ startIso?: string; rating?: unknown }> | undefined) ?? [];
  if (windows.length === 0) return null;
  let best: { delta: number; w: unknown } | null = null;
  for (const w of windows) {
    if (!w.startIso) continue;
    const wStart = Date.parse(w.startIso);
    const delta = Math.abs(wStart - targetMs);
    if (!best || delta < best.delta) best = { delta, w };
  }
  return best?.w as { rating?: unknown } | null;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 10 },
  cardUnenriched: { borderStyle: 'dashed', borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.04)' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  depTime: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '800', color: colors.text1 },
  depReturn: { fontFamily: fonts.mono, fontSize: 12, color: colors.text3 },
  typeBadge: { fontFamily: fonts.mono, fontSize: 10, color: colors.text2, fontWeight: '600' },
  fhBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(9,161,251,0.10)', borderWidth: 1, borderColor: colors.accent },
  fhBadgeText: { fontFamily: fonts.mono, fontSize: 9, color: colors.accent, fontWeight: '700', letterSpacing: 0.5 },
  tripName: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text1, marginTop: 4 },
  spotMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 2 },
  spotMetaWarn: { fontFamily: fonts.body, fontSize: 12, color: '#F5A623', marginTop: 2, fontWeight: '600' },

  badgeCol: { alignItems: 'flex-end' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeDot: { width: 7, height: 7, borderRadius: 999 },
  badgeLabel: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  fillRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fillBarTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: colors.surface1, overflow: 'hidden' },
  fillBarFill: { height: 6, borderRadius: 999 },
  fillLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.hairline },
  footerLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.text3, flex: 1 },
});
