// useFareHarbor — read today's confirmed bookings for the operator's
// FareHarbor integration. We do NOT call FareHarbor from the device —
// a cron in functions/charter/fareharbor/sync.js pulls the data into
// charter_accounts/{orgId}/fh_trips/{pk} every 10 minutes. This hook
// just reads that mirror and shapes it into CharterLogTrip stubs.
//
// On-demand refresh: callers can invoke `syncNow()` to trigger the
// callable `syncFareHarborTripsCallable` for immediate refresh
// before reading. Useful for the "pull-to-refresh" gesture and the
// initial open of the daily log.

import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';

import { db, firebaseConfigured, app as firebaseApp } from '@/firebase';
import {
  type CharterLogTrip,
  type TripType,
  emptyAbyssConditions,
  emptyObservedConditions,
  hstDateKey,
} from '@/types/charterLog';

type FhTripDoc = {
  orgId: string;
  fhItemPk: number;
  fhAvailabilityPk: number;
  tripName: string;
  date: string;        // YYYY-MM-DD (FareHarbor local)
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  booked: number;
  capacity: number;
  cancelled: boolean;
  tripType: string | null;
  boatIds: string[];
  harborId: string | null;
  kaicastSpotIds: string[];
  lastSynced: { toMillis?: () => number } | null;
};

/** Map a FareHarbor trip type to our internal enum. Unknown → 'other'. */
function normalizeTripType(raw: string | null | undefined): TripType {
  if (!raw) return 'other';
  const t = raw.toLowerCase();
  if (t.includes('snorkel')) return 'snorkel';
  if (t.includes('freedive')) return 'freedive';
  if (t.includes('scuba') || t.includes('dive')) return 'scuba';
  if (t.includes('sunset')) return 'sunset';
  if (t.includes('whale')) return 'whale_watch';
  return 'other';
}

/**
 * Build an empty CharterLogTrip stub from a FareHarbor fh_trips doc.
 * The captain fills in observed conditions, species, etc. on top of
 * this skeleton. Per-guest manifest is a future task — fh_trips
 * doesn't denormalize bookings, so `guests` starts empty and we
 * surface the booked count via `passengerCount`.
 */
function fhDocToTripStub(pk: string, d: FhTripDoc): CharterLogTrip {
  const primarySpot = d.kaicastSpotIds?.[0] ?? '';
  return {
    tripId: pk,
    tripNum: 0, // assigned by the caller once sorted by departure time
    title: d.tripName || '(untitled trip)',
    type: normalizeTripType(d.tripType),
    departureTime: d.startTime || '',
    returnTime: d.endTime || '',
    passengerCount: d.booked || 0,
    primarySite: primarySpot,
    secondarySite: '',
    coordinates: '',
    maxDepth: '',
    duration: '',
    siteNotes: '',
    fareharborBookingId: pk,
    guests: [],
    abyssConditions: emptyAbyssConditions(),
    observedConditions: emptyObservedConditions(),
    speciesObserved: [],
    incident: 'None',
    coastGuardNotification: false,
    dlnrNotification: false,
    equipmentNotes: '',
    complete: false,
  };
}

type State = {
  trips: CharterLogTrip[];
  loading: boolean;
  /** Last-synced timestamp from the freshest fh_trips doc seen. */
  lastSynced: number | null;
  error: string | null;
};

/**
 * Subscribe to today's (HST) bookings for an operator. Cancelled
 * bookings are filtered out client-side. Trips arrive ordered by
 * departureTime ascending and tripNum is reassigned 1-based.
 */
export function useFareHarbor(
  orgId: string | undefined,
  dateMs: number,
): State & { syncNow: () => Promise<void> } {
  const [state, setState] = useState<State>({
    trips: [],
    loading: !!orgId,
    lastSynced: null,
    error: null,
  });

  const dateKey = hstDateKey(dateMs);

  useEffect(() => {
    if (!orgId || !firebaseConfigured || !db) {
      setState({ trips: [], loading: false, lastSynced: null, error: null });
      return;
    }
    const q = query(
      collection(db, 'charter_accounts', orgId, 'fh_trips'),
      where('date', '==', dateKey),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const trips: CharterLogTrip[] = [];
        let newest = 0;
        snap.forEach((docSnap) => {
          const d = docSnap.data() as FhTripDoc;
          if (d.cancelled) return;
          trips.push(fhDocToTripStub(docSnap.id, d));
          const ts = d.lastSynced?.toMillis?.() ?? 0;
          if (ts > newest) newest = ts;
        });
        trips.sort((a, b) => (a.departureTime ?? '').localeCompare(b.departureTime ?? ''));
        trips.forEach((t, i) => { t.tripNum = i + 1; });
        setState({ trips, loading: false, lastSynced: newest || null, error: null });
      },
      (err) => {
        setState({ trips: [], loading: false, lastSynced: null, error: err.message });
      },
    );
    return unsub;
  }, [orgId, dateKey]);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!firebaseApp) return;
    try {
      const fns = getFunctions(firebaseApp, 'us-central1');
      // The cron's per-charter handler is also exposed as a callable so
      // captains can pull fresh data on demand without waiting for the
      // 10-minute tick. See functions/charter/fareharbor/sync.js.
      await httpsCallable(fns, 'syncFareHarborTripsCallable')({ orgId });
    } catch (err) {
      // Surface to UI via state so the caller can toast it.
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Sync failed' }));
    }
  }, [orgId]);

  return { ...state, syncNow };
}
