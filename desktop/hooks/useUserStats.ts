// useUserStats — read /users/{uid}/stats/summary, the single doc the
// aggregateUserStats Cloud Function rewrites on every diveLogs change.
// Neither client should compute these numbers at render time.

import React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';

export interface UserStats {
  totalDives: number;
  /** Seconds. */
  totalBottomTime: number;
  /** Feet. */
  deepestDive: number;
  /** Seconds. */
  longestDive: number;
  speciesCount: number;
  spotsLogged: number;
  /** Consecutive HST days ending today. */
  currentStreak: number;
  updatedAt: Date | null;
}

type State = {
  stats: UserStats | null;
  loading: boolean;
};

const EMPTY_STATS: UserStats = {
  totalDives: 0,
  totalBottomTime: 0,
  deepestDive: 0,
  longestDive: 0,
  speciesCount: 0,
  spotsLogged: 0,
  currentStreak: 0,
  updatedAt: null,
};

export function useUserStats(uid: string | null | undefined): State {
  const [state, setState] = React.useState<State>({ stats: null, loading: !!uid });

  React.useEffect(() => {
    if (!uid) {
      setState({ stats: null, loading: false });
      return;
    }
    if (!firebaseConfigured || !db) {
      setState({ stats: null, loading: false });
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', uid, 'stats', 'summary'),
      (snap) => {
        if (!snap.exists()) {
          // First-time user — the aggregator hasn't run yet because they
          // haven't logged a dive. Surface zeros rather than null so the
          // UI doesn't have to special-case the empty state.
          setState({ stats: EMPTY_STATS, loading: false });
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        setState({
          loading: false,
          stats: {
            totalDives: num(d.totalDives),
            totalBottomTime: num(d.totalBottomTime),
            deepestDive: num(d.deepestDive),
            longestDive: num(d.longestDive),
            speciesCount: num(d.speciesCount),
            spotsLogged: num(d.spotsLogged),
            currentStreak: num(d.currentStreak),
            updatedAt: toDate(d.updatedAt),
          },
        });
      },
      () => setState({ stats: null, loading: false }),
    );
    return unsub;
  }, [uid]);

  return state;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
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
