// useActiveMembership — pick the orgMembership the crew shell should
// be scoped to right now. Resolution order:
//
//   1. If auth.activeContext is 'crew:{orgId}' and the user has an
//      active membership for that orgId, use it.
//   2. Otherwise, take the most recently accepted active membership.
//      This is the default for a freshly invited user before they've
//      explicitly toggled context, and for users with exactly one
//      crew membership (the common case).
//   3. If the user has zero active memberships, return null. The
//      route gate in App.tsx should already have bounced them off
//      crew routes, but the shell guards in case.

import React from 'react';
import { useAuth, type OrgMembership } from '../hooks/useAuth';

export interface ActiveMembershipResult {
  membership: OrgMembership | null;
  /** True iff activeContext explicitly named this org (vs falling
   *  back to most-recent). The shell can highlight a "you're viewing
   *  X" badge differently when it's an explicit pick. */
  isExplicit: boolean;
}

export function useActiveMembership(): ActiveMembershipResult {
  const auth = useAuth();

  return React.useMemo<ActiveMembershipResult>(() => {
    const active = auth.orgMemberships.filter((m) => m.status === 'active');
    if (active.length === 0) {
      return { membership: null, isExplicit: false };
    }

    // 1. Explicit activeContext match.
    if (auth.activeContext.startsWith('crew:')) {
      const wantedOrgId = auth.activeContext.slice(5);
      const explicit = active.find((m) => m.orgId === wantedOrgId);
      if (explicit) {
        return { membership: explicit, isExplicit: true };
      }
    }

    // 2. Most recently accepted (largest acceptedAt). null acceptedAt
    //    sorts lowest so a never-marked-accepted record only wins
    //    when nothing else is available.
    const sorted = [...active].sort((a, b) => (b.acceptedAt ?? 0) - (a.acceptedAt ?? 0));
    return { membership: sorted[0], isExplicit: false };
  }, [auth.activeContext, auth.orgMemberships]);
}
