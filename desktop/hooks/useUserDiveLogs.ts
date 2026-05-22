// useUserDiveLogs — desktop equivalent of mobile's useUserDiveLogs.
// Subscribes to diveLogs where uid == this user, ordered by loggedAt.
// Firestore rules currently allow read only to the authed author OR
// for any log a guide has verified — so on the desktop ProfileScreen
// the viewer sees their own logs but won't see logs from other users
// until the public-feed flag lands.

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
  diveType: string | null;
  loggedAt: Date | null;
  depthFt: number | null;
  durationMin: number | null;
  visibility: string | null;
  surface: string | null;
  current: string | null;
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
    const q = query(
      collection(db, 'diveLogs'),
      where('uid', '==', uid),
      orderBy('loggedAt', 'desc'),
      fbLimit(max),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setState({
          loading: false,
          logs: snap.docs.map((d) => normalize(d.id, d.data() as Record<string, unknown>)),
        });
      },
      () => setState({ logs: [], loading: false }),
    );
    return unsub;
  }, [uid, max]);

  return state;
}

function normalize(id: string, data: Record<string, unknown>): DiveLogRecord {
  return {
    id,
    uid: String(data.uid ?? ''),
    spotId: String(data.spotId ?? ''),
    diveType: typeof data.diveType === 'string' ? data.diveType : null,
    loggedAt: toDate(data.loggedAt),
    depthFt: num(data.depthFt ?? (data as any)?.scuba?.maxDepthFt ?? (data as any)?.observed?.max_depth_ft),
    durationMin: num(data.durationMin ?? (data as any)?.observed?.duration_min),
    visibility: typeof data.visibility === 'string' ? data.visibility : null,
    surface: typeof data.surface === 'string' ? data.surface : null,
    current: typeof data.current === 'string' ? data.current : null,
    waterTempF: num(data.waterTempF),
    notes: typeof data.notes === 'string' ? data.notes : null,
    privacy:
      data.privacy === 'public' || data.privacy === 'friends' || data.privacy === 'private'
        ? (data.privacy as 'public' | 'friends' | 'private')
        : null,
    photos: Array.isArray(data.photos) ? (data.photos as string[]) : [],
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
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
