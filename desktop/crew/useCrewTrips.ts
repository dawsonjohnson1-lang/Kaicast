// useCrewTrips — trips the caller is assigned to at the active org.
//
// Builds on useCrewSelf: we first need the user's own crew record id
// (the trip docs store crew as an array of crew-record ids, NOT user
// uids — denormalized at trip-creation time). Once we have that, we
// run a single array-contains query against /charter_accounts/{orgId}/trips.
//
// While the crew record is loading or absent, we return `loading` /
// `member: null` semantics rather than firing an empty trip list —
// otherwise the screen would flash "no trips" before the chain
// resolves.

import React from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import { useCrewSelf } from './useCrewSelf';
import type { Trip, TripStatus, TripType } from '../charter/types';

export interface CrewTripsState {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  /** True when the user has no crew record at this org yet. The screen
   *  uses this to show a different empty state vs. "no trips assigned". */
  noCrewRecord: boolean;
}

export function useCrewTrips(orgId: string | null | undefined): CrewTripsState {
  const { member, loading: selfLoading } = useCrewSelf(orgId);
  const crewMemberId = member?.id ?? null;

  const [state, setState] = React.useState<CrewTripsState>({
    trips: [],
    loading: !!(orgId && crewMemberId),
    error: null,
    noCrewRecord: false,
  });

  React.useEffect(() => {
    // While the self lookup is still in flight, hold steady.
    if (selfLoading) {
      setState((s) => ({ ...s, loading: true, noCrewRecord: false }));
      return;
    }
    if (!orgId || !db || !firebaseConfigured) {
      setState({ trips: [], loading: false, error: null, noCrewRecord: false });
      return;
    }
    if (!crewMemberId) {
      setState({ trips: [], loading: false, error: null, noCrewRecord: true });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null, noCrewRecord: false }));
    const q = query(
      collection(db, 'charter_accounts', orgId, 'trips'),
      where('crew', 'array-contains', crewMemberId),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const trips = snap.docs.map((d) => tripFromDoc(d.id, d.data() as Record<string, unknown>));
        setState({ trips, loading: false, error: null, noCrewRecord: false });
      },
      (err) => setState({ trips: [], loading: false, error: err.message, noCrewRecord: false }),
    );
    return unsub;
  }, [orgId, crewMemberId, selfLoading]);

  return state;
}

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
    // The remaining structured fields aren't needed by the crew trip
    // list — the trip detail screen (Slice D3) reads them. Cast-through
    // keeps the type happy without us materializing every nested struct
    // (conditionsSnapshot, captainsLog, etc.) here.
    ...(data as Pick<Trip, 'conditionsSnapshot' | 'captainsLog'>),
  } as Trip;
}

function tsToDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw && 'toDate' in raw) {
    try { return (raw as Timestamp).toDate(); } catch { return null; }
  }
  return null;
}

function tripStatusFromString(v: unknown): TripStatus {
  if (v === 'planned' || v === 'active' || v === 'completed' || v === 'cancelled') return v;
  return 'planned';
}

function tripTypeFromString(v: unknown): TripType {
  if (v === 'dive' || v === 'snorkel' || v === 'spearfishing' || v === 'freedive') return v;
  return 'snorkel';
}
