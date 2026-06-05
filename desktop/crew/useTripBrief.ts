// useTripBrief — bundles the reads CrewBriefScreen needs:
//   1. The trip doc
//   2. The org's spots library (for name + depth resolution)
//   3. The org's crew roster (for displaying assignments by name)
//
// All three are live subscriptions so the screen reacts to admin
// edits in real time (e.g. crew added to the trip, float plan flipped
// to filed). The hook chains internally — the trip read seeds orgId
// via the URL param so the screen doesn't need separate plumbing.

import React from 'react';
import {
  collection,
  doc,
  onSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { CharterSpot, CrewMember, Trip, TripStatus, TripType, Cert, CrewRole } from '../charter/types';

export interface TripBriefState {
  trip: Trip | null;
  spotsById: Map<string, CharterSpot>;
  crewById: Map<string, CrewMember>;
  loading: boolean;
  error: string | null;
}

export function useTripBrief(
  orgId: string | null | undefined,
  tripId: string | null | undefined,
): TripBriefState {
  const [trip, setTrip] = React.useState<Trip | null>(null);
  const [spotsById, setSpotsById] = React.useState<Map<string, CharterSpot>>(new Map());
  const [crewById, setCrewById] = React.useState<Map<string, CrewMember>>(new Map());
  const [tripLoading, setTripLoading] = React.useState<boolean>(!!(orgId && tripId));
  const [supportLoading, setSupportLoading] = React.useState<boolean>(!!orgId);
  const [error, setError] = React.useState<string | null>(null);

  // ── Trip doc ──
  React.useEffect(() => {
    if (!orgId || !tripId || !db || !firebaseConfigured) {
      setTrip(null);
      setTripLoading(false);
      return;
    }
    setTripLoading(true);
    const unsub = onSnapshot(
      doc(db, 'charter_accounts', orgId, 'trips', tripId),
      (snap) => {
        if (!snap.exists()) {
          setTrip(null);
        } else {
          setTrip(tripFromDoc(snap.id, snap.data() as Record<string, unknown>));
        }
        setTripLoading(false);
      },
      (err) => {
        setError(err.message);
        setTrip(null);
        setTripLoading(false);
      },
    );
    return unsub;
  }, [orgId, tripId]);

  // ── Spots + crew rosters (one snapshot each) ──
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setSpotsById(new Map());
      setCrewById(new Map());
      setSupportLoading(false);
      return;
    }
    setSupportLoading(true);
    let spotsLoaded = false;
    let crewLoaded = false;
    const checkDone = () => {
      if (spotsLoaded && crewLoaded) setSupportLoading(false);
    };
    const unsubSpots = onSnapshot(
      collection(db, 'charter_accounts', orgId, 'spots'),
      (snap) => {
        const m = new Map<string, CharterSpot>();
        snap.forEach((d) => m.set(d.id, spotFromDoc(d.id, d.data() as Record<string, unknown>)));
        setSpotsById(m);
        spotsLoaded = true;
        checkDone();
      },
      (err) => { setError(err.message); spotsLoaded = true; checkDone(); },
    );
    const unsubCrew = onSnapshot(
      collection(db, 'charter_accounts', orgId, 'crew'),
      (snap) => {
        const m = new Map<string, CrewMember>();
        snap.forEach((d) => m.set(d.id, crewFromDoc(d.id, d.data() as Record<string, unknown>)));
        setCrewById(m);
        crewLoaded = true;
        checkDone();
      },
      (err) => { setError(err.message); crewLoaded = true; checkDone(); },
    );
    return () => { unsubSpots(); unsubCrew(); };
  }, [orgId]);

  return {
    trip,
    spotsById,
    crewById,
    loading: tripLoading || supportLoading,
    error,
  };
}

// ─── doc parsers (mirror useCharterData / useCrewTrips) ──────────────

function tripFromDoc(id: string, data: Record<string, unknown>): Trip {
  return {
    id,
    date: tsToDate(data.date) ?? new Date(0),
    departureTime: String(data.departureTime ?? ''),
    returnTime: String(data.returnTime ?? ''),
    departureHarbor: (data.departureHarbor as Trip['departureHarbor']) ?? { name: '', lat: 0, lng: 0 },
    spots: Array.isArray(data.spots) ? (data.spots as string[]) : [],
    crew: Array.isArray(data.crew) ? (data.crew as string[]) : [],
    headcount: typeof data.headcount === 'number' ? data.headcount : 0,
    tripType: tripTypeFromString(data.tripType),
    status: tripStatusFromString(data.status),
    manifest: Array.isArray(data.manifest) ? (data.manifest as Trip['manifest']) : [],
    floatPlanFiled: data.floatPlanFiled === true,
    briefingShareToken: typeof data.briefingShareToken === 'string' ? data.briefingShareToken : null,
    captainUid: typeof data.captainUid === 'string' && data.captainUid.length > 0 ? data.captainUid : null,
    conditionsSnapshot: (data.conditionsSnapshot ?? null) as Record<string, unknown> | null,
    captainsLog: (data.captainsLog ?? null) as Trip['captainsLog'],
  };
}

function spotFromDoc(id: string, data: Record<string, unknown>): CharterSpot {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : id,
    lat: typeof data.lat === 'number' ? data.lat : 0,
    lng: typeof data.lng === 'number' ? data.lng : 0,
    isPrivate: data.isPrivate === true,
    linkedPublicSpotId: typeof data.linkedPublicSpotId === 'string' ? data.linkedPublicSpotId : null,
    tripTypes: Array.isArray(data.tripTypes) ? (data.tripTypes as CharterSpot['tripTypes']) : [],
    maxGroupSize: typeof data.maxGroupSize === 'number' ? data.maxGroupSize : 0,
    depthFt: typeof data.depthFt === 'number' ? data.depthFt : 0,
    tidePreference: (data.tidePreference as CharterSpot['tidePreference']) ?? 'any',
    notes: typeof data.notes === 'string' ? data.notes : '',
    ...(data as Pick<CharterSpot, 'goodWindowAlertsEnabled'>),
  } as CharterSpot;
}

function crewFromDoc(id: string, data: Record<string, unknown>): CrewMember {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Unnamed crew',
    role: roleFromString(data.role),
    certs: Array.isArray(data.certs) ? (data.certs as unknown[]).map(parseCert) : [],
    uid: typeof data.uid === 'string' && data.uid.length > 0 ? data.uid : null,
  };
}

function parseCert(v: unknown): Cert {
  const c = (v ?? {}) as Record<string, unknown>;
  const expiresRaw = c.expiresAt as { toDate?: () => Date } | undefined;
  return {
    type: (c.type as Cert['type']) ?? 'CPR',
    issuedBy: typeof c.issuedBy === 'string' ? c.issuedBy : '',
    expiresAt: expiresRaw?.toDate?.() ?? new Date(0),
  };
}

function roleFromString(v: unknown): CrewRole {
  if (v === 'owner' || v === 'captain' || v === 'divemaster'
      || v === 'deckhand' || v === 'manager' || v === 'instructor') return v;
  return 'deckhand';
}

function tripStatusFromString(v: unknown): TripStatus {
  if (v === 'planned' || v === 'active' || v === 'completed' || v === 'cancelled') return v;
  return 'planned';
}

function tripTypeFromString(v: unknown): TripType {
  if (v === 'dive' || v === 'snorkel' || v === 'spearfishing' || v === 'freedive') return v;
  return 'snorkel';
}

function tsToDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw && 'toDate' in raw) {
    try { return (raw as Timestamp).toDate(); } catch { return null; }
  }
  return null;
}
