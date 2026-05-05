// Firebase web SDK init. Picks config from EXPO_PUBLIC_FIREBASE_* env vars
// first, then falls back to app.json `extra.firebase`. Returns `null`
// if no config is present so the app can still run on mock data.

import Constants from 'expo-constants';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

function readConfig(): FirebaseConfig | null {
  const env = process.env as Record<string, string | undefined>;
  const fromEnv: FirebaseConfig = {
    apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    appId: env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };

  if (fromEnv.apiKey && fromEnv.appId && fromEnv.projectId) return fromEnv;

  const extra = (Constants.expoConfig?.extra as { firebase?: FirebaseConfig } | undefined)?.firebase;
  if (extra?.apiKey && extra?.appId && extra?.projectId) return extra;

  return null;
}

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _initTried = false;

function init() {
  if (_initTried) return;
  _initTried = true;
  const cfg = readConfig();
  if (!cfg) {
    if (__DEV__) {
      console.warn(
        '[KaiCast] Firebase config missing — set EXPO_PUBLIC_FIREBASE_* env vars ' +
          'or app.json extra.firebase to enable live data. Falling back to mocks.'
      );
    }
    return;
  }
  _app = getApps().length ? getApp() : initializeApp(cfg);
  _db = getFirestore(_app);
}

export function getDb(): Firestore | null {
  if (!_initTried) init();
  return _db;
}

export function isFirebaseConfigured(): boolean {
  if (!_initTried) init();
  return _db != null;
}
