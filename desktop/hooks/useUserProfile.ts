// useUserProfile — desktop equivalent of the mobile hook. Subscribes
// to /users/{uid} via onSnapshot so the ProfileScreen and any other
// consumer rerender immediately when the user (or a Cloud Function)
// updates the doc.
//
// Both clients read the same canonical Firestore shape; this hook
// accepts either canonical (`displayName`/`photoURL`) or legacy
// (`name`/`photoUrl`) keys for backwards compat until the migration
// script (functions/migrations/unify_user_schema.js) has been run on
// prod data.

import React from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';

export interface DesktopUserProfile {
  uid: string;
  displayName: string | null;
  handle: string | null;
  photoURL: string | null;
  bio: string | null;
  homeIsland: string | null;
  homeTown: string | null;
  homeSpot: string | null;
  certification: string | null;
  // Free-text extra fields the mobile app already writes — desktop
  // doesn't render most of these yet, but exposing them here means
  // future Settings panels can edit them without another hook plumb.
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  activities: string[] | null;
  experienceLevel: string | null;
  yearsActive: number | null;
  email: string | null;
  onboardingComplete: boolean;
  updatedAt: Date | null;
  createdAt: Date | null;
}

type State = {
  profile: DesktopUserProfile | null;
  loading: boolean;
};

export function useUserProfile(uid: string | null | undefined): State {
  const [state, setState] = React.useState<State>({ profile: null, loading: !!uid });

  React.useEffect(() => {
    if (!uid) {
      setState({ profile: null, loading: false });
      return;
    }
    if (!firebaseConfigured || !db) {
      setState({ profile: null, loading: false });
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) {
          setState({ profile: null, loading: false });
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        setState({
          loading: false,
          profile: {
            uid,
            // Prefer canonical (displayName/photoURL), fall back to legacy.
            displayName: pickStr(data.displayName, data.name),
            handle: pickStr(data.handle),
            photoURL: pickStr(data.photoURL, data.photoUrl),
            bio: pickStr(data.bio),
            homeIsland: pickStr(data.homeIsland),
            homeTown: pickStr(data.homeTown),
            homeSpot: pickStr(data.homeSpot),
            certification: pickStr(data.certification),
            firstName: pickStr(data.firstName),
            lastName: pickStr(data.lastName),
            nickname: pickStr(data.nickname),
            activities: Array.isArray(data.activities)
              ? (data.activities as string[])
              : null,
            experienceLevel: pickStr(data.experienceLevel),
            yearsActive: typeof data.yearsActive === 'number' ? data.yearsActive : null,
            email: pickStr(data.email),
            onboardingComplete: data.onboardingComplete === true,
            updatedAt: toDate(data.updatedAt),
            createdAt: toDate(data.createdAt),
          },
        });
      },
      () => setState({ profile: null, loading: false }),
    );
    return unsub;
  }, [uid]);

  return state;
}

function pickStr(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

function toDate(v: unknown): Date | null {
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}
