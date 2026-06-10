// Standalone captain's-log persistence. Writes a NEW document into the
// top-level `charter_logs/{logId}` collection — independent of any trip.
// The existing firestore.rules charter_logs rule gates this to the org
// owner OR a member with a captain's license (hasCaptainsLicense), and
// requires `operatorId` on the doc. We use an auto-id so desktop logs
// never collide with the mobile path's {orgId}_{date}_{vesselId} doc ids.

import { collection, doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { StandaloneLog, StandaloneLogDraft } from './standaloneLog';

/** Create a standalone log. Returns the new log id. `filedBy` is the
 *  signed-in user filing the log (stored for audit + the archive's
 *  "filed by" line). */
export async function saveStandaloneLog(
  orgId: string,
  draft: StandaloneLogDraft,
  filedBy: { uid: string; name: string },
): Promise<string> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured — set EXPO_PUBLIC_FIREBASE_* env vars.');
  }
  const ref = doc(collection(db, 'charter_logs'));
  const now = Date.now();
  const log: StandaloneLog = {
    ...draft,
    logId: ref.id,
    operatorId: orgId,
    schema: 'standalone-v1',
    filedByUid: filedBy.uid,
    filedByName: filedBy.name,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, log as unknown as Record<string, unknown>);
  return ref.id;
}
