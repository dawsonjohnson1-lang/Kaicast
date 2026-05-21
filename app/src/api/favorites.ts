// Per-user spot favorites.
//
// Schema:
//   users/{uid}/favorites/{spotId}: {
//     spotId:  string         // mirrors the doc id for easier indexing
//     addedAt: Timestamp      // server-set on write
//   }
//
// The subcollection lives under the user's profile doc so security
// rules can scope writes to the owner without an extra `uid` field.
//
// Stub-mode fallback: when Firebase isn't configured we read/write a
// single AsyncStorage key per uid so the heart toggle still works in
// demo mode and survives reloads.
//
// In-memory store: every `useFavorites` consumer subscribes to a shared
// per-uid Set. `addFavorite` / `removeFavorite` flip that Set
// optimistically and broadcast to all subscribers, so the heart toggle
// on Spot Detail and the Saved Spots tab update instantly on the same
// device — no waiting for the Firestore round-trip.

import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db, firebaseConfigured } from '@/firebase';

const STUB_KEY_PREFIX = 'kaicast.favorites.stub.v1.';

// ── In-memory store ────────────────────────────────────────────────
type Listener = (snapshot: Set<string>) => void;
const stores = new Map<string, Set<string>>();
const listeners = new Map<string, Set<Listener>>();

function getStore(uid: string): Set<string> {
  let s = stores.get(uid);
  if (!s) {
    s = new Set();
    stores.set(uid, s);
  }
  return s;
}

function emit(uid: string): void {
  const subs = listeners.get(uid);
  if (!subs || subs.size === 0) return;
  // Pass a fresh Set instance so React sees a new reference and re-renders.
  const snapshot = new Set(getStore(uid));
  subs.forEach((l) => l(snapshot));
}

function setsEqual(a: Set<string>, b: Iterable<string>): boolean {
  const bArr = [...b];
  if (a.size !== bArr.length) return false;
  for (const id of bArr) if (!a.has(id)) return false;
  return true;
}

/** Replace the cached set for a uid (used by the Firestore listener). */
export function _replaceLocalFavorites(uid: string, ids: Iterable<string>): void {
  const current = getStore(uid);
  if (setsEqual(current, ids)) return; // no-op: avoid spurious re-renders
  stores.set(uid, new Set(ids));
  emit(uid);
}

/** Subscribe to local store changes for a uid. Pushes current state on subscribe. */
export function _subscribeLocalFavorites(uid: string, listener: Listener): () => void {
  let subs = listeners.get(uid);
  if (!subs) {
    subs = new Set();
    listeners.set(uid, subs);
  }
  subs.add(listener);
  // Push current state immediately so the consumer hydrates without a delay.
  listener(new Set(getStore(uid)));
  return () => {
    subs!.delete(listener);
  };
}

// ── Mutations ──────────────────────────────────────────────────────
/** Add a spot to the user's favorites. Optimistic + idempotent. */
export async function addFavorite(uid: string, spotId: string): Promise<void> {
  // Optimistic local flip — every consumer sees it immediately.
  const before = new Set(getStore(uid));
  getStore(uid).add(spotId);
  emit(uid);

  try {
    if (firebaseConfigured && db) {
      await setDoc(
        doc(db, 'users', uid, 'favorites', spotId),
        { spotId, addedAt: serverTimestamp() },
        { merge: true },
      );
      return;
    }
    await writeStub(uid, getStore(uid));
  } catch (err) {
    // Roll back on failure so the UI reflects reality.
    stores.set(uid, before);
    emit(uid);
    throw err;
  }
}

/** Remove a spot from the user's favorites. Optimistic + idempotent. */
export async function removeFavorite(uid: string, spotId: string): Promise<void> {
  const before = new Set(getStore(uid));
  getStore(uid).delete(spotId);
  emit(uid);

  try {
    if (firebaseConfigured && db) {
      await deleteDoc(doc(db, 'users', uid, 'favorites', spotId));
      return;
    }
    await writeStub(uid, getStore(uid));
  } catch (err) {
    stores.set(uid, before);
    emit(uid);
    throw err;
  }
}

// ── Stub helpers ───────────────────────────────────────────────────
async function writeStub(uid: string, set: Set<string>): Promise<void> {
  await AsyncStorage.setItem(STUB_KEY_PREFIX + uid, JSON.stringify([...set]));
}

/** Internal accessor used by useFavorites for the AsyncStorage path. */
export const _stubKeyFor = (uid: string) => STUB_KEY_PREFIX + uid;
