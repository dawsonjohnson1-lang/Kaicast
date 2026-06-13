// Follower preview for the Log Dive success screen — a sample of the
// authed user's followers plus the true total, read from the
// users/{uid}/followers subcollection (public read; each doc embeds
// the follower's denormalized name/handle, see app/src/api/follows.ts).
// The count uses the aggregation endpoint so we never download the
// full list.

import {
  collection,
  getCountFromServer,
  getDocs,
  limit as fbLimit,
  query,
} from 'firebase/firestore';

import { db, firebaseConfigured } from '../firebase';

export type FollowerSample = {
  uid: string;
  name: string;
  handle: string | null;
};

export type FollowerPreview = {
  total: number;
  sample: FollowerSample[];
};

/**
 * Returns null (rather than throwing) when Firebase is unavailable or
 * the reads fail — callers render nothing instead of made-up names.
 */
export async function fetchFollowerPreview(
  uid: string,
  sampleMax = 4,
): Promise<FollowerPreview | null> {
  if (!firebaseConfigured || !db) return null;
  try {
    const col = collection(db, 'users', uid, 'followers');
    const [countSnap, docsSnap] = await Promise.all([
      getCountFromServer(query(col)),
      getDocs(query(col, fbLimit(sampleMax))),
    ]);
    return {
      total: countSnap.data().count,
      sample: docsSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          uid: d.id,
          name: typeof data.name === 'string' && data.name.trim() !== '' ? data.name : 'A diver',
          handle: typeof data.handle === 'string' && data.handle.trim() !== '' ? data.handle : null,
        };
      }),
    };
  } catch {
    return null;
  }
}
