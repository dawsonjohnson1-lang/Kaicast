// Captain's log persistence — updates the existing trip doc with the
// filed log and flips the status to 'completed'. We don't create a
// separate `logs` subcollection because the log IS the post-trip
// state of the trip — keeping it on the same doc means the archive
// view, the brief share, and the future calibration-feed all read
// from one place.

import { doc, updateDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { CaptainsLog } from './types';

/** Write a filed log onto the trip doc + flip status to completed.
 *  The trip's existing conditionsSnapshot field is left untouched —
 *  that's the forecast-at-creation-time the Phase 4 archive uses to
 *  compute the forecast-vs-reality delta. */
export async function saveCaptainsLog(
  orgId: string,
  tripId: string,
  log: CaptainsLog,
): Promise<void> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured — set EXPO_PUBLIC_FIREBASE_* env vars.');
  }
  const ref = doc(db, 'charter_accounts', orgId, 'trips', tripId);
  await updateDoc(ref, {
    captainsLog: log as unknown as Record<string, unknown>,
    status: 'completed',
  });
}
