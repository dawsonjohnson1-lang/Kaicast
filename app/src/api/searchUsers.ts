// User discovery — prefix search on handle.
//
// Firestore doesn't ship full-text search; for a 1-shot social
// graph we don't need it yet. A range query on `handle` covers the
// "I know their @handle, let me follow them" path which is the
// dominant discovery flow on every social app of this size.
//
// Handles are stored as written at sign-up — e.g. the email local
// part of `mike@kaicast.com` becomes `mike`. We strip a leading `@`
// from input and lowercase to keep the query forgiving.
//
// Stale denormalized profile drift (a user renamed but their entry
// in your followers list still shows the old name) is handled
// elsewhere; the search results read users/{uid} live, so they
// always reflect current state.

import {
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDocs,
} from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import type { FollowProfile } from '@/api/follows';

export type UserSearchResult = FollowProfile & {
  uid: string;
};

const MAX_RESULTS = 25;

// Highest BMP private-use char — Firestore prefix-match idiom.
const UNICODE_MAX = '';

export async function searchUsersByHandle(input: string): Promise<UserSearchResult[]> {
  if (!firebaseConfigured || !db) return [];
  const q = input.trim().replace(/^@+/, '').toLowerCase();
  if (!q || q.length < 2) return [];

  // Range from q to q + UNICODE_MAX captures every doc whose
  // `handle` starts with q.
  const snap = await getDocs(
    query(
      collection(db, 'users'),
      where('handle', '>=', q),
      where('handle', '<', q + UNICODE_MAX),
      orderBy('handle'),
      fsLimit(MAX_RESULTS),
    ),
  );

  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const homeIsland = (data.homeIsland as string | undefined) ?? '';
    const homeTown   = (data.homeTown as string | undefined)   ?? '';
    const homeSpot   = [homeTown, homeIsland].filter(Boolean).join(', ') || null;
    return {
      uid:      d.id,
      name:     String(data.name ?? data.handle ?? 'Diver'),
      handle:   String(data.handle ?? ''),
      photoUrl: (data.photoUrl as string | null | undefined) ?? null,
      homeSpot,
    };
  });
}
