// Live subscription to a user's favorite spot ids.
//
// Reads from a shared in-process store (see api/favorites.ts) so any
// add/remove from any screen reflects instantly across every consumer
// of this hook. The store itself is hydrated by:
//   - Firestore onSnapshot when configured (source of truth)
//   - AsyncStorage one-shot in stub mode
//
// Returns the current favorites Set + an `isFavorite(spotId)` helper.

import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db, firebaseConfigured } from '@/firebase';
import {
  _stubKeyFor,
  _replaceLocalFavorites,
  _subscribeLocalFavorites,
} from '@/api/favorites';

type State = {
  favorites: Set<string>;
  loading: boolean;
};

export function useFavorites(uid: string | undefined): State & {
  isFavorite: (spotId: string) => boolean;
} {
  const [state, setState] = useState<State>({
    favorites: new Set(),
    loading: !!uid,
  });

  useEffect(() => {
    if (!uid) {
      setState({ favorites: new Set(), loading: false });
      return;
    }

    // Subscribe to the shared in-process store. This fires immediately
    // with the current state and on every optimistic add/remove from
    // any screen, so the heart on Spot Detail and the Saved Spots list
    // stay in sync without waiting on the network.
    const unsubLocal = _subscribeLocalFavorites(uid, (snapshot) => {
      setState((prev) => ({ favorites: snapshot, loading: prev.loading }));
    });

    // Hydrate the store from the source of truth.
    let unsubBackend: (() => void) | undefined;
    if (firebaseConfigured && db) {
      unsubBackend = onSnapshot(
        collection(db, 'users', uid, 'favorites'),
        (snap) => {
          const ids: string[] = [];
          snap.docs.forEach((d) => ids.push(d.id));
          _replaceLocalFavorites(uid, ids);
          setState((prev) => ({ ...prev, loading: false }));
        },
        () => setState((prev) => ({ ...prev, loading: false })),
      );
    } else {
      AsyncStorage.getItem(_stubKeyFor(uid))
        .then((raw) => {
          const ids = raw ? (JSON.parse(raw) as string[]) : [];
          _replaceLocalFavorites(uid, ids);
        })
        .catch(() => undefined)
        .finally(() => {
          setState((prev) => ({ ...prev, loading: false }));
        });
    }

    return () => {
      unsubLocal();
      unsubBackend?.();
    };
  }, [uid]);

  const isFavorite = useCallback(
    (spotId: string) => state.favorites.has(spotId),
    [state.favorites],
  );

  return { ...state, isFavorite };
}
