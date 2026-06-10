// useCharterAccount — mobile mirror of desktop/charter/useCharterData.ts's
// useCharterAccount + useCharterSpots, narrowed to the fields the mobile
// charter map needs: harbors (+ which vessels dock at each), the fleet
// (vessel names), and the operating-spot library (name + coords).
//
// The mobile charter dashboard is otherwise mock (useCharterRole); this
// is the one place it reads the REAL charter_accounts/{orgId} doc so the
// map can plot actual harbor / spots / vessels. Returns empty + not-
// loading whenever orgId is absent or Firebase isn't configured (stub /
// Expo Go), so callers can fall back to a Hawaii-centered empty map.

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';

/** A vessel in the org fleet (charter_accounts/{orgId}.fleet[]). */
export interface CharterVessel {
  vesselId: string;
  name: string;
}

/** An org-owned harbor (charter_accounts/{orgId}.harbors[]). */
export interface CharterHarbor {
  harborId: string;
  name: string;
  lat: number;
  lng: number;
  /** 'home' | 'loading' | 'both' — the map centers on a home/both harbor. */
  role: string;
  /** vesselIds docked here; map popup resolves these to fleet names. */
  vesselIds: string[];
}

/** An operating location (charter_accounts/{orgId}/spots/{id}). */
export interface CharterOrgSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface CharterAccount {
  name: string;
  fleet: CharterVessel[];
  harbors: CharterHarbor[];
  /** Legacy single-harbor field, used as a fallback for the map center. */
  homeHarbor: { name: string; lat: number; lng: number } | null;
}

export interface CharterAccountState {
  account: CharterAccount | null;
  spots: CharterOrgSpot[];
  loading: boolean;
  error: string | null;
}

export function useCharterAccount(orgId: string | null | undefined): CharterAccountState {
  const [state, setState] = useState<CharterAccountState>({
    account: null,
    spots: [],
    loading: !!orgId,
    error: null,
  });

  // Account doc.
  useEffect(() => {
    if (!orgId || !firebaseConfigured || !db) {
      setState((s) => ({ ...s, account: null, loading: false, error: null }));
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'charter_accounts', orgId),
      (snap) => {
        if (!snap.exists()) {
          setState((s) => ({ ...s, account: null, loading: false, error: null }));
          return;
        }
        setState((s) => ({ ...s, account: accountFromDoc(snap.data() as any), loading: false, error: null }));
      },
      (err) => setState((s) => ({ ...s, account: null, loading: false, error: err.message })),
    );
    return unsub;
  }, [orgId]);

  // Operating-spot library.
  useEffect(() => {
    if (!orgId || !firebaseConfigured || !db) {
      setState((s) => ({ ...s, spots: [] }));
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'charter_accounts', orgId, 'spots')),
      (snap) => {
        const spots = snap.docs
          .map((d) => spotFromDoc(d.id, d.data() as any))
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
        setState((s) => ({ ...s, spots }));
      },
      () => setState((s) => ({ ...s, spots: [] })),
    );
    return unsub;
  }, [orgId]);

  return state;
}

function accountFromDoc(data: any): CharterAccount {
  const fleet: CharterVessel[] = Array.isArray(data.fleet)
    ? data.fleet
        .map((v: any) => ({ vesselId: String(v?.vesselId ?? ''), name: String(v?.name ?? 'Vessel') }))
        .filter((v: CharterVessel) => v.vesselId.length > 0)
    : [];
  const harbors: CharterHarbor[] = Array.isArray(data.harbors)
    ? data.harbors.map((h: any) => ({
        harborId: String(h?.harborId ?? ''),
        name: String(h?.name ?? 'Harbor'),
        lat: typeof h?.lat === 'number' ? h.lat : NaN,
        lng: typeof h?.lng === 'number' ? h.lng : NaN,
        role: typeof h?.role === 'string' ? h.role : 'home',
        vesselIds: Array.isArray(h?.vesselIds) ? h.vesselIds.map(String) : [],
      }))
    : [];
  const hh = data.homeHarbor;
  const homeHarbor =
    hh && typeof hh.lat === 'number' && typeof hh.lng === 'number'
      ? { name: String(hh.name ?? 'Harbor'), lat: hh.lat, lng: hh.lng }
      : null;
  return { name: String(data.name ?? '—'), fleet, harbors, homeHarbor };
}

function spotFromDoc(id: string, data: any): CharterOrgSpot {
  return {
    id,
    name: String(data?.name ?? 'Spot'),
    lat: typeof data?.lat === 'number' ? data.lat : NaN,
    lng: typeof data?.lng === 'number' ? data.lng : NaN,
  };
}

/** Pick the harbor the map should center on: a home/both harbor first,
 *  else the first harbor, else the legacy homeHarbor, else null. */
export function primaryHarbor(account: CharterAccount | null): CharterHarbor | null {
  if (!account) return null;
  const valid = account.harbors.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
  const home = valid.find((h) => h.role === 'home' || h.role === 'both');
  if (home) return home;
  if (valid.length > 0) return valid[0];
  if (account.homeHarbor) {
    return {
      harborId: 'home',
      name: account.homeHarbor.name,
      lat: account.homeHarbor.lat,
      lng: account.homeHarbor.lng,
      role: 'home',
      vesselIds: [],
    };
  }
  return null;
}

/** Resolve a harbor's docked-vessel names. Falls back to the whole
 *  fleet when the harbor has no explicit vesselIds. */
export function harborVesselNames(account: CharterAccount | null, harbor: CharterHarbor | null): string[] {
  if (!account || !harbor) return [];
  if (harbor.vesselIds.length === 0) return account.fleet.map((v) => v.name);
  const byId = new Map(account.fleet.map((v) => [v.vesselId, v.name]));
  return harbor.vesselIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
}
