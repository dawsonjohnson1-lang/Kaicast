// useUserSettings — live snapshot of the canonical Settings fields on
// /users/{uid}. Returns the spec'd nested shape so screens can read
// `s.profile.certification` etc. without remapping. Separate from
// useUserProfile (which still exposes the legacy flat shape used by
// the rest of the app) so both can coexist during the migration.

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import {
  DEFAULT_USER_SETTINGS,
  type Certification,
  type PreferredDiveType,
  type Units,
} from '@/shared/userSettings';

export interface UserSettings {
  email: string;
  phone: string;
  /** Captain's license number — gates filling out a captain's log. */
  captainLicense: string;
  profile: {
    certification: Certification;
    preferredDiveType: PreferredDiveType;
    homeSpotId: string;
  };
  prefs: {
    pushNotifications: {
      enabled: boolean;
      categories: {
        conditionAlerts: boolean;
        friendReports: boolean;
        system: boolean;
      };
    };
    units: Units;
  };
  meta: {
    updatedAt: Date | null;
    updatedBy: 'ios' | 'android' | 'web' | null;
  };
}

type State = {
  settings: UserSettings | null;
  loading: boolean;
};

const EMPTY: UserSettings = {
  email: '',
  captainLicense: '',
  ...DEFAULT_USER_SETTINGS,
  meta: { updatedAt: null, updatedBy: null },
};

export function useUserSettings(uid: string | null | undefined): State {
  const [state, setState] = useState<State>({ settings: null, loading: !!uid });

  useEffect(() => {
    if (!uid) {
      setState({ settings: null, loading: false });
      return;
    }
    if (!firebaseConfigured || !db) {
      // Stub mode — no live data, return defaults so the Settings UI
      // can still render with the same shape it'd have in prod.
      setState({ settings: EMPTY, loading: false });
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const raw = snap.exists() ? (snap.data() as any) : {};
        setState({
          loading: false,
          settings: hydrate(raw),
        });
      },
      () => setState({ settings: EMPTY, loading: false }),
    );
    return unsub;
  }, [uid]);

  return state;
}

// Merge raw Firestore doc with the spec defaults so first-time users
// (whose doc may only have onboarding fields) still get a complete
// settings object instead of `undefined` everywhere.
function hydrate(data: any): UserSettings {
  const profile = (data.profile ?? {}) as any;
  const prefs = (data.prefs ?? {}) as any;
  const pushNotifications = (prefs.pushNotifications ?? {}) as any;
  const categories = (pushNotifications.categories ?? {}) as any;
  const meta = (data.meta ?? {}) as any;
  return {
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : DEFAULT_USER_SETTINGS.phone,
    captainLicense: typeof data.captainLicense === 'string' ? data.captainLicense : '',
    profile: {
      certification: profile.certification ?? DEFAULT_USER_SETTINGS.profile.certification,
      preferredDiveType:
        profile.preferredDiveType ?? DEFAULT_USER_SETTINGS.profile.preferredDiveType,
      // Migration safety: existing docs store `homeSpot` (free-text /
      // spotId mixed). Until restructure_settings_schema.js runs we
      // accept either, preferring the canonical name.
      homeSpotId:
        profile.homeSpotId ?? data.homeSpot ?? DEFAULT_USER_SETTINGS.profile.homeSpotId,
    },
    prefs: {
      pushNotifications: {
        enabled:
          typeof pushNotifications.enabled === 'boolean'
            ? pushNotifications.enabled
            : DEFAULT_USER_SETTINGS.prefs.pushNotifications.enabled,
        categories: {
          conditionAlerts:
            typeof categories.conditionAlerts === 'boolean'
              ? categories.conditionAlerts
              : DEFAULT_USER_SETTINGS.prefs.pushNotifications.categories.conditionAlerts,
          friendReports:
            typeof categories.friendReports === 'boolean'
              ? categories.friendReports
              : DEFAULT_USER_SETTINGS.prefs.pushNotifications.categories.friendReports,
          system:
            typeof categories.system === 'boolean'
              ? categories.system
              : DEFAULT_USER_SETTINGS.prefs.pushNotifications.categories.system,
        },
      },
      units: prefs.units ?? DEFAULT_USER_SETTINGS.prefs.units,
    },
    meta: {
      updatedAt: meta.updatedAt?.toDate?.() ?? null,
      updatedBy:
        meta.updatedBy === 'ios' || meta.updatedBy === 'android' || meta.updatedBy === 'web'
          ? meta.updatedBy
          : null,
    },
  };
}
