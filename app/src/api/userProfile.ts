// User profile persistence — writes to Firestore `users/{uid}` when
// configured, falls back to AsyncStorage so the onboarding form still
// produces a record in demo mode.
//
// Schema (users/{uid}):
//   email, name, handle, photoUrl,
//   homeIsland, homeTown, homeSpot,
//   activities[] (multi-select dive types from onboarding),
//   experienceLevel, yearsActive,
//   firstName, lastName, nickname,
//   updatedAt, createdAt

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { db, firebaseConfigured } from '@/firebase';

const STUB_KEY_PREFIX = 'kaicast.profile.stub.v1.';

export type UserProfile = {
  uid: string;
  email?: string;
  name?: string;
  handle?: string;
  photoUrl?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  homeIsland?: string;
  homeTown?: string;
  homeSpot?: string;
  activities?: string[];
  experienceLevel?: string;
  yearsActive?: number;
  updatedAt?: Date | null;
  createdAt?: Date | null;
};

export type UserProfileInput = Omit<UserProfile, 'uid' | 'updatedAt' | 'createdAt'>;

/** Read the profile for a given uid. Returns null if no profile exists. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (firebaseConfigured && db) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      uid,
      email: data.email,
      name: data.name,
      handle: data.handle,
      photoUrl: data.photoUrl,
      firstName: data.firstName,
      lastName: data.lastName,
      nickname: data.nickname,
      homeIsland: data.homeIsland,
      homeTown: data.homeTown,
      homeSpot: data.homeSpot,
      activities: data.activities,
      experienceLevel: data.experienceLevel,
      yearsActive: data.yearsActive,
      updatedAt: data.updatedAt?.toDate?.() ?? null,
      createdAt: data.createdAt?.toDate?.() ?? null,
    };
  }
  // Stub fallback.
  const raw = await AsyncStorage.getItem(STUB_KEY_PREFIX + uid);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

/** Create or update the profile for `uid`. Merges with existing fields. */
export async function setUserProfile(uid: string, input: UserProfileInput): Promise<void> {
  if (firebaseConfigured && db) {
    const ref = doc(db, 'users', uid);
    const existing = await getDoc(ref);
    const payload: any = {
      ...input,
      updatedAt: serverTimestamp(),
    };
    if (!existing.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload, { merge: true });
    } else {
      await updateDoc(ref, payload);
    }
    return;
  }
  // Stub fallback — merge with any existing local profile.
  const existing = await AsyncStorage.getItem(STUB_KEY_PREFIX + uid);
  const merged: UserProfile = {
    ...(existing ? JSON.parse(existing) : { uid }),
    ...input,
    uid,
    updatedAt: new Date(),
  };
  await AsyncStorage.setItem(STUB_KEY_PREFIX + uid, JSON.stringify(merged));
}
