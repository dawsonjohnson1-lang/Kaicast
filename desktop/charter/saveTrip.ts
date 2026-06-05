// Trip persistence — server-side via addDoc to
// charter_accounts/{orgId}/trips. Security rules restrict writes to
// org members. The conditionsSnapshot field is captured at trip
// creation time so the Phase 4 forecast-vs-reality delta is honest
// about what was predicted when the captain committed.

import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { TripType, Harbor, ManifestEntry } from './types';

export interface NewTripInput {
  date: Date;
  departureTime: string;          // 'HH:mm'
  returnTime: string;             // 'HH:mm'
  departureHarbor: Harbor;
  spots: string[];                // ordered list of charter spot ids
  crew: string[];                 // crew member ids
  headcount: number;
  tripType: TripType;
  manifest: ManifestEntry[];      // empty unless tripType === 'dive'
  /** Denormalized uid of the assigned captain — passed in from the
   *  wizard which resolves it by looking up the crew member with role
   *  'captain' in the trip's crew array and reading their .uid. null
   *  when no captain is set or the assigned captain has no KaiCast
   *  account; captain-scoped writes are admin-only in that case. */
  captainUid: string | null;
  /** Snapshot of the per-spot forecast at planned arrival time,
   *  captured by the wizard from useSpotReport calls. Stored as-is
   *  for the Phase 4 forecast-vs-reality comparison. */
  conditionsSnapshot: Record<string, unknown>;
  /** When true, the trip is created with a one-time random
   *  briefingShareToken populated so /charter/brief/:tripId works
   *  immediately. */
  generateShareToken?: boolean;
}

/** Write a new trip and return the new doc id. Throws when Firebase
 *  isn't configured or the write is denied (e.g. user isn't a member
 *  of the org); the caller surfaces the error in the wizard. */
export async function saveTrip(orgId: string, input: NewTripInput): Promise<string> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured — set EXPO_PUBLIC_FIREBASE_* env vars.');
  }
  const ref = collection(db, 'charter_accounts', orgId, 'trips');
  // Firestore expects Timestamp on the wire; everything else mirrors
  // Trip's field shape. We assemble as Record<string, unknown> so the
  // Timestamp/Date type collision on `date` doesn't force a cast on
  // every line — the rules + the Phase 1 type file are the schema
  // contract, not this intermediate object.
  const doc: Record<string, unknown> = {
    date: Timestamp.fromDate(input.date),
    departureTime: input.departureTime,
    returnTime: input.returnTime,
    departureHarbor: input.departureHarbor,
    spots: input.spots,
    crew: input.crew,
    captainUid: input.captainUid,
    headcount: input.headcount,
    tripType: input.tripType,
    status: 'planned' as const,
    manifest: input.manifest,
    floatPlanFiled: false,
    briefingShareToken: input.generateShareToken ? generateShareToken() : null,
    conditionsSnapshot: input.conditionsSnapshot,
    captainsLog: null,
  };
  const result = await addDoc(ref, doc);
  return result.id;
}

/** ~30-char random token built from crypto.getRandomValues when
 *  available, falling back to Math.random for older / SSR contexts.
 *  This is the brief-share secret — anyone with the URL can read
 *  the briefing, so we need enough entropy that the URL space isn't
 *  guessable (~150 bits is plenty against any realistic attacker). */
export function generateShareToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback — still random enough for non-adversarial uses.
  let out = '';
  while (out.length < 48) out += Math.random().toString(16).slice(2);
  return out.slice(0, 48);
}
