// Live-subscription hooks for the FareHarbor surface:
//
//   useFareHarborIntegration(orgId) → /charter_accounts/{orgId}/integrations/fareharbor
//   useFareHarborItems(orgId)       → /charter_accounts/{orgId}/fh_items/*
//   useHarbors()                    → /harbors/* (global, public)
//
// All use onSnapshot so connection state, sync progress, and the
// product list reflect the latest server state without a refresh.

import React from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../../firebase';
import type { FhIntegration, FhItem, HarborDoc, FhTrip, FhTripType } from './types';

// ─── Integration doc ────────────────────────────────────────────────

export type FhIntegrationState = {
  integration: FhIntegration | null;
  loading: boolean;
  error: string | null;
};

export function useFareHarborIntegration(orgId: string | null | undefined): FhIntegrationState {
  const [state, setState] = React.useState<FhIntegrationState>({
    integration: null, loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ integration: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      doc(db, 'charter_accounts', orgId, 'integrations', 'fareharbor'),
      (snap) => {
        if (!snap.exists()) {
          setState({ integration: null, loading: false, error: null });
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        setState({
          integration: {
            shortname:    String(d.shortname ?? ''),
            userApiKey:   String(d.userApiKey ?? ''),
            connectedAt:  toDate(d.connectedAt),
            lastSync:     toDate(d.lastSync),
            syncStatus:   (d.syncStatus === 'ok' || d.syncStatus === 'error' || d.syncStatus === 'pending')
                            ? d.syncStatus
                            : null,
            errorMsg:     typeof d.errorMsg === 'string' ? d.errorMsg : null,
            tripCount:    typeof d.tripCount === 'number' ? d.tripCount : 0,
            itemCount:    typeof d.itemCount === 'number' ? d.itemCount : 0,
          },
          loading: false,
          error: null,
        });
      },
      (err) => setState({ integration: null, loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

// ─── fh_items collection ─────────────────────────────────────────────

export type FhItemsState = {
  items: FhItem[];
  loading: boolean;
  error: string | null;
};

export function useFareHarborItems(orgId: string | null | undefined): FhItemsState {
  const [state, setState] = React.useState<FhItemsState>({
    items: [], loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      query(
        collection(db, 'charter_accounts', orgId, 'fh_items'),
        orderBy('name', 'asc'),
      ),
      (snap) => {
        const items = snap.docs.map((d) => fhItemFromDoc(d.data() as Record<string, unknown>));
        setState({ items, loading: false, error: null });
      },
      (err) => setState({ items: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

function fhItemFromDoc(d: Record<string, unknown>): FhItem {
  const tt = d.tripType;
  const isFhTripType = (v: unknown): v is FhTripType =>
    v === 'spearfishing' || v === 'freediving' || v === 'scuba' || v === 'snorkel' ||
    v === 'fishing' || v === 'sunset' || v === 'whale_watch' || v === 'manta_ray' || v === 'other';
  return {
    fhItemPk:        typeof d.fhItemPk === 'number' ? d.fhItemPk : 0,
    name:            String(d.name ?? ''),
    headline:        String(d.headline ?? ''),
    description:     String(d.description ?? ''),
    maxCapacity:     typeof d.maxCapacity === 'number' ? d.maxCapacity : 0,
    durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : 0,
    lastSynced:      toDate(d.lastSynced),
    tripType:        isFhTripType(tt) ? tt : null,
    boatIds:         Array.isArray(d.boatIds) ? (d.boatIds as string[]) : [],
    harborId:        typeof d.harborId === 'string' ? d.harborId : null,
    kaicastSpotIds:  Array.isArray(d.kaicastSpotIds) ? (d.kaicastSpotIds as string[]) : [],
    notes:           typeof d.notes === 'string' ? d.notes : '',
    enriched:        d.enriched === true,
  };
}

// ─── fh_trips collection ─────────────────────────────────────────────

export type FhTripsState = {
  trips: FhTrip[];
  loading: boolean;
  error: string | null;
};

export interface FhTripsFilter {
  /** Inclusive lower bound on the trip's `date` field (YYYY-MM-DD, HST). */
  fromDate?: string;
  /** Inclusive upper bound on the trip's `date` field. */
  toDate?: string;
  /** Hide cancelled trips. Defaults to true. */
  hideCancelled?: boolean;
}

/** Live list of fh_trips for an org. Sorted by date asc, startTime asc
 *  so the timeline reads chronologically. We compose the where()
 *  clauses defensively: if the caller passes no fromDate we still
 *  need an orderBy on `date` for the sort, which works on its own. */
export function useFareHarborTrips(
  orgId: string | null | undefined,
  filter: FhTripsFilter = {},
): FhTripsState {
  const { fromDate, toDate, hideCancelled = true } = filter;
  const [state, setState] = React.useState<FhTripsState>({
    trips: [], loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ trips: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    const constraints: QueryConstraint[] = [];
    if (fromDate) constraints.push(where('date', '>=', fromDate));
    if (toDate)   constraints.push(where('date', '<=', toDate));
    constraints.push(orderBy('date', 'asc'));
    constraints.push(orderBy('startTime', 'asc'));

    const unsub = onSnapshot(
      query(collection(db, 'charter_accounts', orgId, 'fh_trips'), ...constraints),
      (snap) => {
        const trips = snap.docs
          .map((d) => fhTripFromDoc(d.data() as Record<string, unknown>))
          .filter((t) => (hideCancelled ? !t.cancelled : true));
        setState({ trips, loading: false, error: null });
      },
      (err) => setState({ trips: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId, fromDate, toDate, hideCancelled]);
  return state;
}

function fhTripFromDoc(d: Record<string, unknown>): FhTrip {
  const tt = d.tripType;
  const isFhTripType = (v: unknown): v is FhTripType =>
    v === 'spearfishing' || v === 'freediving' || v === 'scuba' || v === 'snorkel' ||
    v === 'fishing' || v === 'sunset' || v === 'whale_watch' || v === 'manta_ray' || v === 'other';
  return {
    fhAvailabilityPk: typeof d.fhAvailabilityPk === 'number' ? d.fhAvailabilityPk : 0,
    fhItemPk:         typeof d.fhItemPk === 'number' ? d.fhItemPk : 0,
    tripName:         String(d.tripName ?? ''),
    date:             String(d.date ?? ''),
    startTime:        String(d.startTime ?? ''),
    endTime:          String(d.endTime ?? ''),
    booked:           typeof d.booked === 'number' ? d.booked : 0,
    capacity:         typeof d.capacity === 'number' ? d.capacity : 0,
    cancelled:        d.cancelled === true,
    cancelledAt:      toDate(d.cancelledAt),
    tripType:         isFhTripType(tt) ? tt : null,
    boatIds:          Array.isArray(d.boatIds) ? (d.boatIds as string[]) : [],
    harborId:         typeof d.harborId === 'string' ? d.harborId : null,
    kaicastSpotIds:   Array.isArray(d.kaicastSpotIds) ? (d.kaicastSpotIds as string[]) : [],
    lastSynced:       toDate(d.lastSynced),
  };
}

// ─── /harbors global collection ──────────────────────────────────────

export type HarborsState = {
  harbors: HarborDoc[];
  loading: boolean;
  error: string | null;
};

export function useHarbors(): HarborsState {
  const [state, setState] = React.useState<HarborsState>({ harbors: [], loading: true, error: null });
  React.useEffect(() => {
    if (!db || !firebaseConfigured) {
      setState({ harbors: [], loading: false, error: null });
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'harbors'), orderBy('island', 'asc'), orderBy('name', 'asc')),
      (snap) => {
        const harbors = snap.docs.map((d) => harborFromDoc(d.data() as Record<string, unknown>));
        setState({ harbors, loading: false, error: null });
      },
      (err) => setState({ harbors: [], loading: false, error: err.message }),
    );
    return unsub;
  }, []);
  return state;
}

function harborFromDoc(d: Record<string, unknown>): HarborDoc {
  const island = d.island;
  const validIsland = (v: unknown): v is HarborDoc['island'] =>
    v === 'oahu' || v === 'maui' || v === 'big_island' || v === 'kauai' || v === 'molokai' || v === 'lanai';
  return {
    harborId: String(d.harborId ?? ''),
    name:     String(d.name ?? ''),
    island:   validIsland(island) ? island : 'oahu',
    lat:      typeof d.lat === 'number' ? d.lat : 0,
    lng:      typeof d.lng === 'number' ? d.lng : 0,
    aka:      Array.isArray(d.aka) ? (d.aka as string[]) : [],
  };
}

// ─── shared ─────────────────────────────────────────────────────────

function toDate(v: unknown): Date | null {
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try { return (v as { toDate: () => Date }).toDate(); } catch { return null; }
  }
  return null;
}
