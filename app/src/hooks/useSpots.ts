// Single source of truth for the spots list across the app.
//
// When Firebase is configured, fetches from the `spots` Firestore
// collection. When not, falls back to the static mockData list so the
// app stays usable in demo mode.
//
// Bootstrapping the Firestore collection: see scripts/seedSpots.mjs
// which reads from the same mockData list and writes one doc per spot
// keyed by spot.id. Run it once with admin credentials, then this
// hook returns the live data.

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import { exploreSpots as fallbackSpots } from '@/api/mockData';
import type { Spot } from '@/types';

type State = {
  spots: Spot[];
  loading: boolean;
  source: 'live' | 'mock';
};

export function useSpots(): State {
  const [state, setState] = useState<State>({
    spots: fallbackSpots,
    loading: firebaseConfigured,
    source: 'mock',
  });

  useEffect(() => {
    if (!firebaseConfigured || !db) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, 'spots'), orderBy('name'));
        const snap = await getDocs(q);
        if (cancelled) return;
        const spots = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Spot, 'id'>) }));
        if (spots.length === 0) {
          // Empty collection — keep the mock fallback so the app still
          // shows something, but flag for the caller.
          setState({ spots: fallbackSpots, loading: false, source: 'mock' });
          return;
        }
        setState({ spots, loading: false, source: 'live' });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[useSpots] live fetch failed, using mock:', err);
        if (!cancelled) setState({ spots: fallbackSpots, loading: false, source: 'mock' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
