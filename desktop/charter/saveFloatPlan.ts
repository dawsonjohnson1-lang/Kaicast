// Float-plan filing — flips the trip's floatPlanFiled flag to true.
//
// Called from CrewBriefScreen by a captain on a trip where they're
// the assigned captain (trip.captainUid === auth.user.uid). The
// Firestore rule scopes this write to:
//   - the charter admin (any field), OR
//   - the captain of THIS trip, on the floatPlanFiled / captainsLog /
//     status allowlist only.
//
// We deliberately don't store float-plan details (vessel manifest,
// USCG contact, ETA) in this v1 — the trip already carries all that
// information, so "filing" reduces to acknowledging the captain has
// completed the external submission with whichever authority they
// use. If/when KaiCast hosts the float plan submission itself, this
// helper grows to write a structured `floatPlan` field.

import { doc, updateDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';

export async function saveFloatPlan(orgId: string, tripId: string): Promise<void> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured.');
  }
  const ref = doc(db, 'charter_accounts', orgId, 'trips', tripId);
  await updateDoc(ref, { floatPlanFiled: true });
}
