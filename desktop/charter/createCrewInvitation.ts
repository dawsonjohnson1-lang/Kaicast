// createCrewInvitation (desktop) — thin wrapper around the callable
// of the same name in functions/charter/. Used by InviteCrewModal.
//
// The accept URL is derived client-side rather than returned by the
// callable, so the function doesn't need to know about hosting
// origins. The path matches the route handled by InviteAcceptScreen
// (Slice C2).

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, firebaseConfigured } from '../firebase';
import type { InvitedRole } from './useCharterInvitations';

export interface CreateInvitationInput {
  orgId: string;
  invitedEmail: string;
  role: InvitedRole;
  displayName?: string;
}

export interface CreateInvitationResult {
  inviteId: string;
  status: 'pending';
  orgName: string;
  role: InvitedRole;
  expiresAt: number;
  reused: boolean;
  acceptUrl: string;
  /** True when the server actually sent the invitation email via
   *  Resend. False when delivery failed (rate-limit, sandbox limits,
   *  unverified sender) — the modal surfaces this so the admin knows
   *  to fall back to copying the link. */
  emailSent: boolean;
  /** Resend error message (or "RESEND_API_KEY not configured") when
   *  emailSent is false. Pre-formatted for surfacing to the admin. */
  emailFailureReason: string | null;
}

export async function createCrewInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  if (!firebaseConfigured || !app) {
    throw new Error('Firebase is not configured.');
  }
  const fn = httpsCallable<CreateInvitationInput, Omit<CreateInvitationResult, 'acceptUrl'>>(
    getFunctions(app, 'us-central1'),
    'createCrewInvitation',
  );
  const { data } = await fn(input);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kaicast.com';
  return {
    ...data,
    acceptUrl: `${origin}/invite/${encodeURIComponent(data.inviteId)}`,
  };
}
