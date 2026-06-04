// useCrewSelf — the caller's own crew record at the active org.
//
// Reads /charter_accounts/{orgId}/crew where uid == auth.user.uid.
// The accept callable auto-creates this record on invite acceptance,
// so for any post-invite user a record exists. For users whose admin
// manually pre-populated their crew record (typing the uid by hand)
// it's also discoverable.
//
// Returns the doc (with id) or null when no record links to this
// user. Cert tracking + trip filtering depend on having one — the
// screens render an explanation when it's null.

import React from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import type { CrewMember, Cert, CrewRole } from '../charter/types';

export interface CrewSelfState {
  /** The user's crew record at this org, or null if no record links
   *  to their uid. */
  member: CrewMember | null;
  loading: boolean;
  error: string | null;
}

export function useCrewSelf(orgId: string | null | undefined): CrewSelfState {
  const auth = useAuth();
  const uid = auth.user?.uid ?? null;
  const [state, setState] = React.useState<CrewSelfState>({
    member: null,
    loading: !!(orgId && uid),
    error: null,
  });

  React.useEffect(() => {
    if (!orgId || !uid || !db || !firebaseConfigured) {
      setState({ member: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const q = query(
      collection(db, 'charter_accounts', orgId, 'crew'),
      where('uid', '==', uid),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setState({ member: null, loading: false, error: null });
          return;
        }
        const doc = snap.docs[0];
        setState({
          member: crewFromDoc(doc.id, doc.data() as Record<string, unknown>),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ member: null, loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId, uid]);

  return state;
}

function crewFromDoc(id: string, data: Record<string, unknown>): CrewMember {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Unnamed crew',
    role: roleFromString(data.role),
    certs: Array.isArray(data.certs) ? (data.certs as unknown[]).map(parseCert) : [],
    uid: typeof data.uid === 'string' && data.uid.length > 0 ? data.uid : null,
  };
}

function roleFromString(v: unknown): CrewRole {
  if (v === 'owner' || v === 'captain' || v === 'divemaster'
      || v === 'deckhand' || v === 'manager' || v === 'instructor') return v;
  return 'deckhand';
}

function parseCert(v: unknown): Cert {
  const c = (v ?? {}) as Record<string, unknown>;
  const expiresRaw = c.expiresAt as { toDate?: () => Date } | undefined;
  return {
    type: certTypeFromString(c.type),
    issuedBy: typeof c.issuedBy === 'string' ? c.issuedBy : '',
    expiresAt: expiresRaw?.toDate?.() ?? new Date(0),
  };
}

function certTypeFromString(v: unknown): Cert['type'] {
  if (v === 'USCG' || v === 'DiveMaster' || v === 'Instructor' || v === 'CPR' || v === 'O2Provider') return v;
  return 'CPR';
}
