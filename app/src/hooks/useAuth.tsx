import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db, firebaseConfigured } from '@/firebase';

const STORAGE_KEY = 'kaicast.auth.user.v1';

export type User = {
  id: string;       // Firebase uid when configured, 'demo' otherwise
  name: string;
  handle: string;
  email: string;
  homeSpot: string;
  photoUrl?: string;
};

type AuthContextValue = {
  user: User | null;
  isAuthed: boolean;
  loading: boolean;
  /** Email / password sign-in. Falls back to a local stub when Firebase isn't configured. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Email / password account creation. Writes a stub `users/{uid}` doc on success. */
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  /** Legacy local-stub entry point — used by screens that pre-date Firebase wiring. */
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
  /** True when the underlying handle is real Firebase Auth (vs the AsyncStorage stub). */
  backedByFirebase: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Firebase-backed path ────────────────────────────────────────────
  // When `auth` is non-null we subscribe to onAuthStateChanged and
  // hydrate the User object from the Firebase user + their `users/{uid}`
  // Firestore doc. Sign-in / out delegates to the Firebase SDK.
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      const profile = await loadUserProfile(fbUser);
      setUser(profile);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── AsyncStorage stub path ──────────────────────────────────────────
  // Only runs when Firebase isn't configured. Reads the legacy persisted
  // user blob so existing demo-mode behavior keeps working.
  useEffect(() => {
    if (auth) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (auth) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return;
    }
    // Fallback stub.
    const u: User = {
      id: 'demo',
      name: email.split('@')[0] || 'Diver',
      handle: email.split('@')[0] || 'diver',
      email: email.trim(),
      homeSpot: "Three Tables, O'ahu",
    };
    setUser(u);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    if (auth && db) {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const handle = email.split('@')[0] || 'diver';
      // onboardingComplete starts false so the navigator routes the
      // newly-authed user into the onboarding stack instead of the
      // main app. CreateAccountAlmostThereScreen flips this to true.
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: email.trim(),
        handle,
        name: handle,
        onboardingComplete: false,
        createdAt: serverTimestamp(),
      });
      return;
    }
    return signInWithEmail(email, password);
  }, [signInWithEmail]);

  const signIn = useCallback(async (u: User) => {
    setUser(u);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }, []);

  const signOut = useCallback(async () => {
    if (auth) {
      await firebaseSignOut(auth);
      return;
    }
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthed: !!user,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signIn,
      signOut,
      backedByFirebase: firebaseConfigured,
    }),
    [user, loading, signInWithEmail, signUpWithEmail, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Hydrates a Firebase user into our local User shape by reading the
// `users/{uid}` Firestore doc. Falls back to email-derived defaults
// when the doc is missing (common right after sign-up before onboarding).
async function loadUserProfile(fbUser: FirebaseUser): Promise<User> {
  const fallbackName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Diver';
  const fallbackHandle = fbUser.email?.split('@')[0] || 'diver';
  const base: User = {
    id: fbUser.uid,
    name: fallbackName,
    handle: fallbackHandle,
    email: fbUser.email ?? '',
    homeSpot: "Three Tables, O'ahu",
    photoUrl: fbUser.photoURL ?? undefined,
  };
  if (!db) return base;
  try {
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    if (!snap.exists()) return base;
    const data = snap.data();
    return {
      ...base,
      name: data.name ?? base.name,
      handle: data.handle ?? base.handle,
      homeSpot: data.homeSpot ?? base.homeSpot,
      photoUrl: data.photoUrl ?? base.photoUrl,
    };
  } catch {
    return base;
  }
}
