// useCharterInvitations — live subscription to /crew_invitations docs
// owned by the current org. Returns pending invitations sorted by
// createdAt (newest first) so the Crew screen can show them above the
// roster as a "Pending" section.
//
// Expired invitations are NOT included by default — the
// createCrewInvitation callable bumps a stale 'pending' doc to
// 'expired' on the next invite attempt, so this list naturally cleans
// up over time. If a future view needs the full history it can pass
// includeAllStatuses.

import React from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { CrewRole } from './types';

/** Subset of CrewRole that's valid as an invite target. The org-owner
 *  role is implicit (set by provisionCharterOperator) and never sent
 *  as an invite. */
export type InvitedRole = Exclude<CrewRole, 'owner'>;

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface CrewInvitation {
  id: string;
  orgId: string;
  orgName: string;
  invitedEmail: string;
  invitedDisplayName: string | null;
  role: InvitedRole;
  invitedBy: string;
  status: InvitationStatus;
  createdAt: number | null;
  expiresAt: number | null;
}

export interface CharterInvitationsState {
  invitations: CrewInvitation[];
  loading: boolean;
  error: string | null;
}

export function useCharterInvitations(
  orgId: string | null | undefined,
): CharterInvitationsState {
  const [state, setState] = React.useState<CharterInvitationsState>({
    invitations: [],
    loading: !!orgId,
    error: null,
  });

  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ invitations: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const q = query(
      collection(db, 'crew_invitations'),
      where('orgId', '==', orgId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const invitations = snap.docs.map((d) =>
          invitationFromDoc(d.id, d.data() as Record<string, unknown>),
        );
        setState({ invitations, loading: false, error: null });
      },
      (err) => setState({ invitations: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);

  return state;
}

function invitationFromDoc(id: string, data: Record<string, unknown>): CrewInvitation {
  return {
    id,
    orgId: String(data.orgId ?? ''),
    orgName: String(data.orgName ?? ''),
    invitedEmail: String(data.invitedEmail ?? ''),
    invitedDisplayName:
      typeof data.invitedDisplayName === 'string' && data.invitedDisplayName.length > 0
        ? data.invitedDisplayName
        : null,
    role: roleFromString(data.role),
    invitedBy: String(data.invitedBy ?? ''),
    status: statusFromString(data.status),
    createdAt: tsToMs(data.createdAt),
    expiresAt: tsToMs(data.expiresAt),
  };
}

function roleFromString(v: unknown): InvitedRole {
  if (v === 'captain' || v === 'divemaster' || v === 'deckhand') return v;
  return 'deckhand';
}

function statusFromString(v: unknown): InvitationStatus {
  if (v === 'pending' || v === 'accepted' || v === 'declined' || v === 'expired') return v;
  return 'pending';
}

function tsToMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'object' && raw && 'toMillis' in raw) {
    const ts = raw as Timestamp;
    try { return ts.toMillis(); } catch { return null; }
  }
  return null;
}
