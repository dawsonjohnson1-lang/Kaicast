// React hook wrapper around the user-profile Firestore doc.
//
// In Firebase mode it subscribes via onSnapshot so any write to
// `users/{uid}` (from any screen, this device or another) triggers a
// re-render of every consumer instantly — that's how the navigator's
// onboarding gate flips to "complete" the moment AlmostThere writes
// onboardingComplete:true, without needing a manual refresh.
//
// In stub mode it falls back to a one-shot AsyncStorage read on mount.

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import { getUserProfile, type UserProfile } from '@/api/userProfile';

type State = {
  profile: UserProfile | null;
  loading: boolean;
};

export function useUserProfile(uid: string | undefined): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({ profile: null, loading: !!uid });

  const loadOnce = useCallback(async () => {
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
    if (!uid) {
      setState({ profile: null, loading: false });
      return;
    }
    if (firebaseConfigured && db) {
      // Live subscription — the navigator's onboarding gate watches
      // for onboardingComplete to flip to true here.
      const unsub = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (!snap.exists()) {
            setState({ profile: null, loading: false });
            return;
          }
          const data = snap.data() as any;
          setState({
            loading: false,
            profile: {
              uid,
              email: data.email,
              name: data.name,
              handle: data.handle,
              photoUrl: data.photoUrl,
              firstName: data.firstName,
              lastName: data.lastName,
              nickname: data.nickname,
              homeIsland: data.homeIsland,
              homeTown: data.homeTown,
              homeSpot: data.homeSpot,
              activities: data.activities,
              experienceLevel: data.experienceLevel,
              yearsActive: data.yearsActive,
              certification: data.certification,
              onboardingComplete: data.onboardingComplete === true,
              updatedAt: data.updatedAt?.toDate?.() ?? null,
              createdAt: data.createdAt?.toDate?.() ?? null,
            } as UserProfile,
          });
        },
        () => setState({ profile: null, loading: false }),
      );
      return unsub;
    }
    // Stub fallback — one-shot read.
    loadOnce();
  }, [uid, loadOnce]);

  return { ...state, refresh: loadOnce };
}
