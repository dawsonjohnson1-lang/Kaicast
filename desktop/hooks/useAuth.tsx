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
import { auth, firebaseConfigured } from '../firebase';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(firebaseConfigured);

  React.useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // Complete any pending redirect-based Google sign-in. When popup
    // is blocked we fall back to signInWithRedirect; this consumes the
    // result on the next page load. Silent on no-op.
    getRedirectResult(auth).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[auth] redirect result error', err);
    });
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const requireAuth = () => {
    if (!auth) throw new Error('Auth not configured. Set VITE_FIREBASE_* env vars.');
    return auth;
  };

  const value: AuthCtx = {
    user,
    loading,
    configured: firebaseConfigured,
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
