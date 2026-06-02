/**
 * Auth context for the desktop preview.
 *
 * Wraps Firebase Auth's onAuthStateChanged + exposes a typed `useAuth()`
 * hook for screens. Holds the current user + a loading flag so guards
 * can wait until Firebase has reported in (otherwise a brief flash of
 * "signed-out UI" hits before Firebase rehydrates the session).
 *
 * Sign-in / sign-up helpers live here too so screens don't import
 * firebase directly — keeps the auth surface in one file.
 */

import React from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, firebaseConfigured } from '../firebase';

/** Account type. `consumer` is the default for any user who has signed
 *  up through the consumer flow; `charter` is provisioned manually by
 *  setting `accountType: 'charter'` + `orgId` on users/{uid}. The
 *  route gate in App.tsx uses this to redirect each kind of user away
 *  from the other's surface. */
export type AccountType = 'consumer' | 'charter';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** `consumer` unless users/{uid}.accountType === 'charter' is set. */
  accountType: AccountType;
  /** Org id from users/{uid}.orgId. Required for charter accounts to
   *  resolve which charter_accounts/{orgId} doc + subcollections they
   *  can read. `null` for consumer accounts. */
  orgId: string | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authLoading, setAuthLoading] = React.useState(firebaseConfigured);
  // Role + org are populated from users/{uid} via onSnapshot. We track
  // their loading state separately so the combined `loading` flag below
  // covers BOTH Firebase Auth's loading AND the role lookup — otherwise
  // a charter user would briefly see the consumer dashboard render
  // before the role doc arrives and the gate kicks in.
  const [accountType, setAccountType] = React.useState<AccountType>('consumer');
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [roleLoading, setRoleLoading] = React.useState(false);

  React.useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    getRedirectResult(auth).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[auth] redirect result error', err);
    });
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // Subscribe to users/{uid} so a role upgrade (consumer → charter) or
  // org reassignment takes effect without a sign-out/in cycle. Defaults
  // to consumer / null when the doc doesn't exist OR the field is
  // missing, so the gate fails closed against the more-permissive side
  // (consumer routes are public-ish; charter is the privileged section).
  React.useEffect(() => {
    if (!user || !db || !firebaseConfigured) {
      setAccountType('consumer');
      setOrgId(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        const at = data?.accountType === 'charter' ? 'charter' : 'consumer';
        const oid = typeof data?.orgId === 'string' && data.orgId.length > 0 ? data.orgId : null;
        setAccountType(at);
        setOrgId(oid);
        setRoleLoading(false);
      },
      () => {
        // Doc read denied or network error — fall back to consumer so
        // we don't strand the user behind a closed charter gate.
        setAccountType('consumer');
        setOrgId(null);
        setRoleLoading(false);
      },
    );
    return unsub;
  }, [user]);

  const requireAuth = () => {
    if (!auth) throw new Error('Auth not configured. Set VITE_FIREBASE_* env vars.');
    return auth;
  };

  const loading = authLoading || roleLoading;

  const value: AuthCtx = {
    user,
    loading,
    configured: firebaseConfigured,
    accountType,
    orgId,
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(requireAuth(), email, password);
    },
    signUpEmail: async (email, password, displayName) => {
      const a = requireAuth();
      const cred = await createUserWithEmailAndPassword(a, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
    },
    signInGoogle: async () => {
      const a = requireAuth();
      const provider = new GoogleAuthProvider();
      // Some browsers (Safari with strict tracking, or any environment
      // with popup blockers) silently kill the popup. We try popup
      // first because it's better UX (no full-page redirect), but fall
      // back to redirect for the second try.
      try {
        await signInWithPopup(a, provider);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(a, provider);
          return;
        }
        throw err;
      }
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(requireAuth(), email);
    },
    signOut: async () => {
      await fbSignOut(requireAuth());
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// Helper for components that just need initials from a display name or email.
export function initialsFromUser(u: User | null, fallback = '?'): string {
  if (!u) return fallback;
  if (u.displayName) {
    const parts = u.displayName.trim().split(/\s+/);
    return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
  }
  if (u.email) return u.email[0].toUpperCase();
  return fallback;
}
