// Writes a CommunityReport document to /community_reports.
// Returns the new doc id so the caller can navigate or show a confirmation.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './firebase';
import type { CommunityReport } from '@/types/report';

export async function submitCommunityReport(
  payload: Omit<CommunityReport, 'id' | 'likesCount' | 'commentsCount'>,
): Promise<string | null> {
  if (!isFirebaseConfigured()) {
    if (__DEV__) console.warn('[KaiCast] submitCommunityReport: Firebase not configured');
    return null;
  }
  const db = getDb()!;
  const ref = await addDoc(collection(db, 'community_reports'), {
    ...payload,
    likesCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
