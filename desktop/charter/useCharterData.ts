// Charter data hooks — live subscriptions to the three subcollections
// under charter_accounts/{orgId}/. Kept together because the trip
// planner needs all three (spots to pick, crew to assign, trips to
// list) and each is a one-line query that doesn't justify its own
// file.

import React from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { CharterSpot, CrewMember, Trip, TripStatus, Cert, CrewRole } from './types';

// ─── Charter spot library ─────────────────────────────────────────────

export type CharterSpotsState = {
  spots: CharterSpot[];
  loading: boolean;
  error: string | null;
};

export function useCharterSpots(orgId: string | null | undefined): CharterSpotsState {
  const [state, setState] = React.useState<CharterSpotsState>({
    spots: [],
    loading: !!orgId,
    error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ spots: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      query(collection(db, 'charter_accounts', orgId, 'spots'), orderBy('name', 'asc')),
      (snap) => {
        const spots = snap.docs.map((d) => charterSpotFromDoc(d.id, d.data() as Record<string, unknown>));
        setState({ spots, loading: false, error: null });
      },
      (err) => setState({ spots: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

function charterSpotFromDoc(id: string, data: Record<string, unknown>): CharterSpot {
  return {
    id,
    name: String(data.name ?? 'Unnamed'),
    lat: typeof data.lat === 'number' ? data.lat : 0,
    lng: typeof data.lng === 'number' ? data.lng : 0,
    isPrivate: data.isPrivate === true,
    linkedPublicSpotId: typeof data.linkedPublicSpotId === 'string' && data.linkedPublicSpotId.length > 0
      ? data.linkedPublicSpotId
      : null,
    tripTypes: Array.isArray(data.tripTypes) ? (data.tripTypes as CharterSpot['tripTypes']) : [],
    maxGroupSize: typeof data.maxGroupSize === 'number' ? data.maxGroupSize : 0,
    depthFt: typeof data.depthFt === 'number' ? data.depthFt : 0,
    tidePreference: tidePrefFromString(data.tidePreference),
    notes: typeof data.notes === 'string' ? data.notes : '',
    goodWindowAlertsEnabled: data.goodWindowAlertsEnabled === true,
  };
}

function tidePrefFromString(v: unknown): CharterSpot['tidePreference'] {
  if (v === 'low' || v === 'high' || v === 'slack' || v === 'any') return v;
  return 'any';
}

// ─── Crew roster ──────────────────────────────────────────────────────

export type CharterCrewState = {
  crew: CrewMember[];
  loading: boolean;
  error: string | null;
};

export function useCharterCrew(orgId: string | null | undefined): CharterCrewState {
  const [state, setState] = React.useState<CharterCrewState>({
    crew: [],
    loading: !!orgId,
    error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ crew: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      query(collection(db, 'charter_accounts', orgId, 'crew'), orderBy('name', 'asc')),
      (snap) => {
        const crew = snap.docs.map((d) => crewFromDoc(d.id, d.data() as Record<string, unknown>));
        setState({ crew, loading: false, error: null });
      },
      (err) => setState({ crew: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

function crewFromDoc(id: string, data: Record<string, unknown>): CrewMember {
  return {
    id,
    name: String(data.name ?? 'Unnamed crew'),
    role: crewRoleFromString(data.role),
    certs: Array.isArray(data.certs) ? (data.certs as unknown[]).map(parseCert) : [],
    uid: typeof data.uid === 'string' && data.uid.length > 0 ? data.uid : null,
  };
}

function crewRoleFromString(v: unknown): CrewRole {
  if (v === 'owner' || v === 'captain' || v === 'divemaster' || v === 'deckhand') return v;
  return 'deckhand';
}

function parseCert(v: unknown): Cert {
  const c = (v ?? {}) as Record<string, unknown>;
  const expiresRaw = c.expiresAt as { toDate?: () => Date } | undefined;
  return {
    type: certTypeFromString(c.type),
    issuedBy: typeof c.issuedBy === 'string' ? c.issuedBy : '',
    expiresAt: expiresRaw?.toDate?.() ?? new Date(0),
  };
}

function certTypeFromString(v: unknown): Cert['type'] {
  if (v === 'USCG' || v === 'DiveMaster' || v === 'Instructor' || v === 'CPR' || v === 'O2Provider') return v;
  return 'CPR';
}

// ─── All trips (no date filter; status filter applied client-side) ────

export type AllTripsState = {
  trips: Trip[];
  loading: boolean;
  error: string | null;
};

/** Live subscription to every trip under an org. Use sparingly — for
 *  a multi-year operator this could be 1000s of docs; the trip list
 *  screen pages via the Firestore date order so the loader cap is
 *  defensive. For Phase 3 we read up to ~365 days backward. */
export function useAllTrips(
  orgId: string | null | undefined,
  status?: TripStatus,
): AllTripsState {
  const [state, setState] = React.useState<AllTripsState>({
    trips: [],
    loading: !!orgId,
    error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ trips: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const base = collection(db, 'charter_accounts', orgId, 'trips');
    const q = status
      ? query(base, where('status', '==', status), orderBy('date', 'desc'))
      : query(base, orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const trips = snap.docs.map((d) => tripFromDoc(d.id, d.data() as Record<string, unknown>));
        setState({ trips, loading: false, error: null });
      },
      (err) => setState({ trips: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId, status]);
  return state;
}

function tripFromDoc(id: string, data: Record<string, unknown>): Trip {
  const dateTs = data.date as { toDate?: () => Date } | undefined;
  return {
    id,
    date: dateTs?.toDate?.() ?? new Date(),
    departureTime: typeof data.departureTime === 'string' ? data.departureTime : '00:00',
    returnTime:    typeof data.returnTime    === 'string' ? data.returnTime    : '00:00',
    departureHarbor: (data.departureHarbor as Trip['departureHarbor']) ?? { name: '—', lat: 0, lng: 0 },
    spots: Array.isArray(data.spots) ? (data.spots as string[]) : [],
    crew:  Array.isArray(data.crew)  ? (data.crew as string[])  : [],
    headcount: typeof data.headcount === 'number' ? data.headcount : 0,
    tripType: (data.tripType as Trip['tripType']) ?? 'dive',
    status:   tripStatusFromString(data.status),
    manifest: Array.isArray(data.manifest) ? (data.manifest as Trip['manifest']) : [],
    floatPlanFiled: data.floatPlanFiled === true,
    briefingShareToken: typeof data.briefingShareToken === 'string' ? data.briefingShareToken : null,
    conditionsSnapshot: (data.conditionsSnapshot as Record<string, unknown>) ?? null,
    captainsLog: (data.captainsLog as Trip['captainsLog']) ?? null,
  };
}

function tripStatusFromString(v: unknown): TripStatus {
  if (v === 'planned' || v === 'active' || v === 'completed' || v === 'cancelled') return v;
  return 'planned';
}

// ─── Cert-expiry helpers ─────────────────────────────────────────────

export type CertWarningTier = 'expired' | 'expiring-soon' | 'ok';

/** ≤0 days remaining = expired; ≤60 days = expiring soon. The
 *  60-day threshold matches Coast Guard renewal grace conventions
 *  and gives a captain enough lead time to chase a card down. */
export function certWarning(cert: Cert): { tier: CertWarningTier; daysUntil: number } {
  const ms = cert.expiresAt.getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (days <= 0) return { tier: 'expired', daysUntil: days };
  if (days <= 60) return { tier: 'expiring-soon', daysUntil: days };
  return { tier: 'ok', daysUntil: days };
}

/** Worst cert-warning tier across a crew member's cert list — used
 *  to color the chip on the trip-create crew picker. */
export function crewWorstCertTier(member: CrewMember): CertWarningTier {
  let worst: CertWarningTier = 'ok';
  for (const c of member.certs) {
    const t = certWarning(c).tier;
    if (t === 'expired') return 'expired';
    if (t === 'expiring-soon') worst = 'expiring-soon';
  }
  return worst;
}

// ─── Log-filing pools ────────────────────────────────────────────────
//
// useTripsAwaitingLog — trips that need a captain's log filed: any
// trip whose status is 'active' or 'planned-and-past' (departed but
// no log yet) OR 'completed' but captainsLog is still null. The
// filer UI picks from this pool.
//
// useTripsWithLog — the archive: trips with a captainsLog. Returned
// sorted by date desc so the most-recently-filed trip leads.

export function useTripsAwaitingLog(orgId: string | null | undefined): AllTripsState {
  const [state, setState] = React.useState<AllTripsState>({
    trips: [], loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ trips: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    // Server-side: pull everything that isn't cancelled and doesn't
    // yet have a captainsLog. Status filters can't be combined with
    // "captainsLog == null" in a single Firestore query without a
    // composite index, so we filter client-side after the read.
    const unsub = onSnapshot(
      query(
        collection(db, 'charter_accounts', orgId, 'trips'),
        where('status', 'in', ['planned', 'active', 'completed']),
        orderBy('date', 'desc'),
      ),
      (snap) => {
        const all = snap.docs.map((d) => tripFromDoc(d.id, d.data() as Record<string, unknown>));
        const filtered = all.filter((t) => t.captainsLog == null && tripHasDeparted(t));
        setState({ trips: filtered, loading: false, error: null });
      },
      (err) => setState({ trips: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

export function useTripsWithLog(orgId: string | null | undefined): AllTripsState {
  const [state, setState] = React.useState<AllTripsState>({
    trips: [], loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ trips: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    // Firestore can't directly `where('captainsLog', '!=', null)` — we
    // read completed trips and filter client-side. For a year of trips
    // (~365 max) this is fine; pagination lands when an org crosses
    // that threshold.
    const unsub = onSnapshot(
      query(
        collection(db, 'charter_accounts', orgId, 'trips'),
        where('status', '==', 'completed'),
        orderBy('date', 'desc'),
      ),
      (snap) => {
        const trips = snap.docs
          .map((d) => tripFromDoc(d.id, d.data() as Record<string, unknown>))
          .filter((t) => t.captainsLog != null);
        setState({ trips, loading: false, error: null });
      },
      (err) => setState({ trips: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

/** A trip "has departed" when its departure datetime is in the past.
 *  Drives the awaiting-log pool — there's no point offering to log a
 *  trip the captain hasn't gone on yet. */
function tripHasDeparted(t: Trip): boolean {
  const [h, m] = t.departureTime.split(':').map((s) => parseInt(s, 10));
  const dep = new Date(t.date);
  dep.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return dep.getTime() <= Date.now();
}

// ─── Charter account doc ────────────────────────────────────────────

import { doc as fbDoc } from 'firebase/firestore';
import type {
  CharterAccount, OperationsProfile, OrgHarbor, Vessel,
} from './types';

export type CharterAccountState = {
  account: CharterAccount | null;
  loading: boolean;
  error: string | null;
};

/** Live subscription to charter_accounts/{orgId}. Returns null while
 *  the doc doesn't exist yet (e.g. brand-new orgs mid-setup). Used by
 *  the onboarding gate (setupComplete check), the settings screen,
 *  and the trip-create wizard's home-harbor default. */
export function useCharterAccount(orgId: string | null | undefined): CharterAccountState {
  const [state, setState] = React.useState<CharterAccountState>({
    account: null, loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ account: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      fbDoc(db, 'charter_accounts', orgId),
      (snap) => {
        if (!snap.exists()) {
          setState({ account: null, loading: false, error: null });
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        const createdRaw = data.createdAt as { toDate?: () => Date } | undefined;
        const updatedRaw = data.updatedAt as { toDate?: () => Date } | undefined;
        const acct: CharterAccount = {
          orgId,
          name:          String(data.name ?? '—'),
          contactEmail:  String(data.contactEmail ?? ''),
          contactPhone:  String(data.contactPhone ?? ''),
          description:   typeof data.description === 'string' ? data.description : null,
          setupComplete: data.setupComplete === true,
          fleet:         Array.isArray(data.fleet)             ? (data.fleet as Vessel[])               : [],
          harbors:       Array.isArray(data.harbors)           ? (data.harbors as OrgHarbor[])          : [],
          operationsProfile: Array.isArray(data.operationsProfile) ? (data.operationsProfile as OperationsProfile[]) : [],
          homeHarbor:    (data.homeHarbor as CharterAccount['homeHarbor']) ?? { name: '', lat: 0, lng: 0 },
          tripTypes:     Array.isArray(data.tripTypes)         ? (data.tripTypes as CharterAccount['tripTypes']) : [],
          createdAt:     createdRaw?.toDate?.() ?? null,
          updatedAt:     updatedRaw?.toDate?.() ?? null,
        };
        setState({ account: acct, loading: false, error: null });
      },
      (err) => setState({ account: null, loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}
