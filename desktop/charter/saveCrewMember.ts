// Crew member persistence — CRUD over
// charter_accounts/{orgId}/crew/{crewId}. Certs live as an array on
// the doc (per the Phase 1 schema in types.ts) so a single roster
// read pulls every cert without a subcollection scan. Cert
// Timestamps are serialized through Firestore's Timestamp class on
// the wire and back to Date in the reader hook.

import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { Cert, CrewRole, CrewMember } from './types';

export interface CrewFormInput {
  name: string;
  role: CrewRole;
  certs: Cert[];
  /** Linked KaiCast consumer uid — set when crew also has an end-user
   *  account so the future "crew can sign their own float plan ack"
   *  feature can match them. */
  uid: string | null;
}

function certsForWrite(certs: Cert[]): Array<{ type: string; issuedBy: string; expiresAt: Timestamp }> {
  return certs.map((c) => ({
    type: c.type,
    issuedBy: c.issuedBy,
    expiresAt: Timestamp.fromDate(c.expiresAt),
  }));
}

export async function createCrewMember(orgId: string, input: CrewFormInput): Promise<string> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured');
  }
  const ref = collection(db, 'charter_accounts', orgId, 'crew');
  const result = await addDoc(ref, {
    name: input.name,
    role: input.role,
    certs: certsForWrite(input.certs),
    uid: input.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return result.id;
}

export async function updateCrewMember(
  orgId: string,
  crewId: string,
  input: CrewFormInput,
): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  const ref = doc(db, 'charter_accounts', orgId, 'crew', crewId);
  await updateDoc(ref, {
    name: input.name,
    role: input.role,
    certs: certsForWrite(input.certs),
    uid: input.uid,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCrewMember(orgId: string, crewId: string): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  await deleteDoc(doc(db, 'charter_accounts', orgId, 'crew', crewId));
}

/** Empty cert template — used by the form when the captain hits
 *  "+ Add cert". Default expiry is 1 year out (common renewal cadence
 *  for the most common cert types). */
export function blankCert(type: Cert['type'] = 'CPR'): Cert {
  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);
  return { type, issuedBy: '', expiresAt: nextYear };
}

// Re-export the CrewMember type so the screen file only imports from
// here, not from two separate modules.
export type { CrewMember };
