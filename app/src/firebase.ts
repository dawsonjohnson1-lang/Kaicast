// Lazy Firebase initialization for the Kaicast client.
//
// Reads config from EXPO_PUBLIC_FIREBASE_* env vars (which Expo inlines
// into the JS bundle at build time). When all six values are present,
// this module exports a live Firebase app + Auth + Firestore handles.
// When any are missing, it exports `null` — every consuming module
// (useAuth, dive-log writer, etc.) checks for null and falls back to
// a local-only stub so the app keeps working pre-config.
//
// To enable: paste the Web App config from
//   https://console.firebase.google.com/project/kaicast-207dc/settings/general
// into app/.env (see .env.example for the keys), then restart Metro
// with `npx expo start --clear`.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, type Auth } from 'firebase/auth';
// `getReactNativePersistence` is only re-exported from the
// react-native sub-path in newer firebase versions (v12+); its TS
// types aren't always carried, so we import via dynamic require to
// stay version-agnostic. AsyncStorage persistence is what makes the
// signed-in session survive app restarts.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: unknown) => unknown;
};
import {
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey:            (process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '').trim(),
  authDomain:        (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '').trim(),
  projectId:         (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim(),
  storageBucket:     (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '').trim(),
  messagingSenderId: (process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '').trim(),
  appId:             (process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '').trim(),
};

const isConfigured =
  !!config.apiKey &&
  !!config.authDomain &&
  !!config.projectId &&
  !!config.appId;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isConfigured) {
  try {
    app = initializeApp(config);
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage) as any,
    });
    // React Native's default WebChannel transport often fails to
     // deliver onSnapshot push updates (writes commit but listeners
     // never fire until next remount). Auto-detect long polling fixes
     // it without the perf cost of forcing it on every platform.
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
    storage = getStorage(app);
  } catch (err) {
    // Defensive: if init throws (e.g. a misconfigured project), don't
    // crash the bundle — keep the no-op fallbacks. Log so it surfaces.
    // eslint-disable-next-line no-console
    console.warn('[firebase] init failed, falling back to stub mode:', err);
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
}

export { app, auth, db, storage };

export const firebaseConfigured = isConfigured && app !== null;

/**
 * Throw a helpful error if a caller tries to use a Firebase handle
 * without it being configured. Call sites that depend on Firebase
 * should check `firebaseConfigured` first and fall back gracefully.
 */
export function requireFirebase<T>(handle: T | null, name: string): T {
  if (handle === null) {
    throw new Error(
      `[firebase] ${name} is not configured. Set EXPO_PUBLIC_FIREBASE_* in app/.env and restart Metro.`,
    );
  }
  return handle;
}
