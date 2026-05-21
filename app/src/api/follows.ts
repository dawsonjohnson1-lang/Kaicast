// Follower / following social graph.
//
// Schema (mirrored, denormalized):
//   users/{uid}/following/{otherUid}  — list of users I follow
//   users/{uid}/followers/{otherUid}  — list of users following me
//
// Each doc embeds the other party's basic profile (name, handle,
// photoUrl, homeSpot) so list screens render in one read instead of
// fanning out per-row lookups. Profile drift (rename/avatar change)
// is acceptable — the next follow refresh re-denormalizes.
//
// followUser / unfollowUser write both sides in a single batch so the
// graph never goes asymmetric. Security rules enforce that only the
// owner of each side can write to it (the actor writes their own
// following/{other}, AND the other side's followers/{actor}).
//
// Stub-mode fallback: when Firebase isn't configured, both functions
// no-op silently (the social graph is intentionally Firebase-only;
// AsyncStorage doesn't make sense for a social model that requires
// cross-user state).

import {
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';

export type FollowProfile = {
  uid: string;
  name: string;
  handle: string;
  photoUrl?: string | null;
  homeSpot?: string | null;
};

export type FollowEdge = FollowProfile & {
  addedAt?: number;
};

/**
 * Follow another user. Writes both sides of the edge atomically.
 * Pass enough of `me` and `other` profile data to denormalize. No-op
 * in stub mode.
 */
export async function followUser(me: FollowProfile, other: FollowProfile): Promise<void> {
  if (!firebaseConfigured || !db) return;
  if (!me?.uid || !other?.uid || me.uid === other.uid) return;

  const batch = writeBatch(db);
  batch.set(
    doc(db, 'users', me.uid, 'following', other.uid),
    {
      uid:      other.uid,
      name:     other.name ?? '',
      handle:   other.handle ?? '',
      photoUrl: other.photoUrl ?? null,
      homeSpot: other.homeSpot ?? null,
      addedAt:  serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(db, 'users', other.uid, 'followers', me.uid),
    {
      uid:      me.uid,
      name:     me.name ?? '',
      handle:   me.handle ?? '',
      photoUrl: me.photoUrl ?? null,
      homeSpot: me.homeSpot ?? null,
      addedAt:  serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

/**
 * Unfollow another user. Deletes both sides of the edge atomically.
 * No-op in stub mode.
 */
export async function unfollowUser(myUid: string, otherUid: string): Promise<void> {
  if (!firebaseConfigured || !db) return;
  if (!myUid || !otherUid || myUid === otherUid) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', myUid, 'following', otherUid));
  batch.delete(doc(db, 'users', otherUid, 'followers', myUid));
  await batch.commit();
}
