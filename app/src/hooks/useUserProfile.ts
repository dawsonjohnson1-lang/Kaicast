// React hook wrapper around getUserProfile — fetches once on mount,
// re-fetches when uid changes. Returns { profile, loading, refresh }.

import { useCallback, useEffect, useState } from 'react';

import { getUserProfile, type UserProfile } from '@/api/userProfile';

type State = {
  profile: UserProfile | null;
  loading: boolean;
};

export function useUserProfile(uid: string | undefined): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({ profile: null, loading: !!uid });

  const load = useCallback(async () => {
    if (!uid) {
      setState({ profile: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const profile = await getUserProfile(uid);
      setState({ profile, loading: false });
    } catch {
      setState({ profile: null, loading: false });
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
