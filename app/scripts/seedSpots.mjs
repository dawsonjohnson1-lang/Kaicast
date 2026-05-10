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
    id: 'airport-beach',
    name: "Airport Beach",
    region: "Maui",
    lat: 20.9042,
    lon: -156.6833,
    coverColor: '#0a4a3a',
  },
  {
    id: 'ala-wharf',
    name: "Ala Wharf",
    region: "Maui",
    lat: 20.8989,
    lon: -156.6855,
    coverColor: '#0a4a3a',
  },
  {
    id: 'black-rock-kaanapali',
    name: "Black Rock (Kaanapali)",
    region: "Maui",
    lat: 20.926149,
    lon: -156.69621,
    coverColor: '#0a4a3a',
  },
  {
    id: 'brenneckes-ledge',
    name: "Brennecke's Ledge",
    region: "Kauai",
    lat: 21.873,
    lon: -159.458,
    coverColor: '#3a0a4d',
  },
  {
    id: 'china-walls',
    name: "China Walls",
    region: "Oahu",
    lat: 21.261473,
    lon: -157.711477,
    coverColor: '#0a3a4d',
  },
  {
    id: 'electric-beach',
    name: "Electric Beach",
    region: "Oahu",
    lat: 21.354627,
    lon: -158.13633,
    coverColor: '#0a3a4d',
  },
  {
    id: 'hanauma-bay',
    name: "Hanauma Bay",
    region: "Oahu",
    lat: 21.268517,
    lon: -157.693045,
    coverColor: '#0a3a4d',
  },
  {
    id: 'honolua-bay',
    name: "Honolua Bay",
    region: "Maui",
    lat: 21.01461,
    lon: -156.639667,
    coverColor: '#0a4a3a',
  },
  {
    id: 'kaiwi-point',
    name: "Kaiwi Point",
    region: "Big Island",
    lat: 19.78,
    lon: -156.02,
    coverColor: '#4a3a0a',
  },
  {
    id: 'kealakekua-bay',
    name: "Kealakekua Bay",
    region: "Big Island",
    lat: 19.4789,
    lon: -156.0004,
    coverColor: '#4a3a0a',
  },
  {
    id: 'koloa-landing',
    name: "Koloa Landing",
    region: "Kauai",
    lat: 21.87788,
    lon: -159.461,
    coverColor: '#3a0a4d',
  },
  {
    id: 'makena-landing',
    name: "Makena Landing",
    region: "Maui",
    lat: 20.653606,
    lon: -156.441495,
    coverColor: '#0a4a3a',
  },
  {
    id: 'makua',
    name: "Makua Beach",
    region: "Oahu",
    lat: 21.531326,
    lon: -158.234336,
    coverColor: '#0a3a4d',
  },
  {
    id: 'makua-beach',
    name: "Makua Beach",
    region: "Oahu",
    lat: 21.527379,
    lon: -158.229536,
    coverColor: '#0a3a4d',
  },
  {
    id: 'manta-heaven',
    name: "Manta Heaven",
    region: "Big Island",
    lat: 19.9636,
    lon: -155.8928,
    coverColor: '#4a3a0a',
  },
  {
    id: 'mokuleia',
    name: "Mokuleia",
    region: "Oahu",
    lat: 21.580952,
    lon: -158.253094,
    coverColor: '#0a3a4d',
  },
  {
    id: 'molokini-crater',
    name: "Molokini Crater",
    region: "Maui",
    lat: 20.6323,
    lon: -156.496,
    coverColor: '#0a4a3a',
  },
  {
    id: 'niihau',
    name: "Ni'ihau",
    region: "Kauai",
    lat: 22.025141,
    lon: -160.095816,
    coverColor: '#3a0a4d',
  },
  {
    id: 'sharks-cove',
    name: "Shark's Cove",
    region: "Oahu",
    lat: 21.654521,
    lon: -158.065133,
    coverColor: '#0a3a4d',
  },
  {
    id: 'sheraton-caverns',
    name: "Sheraton Caverns",
    region: "Kauai",
    lat: 21.8735,
    lon: -159.4663,
    coverColor: '#3a0a4d',
  },
  {
    id: 'three-tables',
    name: "Three Tables",
    region: "Oahu",
    lat: 21.6367,
    lon: -158.0633,
    coverColor: '#0a3a4d',
  },
  {
    id: 'tunnels-reef',
    name: "Tunnels Reef",
    region: "Kauai",
    lat: 22.223269,
    lon: -159.5705,
    coverColor: '#3a0a4d',
  },
  {
    id: 'turtle-canyon',
    name: "Turtle Canyon",
    region: "Oahu",
    lat: 21.274238,
    lon: -157.839264,
    coverColor: '#0a3a4d',
  },
  {
    id: 'turtle-reef-turtle-bay',
    name: "Turtle Reef/Turtle Bay",
    region: "Oahu",
    lat: 21.702485,
    lon: -158.002095,
    coverColor: '#0a3a4d',
  },
  {
    id: 'wailea-point-ulua-beach',
    name: "Wailea Point/Ulua Beach",
    region: "Maui",
    lat: 20.683277,
    lon: -156.444016,
    coverColor: '#0a4a3a',
  },
  {
    id: 'waimea-bay',
    name: "Waimea Bay",
    region: "Oahu",
    lat: 21.64139,
    lon: -158.066588,
    coverColor: '#0a3a4d',
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
