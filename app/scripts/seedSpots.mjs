// One-shot script to seed the Firestore `spots` collection from the
// client mockData list. Run once with admin credentials; after this
// the client `useSpots()` hook reads live data instead of the mock.
//
// Prereqs:
//   1. Service account JSON downloaded from
//      https://console.firebase.google.com/project/kaicast-207dc/settings/serviceaccounts/adminsdk
//   2. `npm install firebase-admin` in the app/ folder (one-off; you
//      can `npm uninstall firebase-admin` after this seed runs).
//   3. Set GOOGLE_APPLICATION_CREDENTIALS to the path of that JSON.
//
// Run:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/seedSpots.mjs
//
// Idempotent — uses set() with merge so re-runs update fields rather
// than duplicating docs.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Mirror of app/src/api/mockData.ts. Kept inline to keep this script
// runnable from plain Node without TS / path-alias setup.
const SPOTS = [
  {
    id: 'electric-beach',
    name: 'Electric Beach',
    region: 'Oahu',
    lat: 21.355,
    lon: -158.122,
    visibilityFt: 56,
    rating: 'excellent',
    coverColor: '#0a3a4d',
  },
  {
    id: 'sharks-cove',
    name: "Shark's Cove",
    region: 'Oahu',
    lat: 21.6417,
    lon: -158.0617,
    visibilityFt: 48,
    rating: 'good',
    coverColor: '#0a3a4d',
  },
  {
    id: 'molokini',
    name: 'Molokini',
    region: 'Maui',
    lat: 20.633,
    lon: -156.495,
    visibilityFt: 80,
    rating: 'excellent',
    coverColor: '#0a4a3a',
  },
  {
    id: 'three-tables',
    name: 'Three Tables',
    region: 'Oahu',
    lat: 21.6367,
    lon: -158.0633,
    visibilityFt: 42,
    rating: 'good',
    coverColor: '#0c2a4d',
  },
  {
    id: 'hanauma-bay',
    name: 'Hanauma Bay',
    region: 'Oahu',
    lat: 21.2694,
    lon: -157.6939,
    visibilityFt: 35,
    rating: 'fair',
    coverColor: '#3a2a4d',
  },
  {
    id: 'makua',
    name: 'Makua Beach',
    region: 'Oahu West',
    lat: 21.5274,
    lon: -158.2295,
    visibilityFt: 28,
    rating: 'fair',
    coverColor: '#4d2a2a',
  },
  {
    id: 'mokuleia',
    name: 'Mokuleia',
    region: 'Oahu North',
    lat: 21.5783,
    lon: -158.1553,
    visibilityFt: 22,
    rating: 'hazard',
    coverColor: '#4d1a1a',
  },
];

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main() {
  const batch = db.batch();
  for (const spot of SPOTS) {
    const ref = db.collection('spots').doc(spot.id);
    const { id, ...rest } = spot;
    batch.set(ref, { ...rest, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${SPOTS.length} spots into Firestore.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
