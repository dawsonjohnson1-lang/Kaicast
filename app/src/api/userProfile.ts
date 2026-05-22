// User profile persistence — writes to Firestore `users/{uid}` when
// configured, falls back to AsyncStorage so the onboarding form still
// produces a record in demo mode.
//
// Canonical schema (matches desktop — see /Users/dawsonjohnson/Kaicast/
// functions/migrations/unify_user_schema.js):
//
//   displayName  (was: `name` pre-2026-05)
//   photoURL     (was: `photoUrl` pre-2026-05)
//   handle, email, bio,
//   homeIsland, homeTown, homeSpot,
//   activities[], experienceLevel, yearsActive, certification,
//   firstName, lastName, nickname,
//   onboardingComplete, updatedAt, createdAt
//
// The mobile RN UI was written against `name`/`photoUrl`; the internal
// `UserProfile` type retains those names so existing screens don't have
// to be touched. Read path accepts either canonical or legacy keys;
// write path emits only canonical names. The migration script renames
// existing prod docs in a one-shot batch.

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
  certification?: string;
  /**
   * True once the user finishes the multi-step onboarding flow
   * (CreateAccountStep1 → CreateAccountAlmostThere). The navigator
   * gates the main app on this — when false/undefined, it routes the
   * user to the onboarding stack regardless of how they got authed.
   */
  onboardingComplete?: boolean;
  updatedAt?: Date | null;
  createdAt?: Date | null;
};

export type UserProfileInput = Omit<UserProfile, 'uid' | 'updatedAt' | 'createdAt'>;

/**
 * Map a raw Firestore doc to the internal UserProfile shape. Prefers
 * canonical (`displayName`, `photoURL`) keys but falls back to legacy
 * (`name`, `photoUrl`) for any docs the migration hasn't touched yet.
 * Internal type still surfaces `name`/`photoUrl` so RN screens don't
 * have to change.
 */
function fromFirestore(uid: string, data: any): UserProfile {
  return {
    uid,
    email: data.email,
    name: data.displayName ?? data.name,
    handle: data.handle,
    photoUrl: data.photoURL ?? data.photoUrl,
    firstName: data.firstName,
    lastName: data.lastName,
    nickname: data.nickname,
    homeIsland: data.homeIsland,
    homeTown: data.homeTown,
    homeSpot: data.homeSpot,
    activities: data.activities,
    experienceLevel: data.experienceLevel,
    yearsActive: data.yearsActive,
    certification: data.certification,
    onboardingComplete: data.onboardingComplete === true,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
    createdAt: data.createdAt?.toDate?.() ?? null,
  };
}

/**
 * Map an internal UserProfileInput to the canonical Firestore payload.
 * Renames `name` → `displayName`, `photoUrl` → `photoURL`. All other
 * fields pass through unchanged.
 */
function toFirestore(input: UserProfileInput): Record<string, unknown> {
  const { name, photoUrl, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  if (name !== undefined) payload.displayName = name;
  if (photoUrl !== undefined) payload.photoURL = photoUrl;
  return payload;
}

/** Read the profile for a given uid. Returns null if no profile exists. */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (firebaseConfigured && db) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return fromFirestore(uid, snap.data());
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
    const payload: Record<string, unknown> = {
      ...toFirestore(input),
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
