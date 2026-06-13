// useUserDiveLogs — desktop equivalent of mobile's useUserDiveLogs.
// Subscribes to diveLogs where uid == this user.
//
// The submitDiveLog callable writes snake_case docs ordered by
// logged_at; pre-path-B client writes used camelCase loggedAt.
// orderBy silently drops docs missing its field, so a single query
// can only ever see one generation — we subscribe to both shapes and
// merge until the legacy docs are migrated (mirrors the mobile hook).

import React from 'react';
import {
  collection,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';

export interface DiveLogRecord {
  id: string;
  uid: string;
  spotId: string;
  customSpotName: string | null;
  diveType: string | null;
  diveAt: Date | null;
  loggedAt: Date | null;
  depthFt: number | null;
  durationMin: number | null;
  visibilityFt: number | null;
  surfaceState: string | null;     // glassy | light_chop | whitecaps | breaking (or legacy safe/choppy/rough)
  currentStrength: string | null;  // none | light | moderate | strong
  surgeAtDepth: string | null;     // none | mild | strong
  speciesSeen: string[];
  overallRating: 'poor' | 'fair' | 'good' | 'excellent' | null;
  waterTempF: number | null;
  notes: string | null;
  privacy: 'public' | 'friends' | 'private' | null;
  photos: string[];
}

type State = {
  logs: DiveLogRecord[];
  loading: boolean;
};

export function useUserDiveLogs(uid: string | null | undefined, max = 50): State {
  const [state, setState] = React.useState<State>({ logs: [], loading: !!uid });

  React.useEffect(() => {
    if (!uid) {
      setState({ logs: [], loading: false });
      return;
    }
    if (!firebaseConfigured || !db) {
      setState({ logs: [], loading: false });
      return;
    }
    const col = collection(db, 'diveLogs');
    const queries = [
      query(col, where('uid', '==', uid), orderBy('logged_at', 'desc'), fbLimit(max)),
      query(col, where('uid', '==', uid), orderBy('loggedAt', 'desc'), fbLimit(max)),
    ];
    const buckets: DiveLogRecord[][] = queries.map(() => []);
    const publish = () => {
      const seen = new Set<string>();
      const merged = buckets
        .flat()
        .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
        .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0))
        .slice(0, max);
      setState({ logs: merged, loading: false });
    };
    const unsubs = queries.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          buckets[i] = snap.docs.map((d) => normalize(d.id, d.data() as Record<string, unknown>));
          publish();
        },
        (err) => {
          console.warn('[useUserDiveLogs] subscription error', err);
          buckets[i] = [];
          publish();
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [uid, max]);

  return state;
}

function normalize(id: string, data: Record<string, unknown>): DiveLogRecord {
  const d = data as any;
  if (d.spot_id != null) {
    // Path-B doc written by the submitDiveLog callable.
    const o = d.observed ?? {};
    return {
      id,
      uid: String(d.uid ?? ''),
      spotId: String(d.spot_id),
      customSpotName: d.custom_spot?.name ?? null,
      diveType: typeof d.dive_type === 'string' ? d.dive_type : null,
      diveAt: toDate(d.dive_at),
      // logged_at is a serverTimestamp — null on the local latency
      // snapshot until the write commits; dive_at stands in.
      loggedAt: toDate(d.logged_at) ?? toDate(d.dive_at),
      depthFt: num(o.max_depth_ft ?? d.scuba?.maxDepthFt),
      durationMin: num(o.duration_min),
      visibilityFt: num(o.visibility_ft),
      surfaceState: str(o.surface_state),
      currentStrength: str(o.current_strength),
      surgeAtDepth: str(o.surge_at_depth),
      speciesSeen: Array.isArray(o.species_seen) ? o.species_seen.map(String) : [],
      overallRating: ratingOf(o.overall_rating),
      waterTempF: num(o.water_temp_surface_f ?? o.water_temp_bottom_f),
      notes: str(d.notes),
      privacy: privacyOf(d.privacy),
      photos: Array.isArray(d.photos) ? d.photos.map(String) : [],
    };
  }
  // Legacy camelCase doc written client-side pre-path-B.
  return {
    id,
    uid: String(d.uid ?? ''),
    spotId: String(d.spotId ?? ''),
    customSpotName: d.customSpot?.name ?? null,
    diveType: str(d.diveType),
    diveAt: toDate(d.loggedAt),
    loggedAt: toDate(d.loggedAt),
    depthFt: num(d.depthFt ?? d.scuba?.maxDepthFt),
    durationMin: num(d.durationMin),
    visibilityFt: null,
    surfaceState: str(d.surface),
    currentStrength: str(d.current),
    surgeAtDepth: null,
    speciesSeen: [],
    overallRating: null,
    waterTempF: num(d.waterTempF),
    notes: str(d.notes),
    privacy: privacyOf(d.privacy),
    photos: Array.isArray(d.photos) ? d.photos.map(String) : [],
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length ? v : null;
}

function ratingOf(v: unknown): DiveLogRecord['overallRating'] {
  return v === 'poor' || v === 'fair' || v === 'good' || v === 'excellent' ? v : null;
}

function privacyOf(v: unknown): DiveLogRecord['privacy'] {
  return v === 'public' || v === 'friends' || v === 'private' ? v : null;
}

function toDate(v: unknown): Date | null {
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}
