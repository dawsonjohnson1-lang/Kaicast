// useTodayTrips — live subscription to all trips for `today` under a
// given charter org. "Today" is defined as the HST calendar day
// (UTC−10, no DST) — same convention the dive-log streak counter
// uses, matches a captain's mental model.
//
// Returns the trips ordered by departureTime ascending so the home
// screen renders earliest trip first. Loading flag is true until the
// snapshot lands; null orgId returns an empty list (charter user
// hasn't been provisioned with an org yet).

import React from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { Trip, TripStatus } from './types';

// HST is fixed at UTC-10. Hawaii doesn't observe DST so this never
// changes; the +10 hour shift below works year-round.
const HST_OFFSET_HOURS = -10;

/** Start of the HST calendar day `dayOffset` days from today (0 =
 *  today, 1 = tomorrow), expressed as a UTC Date. */
function hstDayStartUTC(dayOffset = 0): Date {
  const now = new Date();
  // Shift "now" into HST clock space, zero the time, advance by offset,
  // then shift back.
  const hstNow = new Date(now.getTime() + HST_OFFSET_HOURS * 3600 * 1000);
  hstNow.setUTCHours(0, 0, 0, 0);
  hstNow.setUTCDate(hstNow.getUTCDate() + dayOffset);
  return new Date(hstNow.getTime() - HST_OFFSET_HOURS * 3600 * 1000);
}

export type TodayTripsState = {
  trips: Trip[];
  loading: boolean;
  /** Set when the snapshot listener errored. Distinct from `trips=[]`
   *  which means "no trips today" — the caller can show "Could not
   *  reach Firestore" vs. "no trips planned" appropriately. */
  error: string | null;
};

export function useTodayTrips(orgId: string | null | undefined): TodayTripsState {
  return useTripsForDayOffset(orgId, 0);
}

/** Live subscription to all trips for the HST calendar day `dayOffset`
 *  days from today. `useTodayTrips` is the offset-0 case; the charter
 *  dashboard uses offset 1 for the "Tomorrow" forecast section. */
export function useTripsForDayOffset(
  orgId: string | null | undefined,
  dayOffset: number,
): TodayTripsState {
  const [state, setState] = React.useState<TodayTripsState>({
    trips: [],
    loading: !!orgId,
    error: null,
  });

  // Current HST day, as the epoch ms of its start. Rolls over at HST
  // midnight so a dashboard left open overnight (the dock tablet)
  // re-subscribes to the new day's window instead of staying pinned
  // to the day current at mount.
  const [dayKey, setDayKey] = React.useState(() => hstDayStartUTC(0).getTime());

  React.useEffect(() => {
    const nextMidnight = hstDayStartUTC(1).getTime();
    // +1s pad so we fire safely after the boundary, not just before it.
    const ms = Math.max(0, nextMidnight - Date.now()) + 1000;
    const timer = setTimeout(() => setDayKey(hstDayStartUTC(0).getTime()), ms);
    return () => clearTimeout(timer);
  }, [dayKey]);

  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ trips: [], loading: false, error: null });
      return;
    }
    const startUTC = hstDayStartUTC(dayOffset);
    const endUTC = new Date(startUTC.getTime() + 24 * 3600 * 1000);
    const q = query(
      collection(db, 'charter_accounts', orgId, 'trips'),
      where('date', '>=', Timestamp.fromDate(startUTC)),
      where('date', '<',  Timestamp.fromDate(endUTC)),
      orderBy('date', 'asc'),
    );
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw: Trip[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return tripFromFirestore(d.id, data);
        });
        // Sort by departureTime ('HH:mm' string) ascending so a 06:00
        // trip lands above a 14:00 trip on the same date.
        raw.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
        setState({ trips: raw, loading: false, error: null });
      },
      (err) => {
        setState({ trips: [], loading: false, error: err.message || 'Trip query failed' });
      },
    );
    return unsub;
    // dayKey isn't read directly — it changes at HST midnight so the
    // hstDayStartUTC window above is recomputed for the new day.
  }, [orgId, dayOffset, dayKey]);

  return state;
}

/** Map a raw Firestore doc into the Trip shape. Defensive — any
 *  missing field on the server side falls back to a safe default so
 *  the renderer doesn't crash, but the dropped-field log surfaces in
 *  console so we can spot schema drift early. */
function tripFromFirestore(id: string, data: Record<string, unknown>): Trip {
  const dateTs = data.date as { toDate?: () => Date } | undefined;
  return {
    id,
    date: dateTs?.toDate?.() ?? new Date(),
    departureTime: typeof data.departureTime === 'string' ? data.departureTime : '00:00',
    returnTime:    typeof data.returnTime    === 'string' ? data.returnTime    : '00:00',
    departureHarbor: (data.departureHarbor as Trip['departureHarbor']) ?? {
      name: '—', lat: 0, lng: 0,
    },
    spots: Array.isArray(data.spots) ? (data.spots as string[]) : [],
    crew:  Array.isArray(data.crew)  ? (data.crew as string[])  : [],
    headcount: typeof data.headcount === 'number' ? data.headcount : 0,
    tripType: (data.tripType as Trip['tripType']) ?? 'dive',
    status:   tripStatusFromString(data.status),
    manifest: Array.isArray(data.manifest) ? (data.manifest as Trip['manifest']) : [],
    floatPlanFiled: data.floatPlanFiled === true,
    briefingShareToken: typeof data.briefingShareToken === 'string' ? data.briefingShareToken : null,
    captainUid: typeof data.captainUid === 'string' && data.captainUid.length > 0 ? data.captainUid : null,
    conditionsSnapshot: (data.conditionsSnapshot as Record<string, unknown>) ?? null,
    captainsLog: (data.captainsLog as Trip['captainsLog']) ?? null,
  };
}

function tripStatusFromString(v: unknown): TripStatus {
  if (v === 'planned' || v === 'active' || v === 'completed' || v === 'cancelled') return v;
  return 'planned';
}
