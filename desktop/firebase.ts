/**
 * Lazy Firebase initialization for the KaiCast desktop preview.
 *
 * Reads config from VITE_FIREBASE_* env vars (Vite inlines them at
 * build time). When all 4 required values are present, exports a live
 * Firebase app + Firestore + Auth handle. When missing, exports `null`
 * so callers gracefully fall back to mock state instead of crashing.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey:            ((import.meta as any).env?.VITE_FIREBASE_API_KEY            ?? '').trim(),
  authDomain:        ((import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN        ?? '').trim(),
  projectId:         ((import.meta as any).env?.VITE_FIREBASE_PROJECT_ID         ?? '').trim(),
  storageBucket:     ((import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET     ?? '').trim(),
  messagingSenderId: ((import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '').trim(),
  appId:             ((import.meta as any).env?.VITE_FIREBASE_APP_ID             ?? '').trim(),
};

export const firebaseConfigured =
  !!config.apiKey && !!config.authDomain && !!config.projectId && !!config.appId;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

if (firebaseConfigured) {
  try {
    app = initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] init failed; falling back to mock', err);
    app = null;
    db = null;
    auth = null;
    storage = null;
  }
}

export { app, db, auth, storage };
