/**
 * Favorited-spots store.
 *
 * Backed by localStorage, keyed by the signed-in user's uid so two
 * accounts on the same browser keep separate sets. Signed-out visitors
 * write to a single "anon" bucket which is intentionally short-lived —
 * the FavoriteButton bounces them to /signin before saving in real
 * usage, so the bucket mostly exists so optimistic clicks don't crash.
 *
 * `useFavorites()` returns a stable API: a Set of spot IDs, a check,
 * a toggle, and a clear. Every consumer of the hook sees the same Set
 * because writes go through a small in-module pubsub that re-renders
 * every subscriber. That keeps SpotDetail's heart, the SpotsMap
 * sidebar list, and the Profile "Favorites" section in lockstep.
 */

import React from 'react';
import { useAuth } from './useAuth';

const LS_PREFIX = 'kaicast.favorites.';

function lsKey(uid: string | null): string {
  return LS_PREFIX + (uid ?? 'anon');
}

function read(uid: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(lsKey(uid));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function write(uid: string | null, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lsKey(uid), JSON.stringify([...ids]));
  } catch {}
}

// Tiny module-scoped pubsub so every useFavorites() consumer re-renders
// when any one of them toggles a favorite.
const listeners = new Set<() => void>();
function notify() { listeners.forEach((fn) => fn()); }

export interface FavoritesApi {
  ids: Set<string>;
  isFavorite: (spotId: string) => boolean;
  toggle: (spotId: string) => void;
  add: (spotId: string) => void;
  remove: (spotId: string) => void;
  clear: () => void;
  /** Numeric count — handy for headers ("3 favorites"). */
  count: number;
}

export function useFavorites(): FavoritesApi {
  const auth = useAuth();
  const uid = auth.user?.uid ?? null;

  // Re-read whenever uid changes (sign-in/out swaps bucket) or any
  // pubsub fires.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const ids = React.useMemo(() => read(uid), [uid, tick]);

  const set = React.useCallback((next: Set<string>) => {
    write(uid, next);
    notify();
  }, [uid]);

  return React.useMemo<FavoritesApi>(() => ({
    ids,
    count: ids.size,
    isFavorite: (spotId) => ids.has(spotId),
    toggle: (spotId) => {
      const next = new Set(ids);
      if (next.has(spotId)) next.delete(spotId);
      else next.add(spotId);
      set(next);
    },
    add: (spotId) => {
      if (ids.has(spotId)) return;
      const next = new Set(ids); next.add(spotId); set(next);
    },
    remove: (spotId) => {
      if (!ids.has(spotId)) return;
      const next = new Set(ids); next.delete(spotId); set(next);
    },
    clear: () => set(new Set()),
  }), [ids, set]);
}
