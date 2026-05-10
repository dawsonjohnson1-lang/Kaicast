// Live subscription to a user's favorite spot ids.
//
// Returns a Set<string> of spotIds plus an `isFavorite(spotId)`
// helper. Subscribes via Firestore onSnapshot in live mode so any
// write from any screen flips every consumer instantly. In stub mode
// it polls AsyncStorage on uid changes (one-shot).

import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db, firebaseConfigured } from '@/firebase';
import { _stubKeyFor } from '@/api/favorites';

type State = {
  favorites: Set<string>;
  loading: boolean;
};

export function useFavorites(uid: string | undefined): State & {
  isFavorite: (spotId: string) => boolean;
} {
  const [state, setState] = useState<State>({ favorites: new Set(), loading: !!uid });

  useEffect(() => {
    if (!uid) {
      setState({ favorites: new Set(), loading: false });
      return;
    }
    if (firebaseConfigured && db) {
      const unsub = onSnapshot(
        collection(db, 'users', uid, 'favorites'),
        (snap) => {
          const ids = new Set<string>();
          snap.docs.forEach((d) => ids.add(d.id));
          setState({ favorites: ids, loading: false });
        },
        () => setState({ favorites: new Set(), loading: false }),
      );
      return unsub;
    }
    // Stub fallback — one-shot AsyncStorage read.
    AsyncStorage.getItem(_stubKeyFor(uid))
      .then((raw) => {
        const ids = raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
        setState({ favorites: ids, loading: false });
      })
      .catch(() => setState({ favorites: new Set(), loading: false }));
  }, [uid]);

  const isFavorite = useCallback(
    (spotId: string) => state.favorites.has(spotId),
    [state.favorites],
  );

  return { ...state, isFavorite };
}
