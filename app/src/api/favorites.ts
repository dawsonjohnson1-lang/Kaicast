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

import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db, firebaseConfigured } from '@/firebase';

const STUB_KEY_PREFIX = 'kaicast.favorites.stub.v1.';

/** Add a spot to the user's favorites list. Idempotent. */
export async function addFavorite(uid: string, spotId: string): Promise<void> {
  if (firebaseConfigured && db) {
    await setDoc(
      doc(db, 'users', uid, 'favorites', spotId),
      { spotId, addedAt: serverTimestamp() },
      { merge: true },
    );
    return;
  }
  const set = await readStub(uid);
  set.add(spotId);
  await writeStub(uid, set);
}

/** Remove a spot from the user's favorites list. Idempotent. */
export async function removeFavorite(uid: string, spotId: string): Promise<void> {
  if (firebaseConfigured && db) {
    await deleteDoc(doc(db, 'users', uid, 'favorites', spotId));
    return;
  }
  const set = await readStub(uid);
  set.delete(spotId);
  await writeStub(uid, set);
}

async function readStub(uid: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STUB_KEY_PREFIX + uid);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

async function writeStub(uid: string, set: Set<string>): Promise<void> {
  await AsyncStorage.setItem(STUB_KEY_PREFIX + uid, JSON.stringify([...set]));
}

/** Internal accessor used by useFavorites for the AsyncStorage path. */
export const _stubKeyFor = (uid: string) => STUB_KEY_PREFIX + uid;
