// Charter spot persistence — create / update / delete docs under
// charter_accounts/{orgId}/spots/{spotId}. Security rules restrict
// these writes to org members; the public-spot link is server-trusted
// only insofar as it points at a canonical KaiCast spot id (the
// readiness calendar + trip planner verify the linked id exists in
// the public SPOTS list before using it).

import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { CharterSpot } from './types';

export interface SpotFormInput {
  name: string;
  lat: number;
  lng: number;
  isPrivate: boolean;
  linkedPublicSpotId: string | null;
  tripTypes: CharterSpot['tripTypes'];
  maxGroupSize: number;
  depthFt: number;
  tidePreference: CharterSpot['tidePreference'];
  notes: string;
  goodWindowAlertsEnabled: boolean;
}

/** Create a new charter spot. Returns the auto-generated doc id. */
export async function createCharterSpot(orgId: string, input: SpotFormInput): Promise<string> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured — set EXPO_PUBLIC_FIREBASE_* env vars.');
  }
  const ref = collection(db, 'charter_accounts', orgId, 'spots');
  const data = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const result = await addDoc(ref, data as unknown as Record<string, unknown>);
  return result.id;
}

/** Update an existing charter spot. Partial updates are supported. */
export async function updateCharterSpot(
  orgId: string,
  spotId: string,
  patch: Partial<SpotFormInput>,
): Promise<void> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured');
  }
  const ref = doc(db, 'charter_accounts', orgId, 'spots', spotId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

/** Toggle just the Good Window alerts field — separate helper because
 *  it's the only field changed by the list-card toggle and we don't
 *  want to send the full doc over the wire on every flip. */
export async function setGoodWindowAlertsEnabled(
  orgId: string,
  spotId: string,
  enabled: boolean,
): Promise<void> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured');
  }
  const ref = doc(db, 'charter_accounts', orgId, 'spots', spotId);
  await setDoc(ref, { goodWindowAlertsEnabled: enabled, updatedAt: serverTimestamp() }, { merge: true });
}

/** Delete a spot from the org's library. Trips that reference this
 *  spot remain valid — they store the spot id as a string, not a ref,
 *  so the trip list just shows the stale id where the spot used to be.
 *  Phase 7 could promote this to a cascade or a soft-delete. */
export async function deleteCharterSpot(orgId: string, spotId: string): Promise<void> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured');
  }
  const ref = doc(db, 'charter_accounts', orgId, 'spots', spotId);
  await deleteDoc(ref);
}
