// DayForecastSection — one labeled day block (TODAY / TOMORROW) on the
// charter home screen. For every spot the org is operating that day
// (derived from the day's trips) it renders a per-vessel summary + chip
// stack. Each spot's conditions come from the same getReport pipeline
// the consumer app reads, sliced to the day's offset.

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useSpotReport } from '../data/getReport';
import { dayConditions } from './reportConditions';
import { VesselSummaryCard } from './VesselSummaryCard';
import type { CharterAccount, CharterSpot, Trip, Vessel } from './types';

export function DayForecastSection({
  label,
  dateLabel,
  dayOffset,
  trips,
  tripsLoading,
  account,
  charterSpots,
  onSetVesselType,
}: {
  label: string;
  dateLabel: string;
  dayOffset: number;
  trips: Trip[];
  tripsLoading: boolean;
  account: CharterAccount | null;
  charterSpots: CharterSpot[];
  onSetVesselType?: () => void;
}) {
  // Operating spots = the distinct charter-spot ids referenced by the
  // day's trips, in first-seen order.
  const operatingSpotIds = React.useMemo(() => {
    const seen: string[] = [];
    for (const t of trips) for (const s of t.spots) if (!seen.includes(s)) seen.push(s);
    return seen;
  }, [trips]);

  const fleet = account?.fleet ?? [];

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>{label.toUpperCase()}</Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>

      {tripsLoading ? (
        <View style={styles.quiet}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.quietText}>Reading {label.toLowerCase()}'s board…</Text>
        </View>
      ) : operatingSpotIds.length === 0 ? (
        <View style={styles.quiet}>
          <Text style={styles.quietText}>
            No trips on the board for {label.toLowerCase()}. Add trips with spots to see a
            per-vessel condition read here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {operatingSpotIds.map((spotId) => (
            <SpotForecastBlock
              key={spotId}
              dayOffset={dayOffset}
              charterSpot={charterSpots.find((s) => s.id === spotId) ?? null}
              spotId={spotId}
              vessels={vesselsForSpotDay(account, trips, spotId, fleet)}
              onSetVesselType={onSetVesselType}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SpotForecastBlock({
  dayOffset,
  charterSpot,
  spotId,
  vessels,
  onSetVesselType,
}: {
  dayOffset: number;
  charterSpot: CharterSpot | null;
  spotId: string;
  vessels: Vessel[];
  onSetVesselType?: () => void;
}) {
  // Conditions come from the linked PUBLIC spot's report (the charter
  // private spot is just a label + a join key).
  const publicSpotId = charterSpot?.linkedPublicSpotId ?? undefined;
  const { data, loading } = useSpotReport(publicSpotId);
  const conditions = React.useMemo(() => dayConditions(data, dayOffset), [data, dayOffset]);

  const spotName = charterSpot?.name ?? spotId;

  return (
    <View style={styles.spotBlock}>
      <Text style={styles.spotName}>{spotName}</Text>

      {!publicSpotId ? (
        <Text style={styles.spotNote}>
          Link this spot to a public KaiCast spot in Settings to pull live conditions.
        </Text>
      ) : loading && !data ? (
        <View style={styles.quietInline}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.quietText}>Loading conditions…</Text>
        </View>
      ) : vessels.length === 0 ? (
        <Text style={styles.spotNote}>No vessels in the fleet yet — add one in Settings.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {vessels.map((v) => (
            <VesselSummaryCard
              key={v.vesselId}
              vessel={v}
              conditions={conditions}
              spot={charterSpot}
              onSetVesselType={onSetVesselType}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Vessel ↔ spot/day resolution ────────────────────────────────────
//
// Trips don't carry a vesselId in the current schema, so we resolve the
// vessels operating a spot from the org's operationsProfile: each entry
// maps a trip type to a default vessel. We collect the vessels for the
// trip types that visit this spot today; when nothing resolves (v1 orgs
// with no operationsProfile), we fall back to the whole fleet so the
// operator still sees a read for every boat.
function vesselsForSpotDay(
  account: CharterAccount | null,
  dayTrips: Trip[],
  spotId: string,
  fleet: Vessel[],
): Vessel[] {
  if (fleet.length <= 1 || !account) return fleet;
  const tripTypesHere = new Set(dayTrips.filter((t) => t.spots.includes(spotId)).map((t) => t.tripType));
  const vesselIds = new Set<string>();
  for (const p of account.operationsProfile ?? []) {
    if (opsTripTypeMatches(p.tripType, tripTypesHere)) vesselIds.add(p.defaultVesselId);
  }
  const assigned = fleet.filter((v) => vesselIds.has(v.vesselId));
  return assigned.length ? assigned : fleet;
}

/** Loose match between an OperationsProfile trip type and the Trip.tripType
 *  set running a spot. 'dive_charter' ↔ 'dive', exact otherwise. */
function opsTripTypeMatches(opsType: string, tripTypes: Set<string>): boolean {
  for (const tt of tripTypes) {
    if (opsType === tt) return true;
    if (opsType === 'dive_charter' && tt === 'dive') return true;
  }
  return false;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  kicker: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', color: colors.accent },
  date: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },

  quiet: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18,
    borderRadius: radius.md, backgroundColor: colors.surface0,
    borderWidth: 1, borderColor: colors.hairline,
  },
  quietInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quietText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, flexShrink: 1 },

  spotBlock: { gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  spotName: { fontFamily: fonts.display, fontSize: 17, fontWeight: '700', color: colors.text1 },
  spotNote: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },
});
