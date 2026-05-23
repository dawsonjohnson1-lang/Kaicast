// User discovery — prefix search on handle. Desktop counterpart of
// app/src/api/searchUsers.ts. Identical query semantics so a single
// "the search works the same way everywhere" mental model holds.
//
// Firestore doesn't ship full-text search; for our 1-shot social graph
// we don't need it yet. A range query on `handle` covers the dominant
// "I know their @handle, let me follow them" path.
//
// Handles are stored lowercase (see the self-healing migration in
// app/src/hooks/useAuth.tsx). We strip a leading '@' and lowercase
// the input so the query is forgiving.

import {
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getDocs,
} from 'firebase/firestore';

import { db, firebaseConfigured } from '../firebase';

export interface UserSearchResult {
  uid: string;
  name: string;
  handle: string;
  photoUrl: string | null;
  homeSpot: string | null;
}

const MAX_RESULTS = 25;
// Highest BMP private-use char — Firestore prefix-match idiom.
const UNICODE_MAX = '';

export async function searchUsersByHandle(input: string): Promise<UserSearchResult[]> {
  if (!firebaseConfigured || !db) return [];
  const q = input.trim().replace(/^@+/, '').toLowerCase();
  if (!q || q.length < 2) return [];

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
