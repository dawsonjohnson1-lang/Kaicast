// CrewBriefScreen — authenticated read-only trip brief for /crew/brief/:tripId.
//
// What this screen shows (per the addendum spec):
//   - Trip header: date, departure / return times, status, type
//   - Spots: ordered list with names + depth + tide preference
//   - Crew roster: all assigned crew members with role chips. The
//     current user's row is highlighted.
//   - Conditions snapshot: forecast values captured at trip creation
//     time (visibility, water temp, swell, wind, rating) when present.
//   - Float plan: filed / not filed badge
//   - Manifest: dive boats only; full guest list visible to captains
//     and the admin, hidden for other roles.
//
// Captain-only buttons (file float plan, log trip) are placeholders
// in this slice — the captain writes ship in D4 along with the
// captain-scoped trip rule.
//
// "Log my dive →" appears for ALL roles on completed trips. Routes to
// /log-dive with tripId + orgId query params; LogDiveScreen reads
// them and pre-fills from the trip's conditionsSnapshot.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useAuth, type OrgRole } from '../hooks/useAuth';
import { CrewShell } from './CrewShell';
import { useActiveMembership } from './useActiveMembership';
import { useTripBrief } from './useTripBrief';
import type {
  CharterSpot, CrewMember, Trip, TripStatus, TripType,
} from '../charter/types';
import type { NavigateFn, RouteParams } from '../router';

const ROLE_LABEL: Record<OrgRole, string> = {
  captain: 'Captain',
  divemaster: 'Divemaster',
  instructor: 'Instructor',
  manager: 'Manager',
  deckhand: 'Deckhand',
};

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

const TYPE_LABEL: Record<TripType, string> = {
  dive: 'Dive',
  snorkel: 'Snorkel',
  spearfishing: 'Spearfishing',
  freedive: 'Freedive',
};

interface Props {
  onNavigate?: NavigateFn;
  params?: RouteParams;
}

export function CrewBriefScreen({ onNavigate, params }: Props) {
  const auth = useAuth();
  const { membership } = useActiveMembership();
  const tripId = params?.tripId ?? null;
  const { trip, spotsById, crewById, loading, error } = useTripBrief(
    membership?.orgId,
    tripId,
  );

  // Resolve the current user's crew record id (the trip stores crew as
  // an array of crew-record ids, not uids). Used to highlight the
  // self row + to decide whether the caller is the assigned captain
  // for this trip.
  const selfCrew = React.useMemo<CrewMember | null>(() => {
    if (!auth.user) return null;
    for (const m of crewById.values()) {
      if (m.uid === auth.user.uid) return m;
    }
    return null;
  }, [crewById, auth.user]);

  return (
    <CrewShell active="crew-brief" onNavigate={onNavigate}>
      <Pressable onPress={() => onNavigate?.('crew-trips')} style={styles.backLink}>
        <Text style={styles.backLinkText}>← My trips</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading brief…</Text>
        </View>
      ) : error ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not load brief</Text>
          <Text style={styles.errBody}>{error}</Text>
        </View>
      ) : !trip ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Trip not found</Text>
          <Text style={styles.errBody}>
            The trip may have been cancelled, or you might not have access. Head back to My Trips.
          </Text>
        </View>
      ) : (
        <BriefBody
          trip={trip}
          spotsById={spotsById}
          crewById={crewById}
          selfCrew={selfCrew}
          orgId={membership?.orgId ?? null}
          onNavigate={onNavigate}
        />
      )}
    </CrewShell>
  );
}

function BriefBody({
  trip, spotsById, crewById, selfCrew, orgId, onNavigate,
}: {
  trip: Trip;
  spotsById: Map<string, CharterSpot>;
  crewById: Map<string, CrewMember>;
  selfCrew: CrewMember | null;
  orgId: string | null;
  onNavigate?: NavigateFn;
}) {
  const dateLabel = trip.date instanceof Date && !Number.isNaN(trip.date.getTime())
    ? trip.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const tripTypeLabel = TYPE_LABEL[trip.tripType];
  const statusLabel = STATUS_LABEL[trip.status];
  const statusColor = STATUS_COLOR[trip.status];

  const isSelfCaptain = !!(selfCrew && selfCrew.role === 'captain' && trip.crew.includes(selfCrew.id));
  const canSeeManifest = isSelfCaptain && trip.tripType === 'dive';
  const isCompleted = trip.status === 'completed';

  return (
    <View style={styles.body}>
      {/* ── Header ── */}
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Trip brief</Text>
            <Text style={styles.title}>{dateLabel}</Text>
            <Text style={styles.subtitle}>
              {trip.departureTime || '—'}{trip.returnTime ? ` → ${trip.returnTime}` : ''} ·{' '}
              {trip.departureHarbor?.name || 'Departure harbor not set'}
            </Text>
          </View>
          <View style={[styles.statusChip, { borderColor: statusColor }]}>
            <Text style={[styles.statusChipText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Meta label="Trip type" value={tripTypeLabel} />
          <Meta label="Headcount" value={String(trip.headcount || '—')} />
          <Meta label="Float plan" value={trip.floatPlanFiled ? 'Filed' : 'Not filed'} />
          {selfCrew ? <Meta label="My role" value={ROLE_LABEL[selfCrew.role as OrgRole] ?? selfCrew.role} /> : null}
        </View>
      </View>

      {/* ── Spots ── */}
      <Section title="Spots" sub={`${trip.spots.length} stop${trip.spots.length === 1 ? '' : 's'}`}>
        {trip.spots.length === 0 ? (
          <Text style={styles.empty}>No spots set on this trip.</Text>
        ) : (
          <View style={styles.spotStack}>
            {trip.spots.map((spotId, idx) => {
              const spot = spotsById.get(spotId);
              return (
                <View key={`${spotId}-${idx}`} style={styles.spotRow}>
                  <Text style={styles.spotIndex}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spotName}>{spot?.name ?? spotId}</Text>
                    <Text style={styles.spotSub}>
                      {spot
                        ? `${spot.depthFt ? `${spot.depthFt} ft` : 'Depth not set'} · ${spot.tidePreference} tide${spot.notes ? ' · ' + spot.notes : ''}`
                        : 'Unknown spot — admin may have removed it from the library.'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Section>

      {/* ── Crew roster ── */}
      <Section title="Crew" sub={`${trip.crew.length} assigned`}>
        {trip.crew.length === 0 ? (
          <Text style={styles.empty}>No crew assigned yet.</Text>
        ) : (
          <View style={styles.crewStack}>
            {trip.crew.map((crewMemberId) => {
              const member = crewById.get(crewMemberId);
              const isSelf = selfCrew?.id === crewMemberId;
              return (
                <View
                  key={crewMemberId}
                  style={[styles.crewRow, isSelf && styles.crewRowSelf]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.crewName}>
                      {member?.name ?? `Unknown crew (${crewMemberId})`}
                      {isSelf ? <Text style={styles.youBadge}> · you</Text> : null}
                    </Text>
                    <Text style={styles.crewRole}>
                      {member ? (ROLE_LABEL[member.role as OrgRole] ?? member.role) : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Section>

      {/* ── Conditions snapshot ── */}
      <Section
        title="Conditions snapshot"
        sub="Forecast at trip-creation time"
      >
        <ConditionsBlock trip={trip} />
      </Section>

      {/* ── Manifest (captain only, dive boats only) ── */}
      {canSeeManifest ? (
        <Section title="Manifest" sub={`${trip.manifest?.length ?? 0} guests`}>
          {(!trip.manifest || trip.manifest.length === 0) ? (
            <Text style={styles.empty}>No guests booked yet.</Text>
          ) : (
            <View style={styles.manifestStack}>
              {trip.manifest.map((g, i) => (
                <Text key={i} style={styles.manifestRow}>
                  {g.name || '—'} · {g.certLevel || 'No cert'} · {g.certAgency || '—'}
                </Text>
              ))}
            </View>
          )}
        </Section>
      ) : null}

      {/* ── Captain controls ── */}
      {isSelfCaptain ? (
        <Section title="Captain actions" sub="Float plan filing + Captain's Log ship next slice">
          <View style={styles.actionsRow}>
            <View style={[styles.disabledBtn]}>
              <Text style={styles.disabledBtnText}>
                {trip.floatPlanFiled ? 'Float plan filed ✓' : 'File float plan (soon)'}
              </Text>
            </View>
            {isCompleted ? (
              <View style={[styles.disabledBtn]}>
                <Text style={styles.disabledBtnText}>
                  {trip.captainsLog ? "Captain's Log on file ✓" : 'Log trip (soon)'}
                </Text>
              </View>
            ) : null}
          </View>
        </Section>
      ) : null}

      {/* ── Log my dive handoff (all roles, completed trips) ── */}
      {isCompleted && orgId ? (
        <Section title="Personal dive log" sub="One-tap handoff into the consumer log form">
          <Pressable
            style={styles.primaryBtn}
            onPress={() => onNavigate?.('log-dive', { tripId: trip.id, orgId })}
          >
            <Text style={styles.primaryBtnText}>Log my dive →</Text>
          </Pressable>
          <Text style={styles.hint}>
            We'll pre-fill spot, date, water temp, visibility, and conditions rating from this trip — fill in your bottom time, buddy, and notes and publish.
          </Text>
        </Section>
      ) : null}
    </View>
  );
}

function ConditionsBlock({ trip }: { trip: Trip }) {
  const cs = (trip.conditionsSnapshot ?? {}) as Record<string, unknown>;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Visibility',  value: fmtNum(pickNum(cs, 'visibilityFt', 'visibility.estimatedVisibilityFeet'), 'ft') },
    { label: 'Water temp',  value: fmtNum(pickNum(cs, 'waterTempF', 'temperature.waterF'), '°F') },
    { label: 'Swell',       value: fmtNum(pickNum(cs, 'swellHeightFt', 'swellHtFt', 'swell.heightFt'), 'ft') },
    { label: 'Wind',        value: pickStr(cs, 'windDescription', 'wind.description') ?? '—' },
    { label: 'Rating',      value: pickStr(cs, 'rating.label', 'rating', 'now.rating.label') ?? '—' },
  ];
  const hasAny = rows.some((r) => r.value !== '—');
  if (!hasAny) {
    return <Text style={styles.empty}>No forecast snapshot captured for this trip.</Text>;
  }
  return (
    <View style={styles.condGrid}>
      {rows.map((r) => (
        <View key={r.label} style={styles.condCell}>
          <Text style={styles.condLabel}>{r.label}</Text>
          <Text style={styles.condValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function Section({
  title, sub, children,
}: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
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

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = getPath(o, k);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}
function pickStr(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = getPath(o, k);
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}
function getPath(o: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc != null && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, o);
}
function fmtNum(v: number | null, unit: string): string {
  return v == null ? '—' : `${Math.round(v * 10) / 10} ${unit}`;
}

const styles = StyleSheet.create({
  backLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  backLinkText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    fontWeight: '600',
  },

  body: { gap: 18 },
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

  headerCard: {
    padding: 22,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 16,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    marginTop: 6,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
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

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
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

  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionBody: {
    backgroundColor: colors.surface0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
  },

  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, fontStyle: 'italic' },

  spotStack: { gap: 10 },
  spotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  spotIndex: {
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    color: colors.text2,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  spotName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  spotSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  crewStack: { gap: 8 },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'transparent',
  },
  crewRowSelf: {
    backgroundColor: 'rgba(9,161,251,0.08)',
    borderColor: colors.accent,
  },
  crewName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },
  youBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  crewRole: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  condGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  condCell: { gap: 2, minWidth: 120 },
  condLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  condValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    fontWeight: '600',
  },

  manifestStack: { gap: 4 },
  manifestRow: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  disabledBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
    opacity: 0.7,
  },
  disabledBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text3,
  },

  primaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.bg,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
    marginTop: 8,
  },
});
