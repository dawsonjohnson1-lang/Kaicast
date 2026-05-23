// One-shot script to seed the Firestore `spots` collection from the
// canonical spot list. Run once with admin credentials; after this the
// client `useSpots()` hook reads live data instead of the mock fallback.
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
//
// Keep in sync with:
//   - app/src/data/spots.ts        (mobile canonical)
//   - desktop/data/spots.ts        (desktop canonical)
//   - functions/index.js SPOTS[]   (backend canonical, richer per-spot
//                                   metadata like buoyStation + coast)
// If you add or rename a spot, change all four lists.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Cover colors are region tints used as fallbacks while the satellite
// hero tile loads on the client.
const COVER = {
  oahu:     '#0a3a4d',
  maui:     '#0a4a3a',
  kauai:    '#3a0a4d',
  bigIsl:   '#4a3a0a',
  molokai:  '#0a3a4d',
};

const SPOTS = [
  // ── Oahu ────────────────────────────────────────────────────────────
  { id: 'electric-beach',         name: 'Electric Beach',                  region: 'Oahu',       lat: 21.355,    lon: -158.140,   coverColor: COVER.oahu },
  { id: 'hanauma-bay',            name: 'Hanauma Bay',                     region: 'Oahu',       lat: 21.266,    lon: -157.694,   coverColor: COVER.oahu },
  { id: 'china-walls',            name: 'China Walls',                     region: 'Oahu',       lat: 21.261,    lon: -157.714,   coverColor: COVER.oahu },
  { id: 'turtle-canyon',          name: 'Turtle Canyon',                   region: 'Oahu',       lat: 21.274714, lon: -157.839682,coverColor: COVER.oahu },
  { id: 'mokulua',                name: 'Mokulua Islands (the Mokes)',     region: 'Oahu',       lat: 21.395,    lon: -157.703,   coverColor: COVER.oahu },
  { id: 'sharks-cove',            name: "Shark's Cove",                    region: 'Oahu',       lat: 21.6545,   lon: -158.0651,  coverColor: COVER.oahu },
  { id: 'three-tables',           name: 'Three Tables',                    region: 'Oahu',       lat: 21.6483,   lon: -158.0666,  coverColor: COVER.oahu },
  { id: 'pupukea-beach',          name: 'Pupukea Beach',                   region: 'Oahu',       lat: 21.6533,   lon: -158.0639,  coverColor: COVER.oahu },
  { id: 'waimea-bay',             name: 'Waimea Bay',                      region: 'Oahu',       lat: 21.6411,   lon: -158.0664,  coverColor: COVER.oahu },
  { id: 'turtle-reef-turtle-bay', name: 'Turtle Reef/Turtle Bay',          region: 'Oahu',       lat: 21.708,    lon: -158.005,   coverColor: COVER.oahu },
  { id: 'mokuleia',               name: 'Mokuleia',                        region: 'Oahu',       lat: 21.585,    lon: -158.253,   coverColor: COVER.oahu },
  { id: 'makua',                  name: 'Makua Beach',                     region: 'Oahu',       lat: 21.531,    lon: -158.240,   coverColor: COVER.oahu },
  { id: 'makaha',                 name: 'Makaha',                          region: 'Oahu',       lat: 21.4691,   lon: -158.2206,  coverColor: COVER.oahu },
  { id: 'magic-island',           name: 'Magic Island',                    region: 'Oahu',       lat: 21.2836,   lon: -157.8497,  coverColor: COVER.oahu },
  { id: 'sandy-beach',            name: 'Sandy Beach',                     region: 'Oahu',       lat: 21.2849,   lon: -157.6717,  coverColor: COVER.oahu },
  { id: 'koko-crater',            name: 'Koko Crater',                     region: 'Oahu',       lat: 21.2810,   lon: -157.6798,  coverColor: COVER.oahu },
  { id: 'pearl-harbor',           name: 'Pearl Harbor',                    region: 'Oahu',       lat: 21.3650,   lon: -157.9500,  coverColor: COVER.oahu },

  // ── Maui ────────────────────────────────────────────────────────────
  { id: 'airport-beach',          name: 'Airport Beach',                   region: 'Maui',       lat: 20.9042,   lon: -156.690,   coverColor: COVER.maui },
  { id: 'ala-wharf',              name: 'Ala Wharf',                       region: 'Maui',       lat: 20.8989,   lon: -156.690,   coverColor: COVER.maui },
  { id: 'black-rock-kaanapali',   name: 'Black Rock (Kaanapali)',          region: 'Maui',       lat: 20.9262,   lon: -156.7000,  coverColor: COVER.maui },
  { id: 'honolua-bay',            name: 'Honolua Bay',                     region: 'Maui',       lat: 21.014,    lon: -156.643,   coverColor: COVER.maui },
  { id: 'makena-landing',         name: 'Makena Landing',                  region: 'Maui',       lat: 20.6536,   lon: -156.4460,  coverColor: COVER.maui },
  { id: 'molokini-crater',        name: 'Molokini Crater',                 region: 'Maui',       lat: 20.6323,   lon: -156.4960,  coverColor: COVER.maui },
  { id: 'wailea-point-ulua-beach',name: 'Wailea Point/Ulua Beach',         region: 'Maui',       lat: 20.6833,   lon: -156.4475,  coverColor: COVER.maui },
  { id: 'la-perouse',             name: 'La Perouse',                      region: 'Maui',       lat: 20.5949,   lon: -156.4242,  coverColor: COVER.maui },

  // ── Kauai ───────────────────────────────────────────────────────────
  { id: 'brenneckes-ledge',       name: "Brennecke's Ledge",               region: 'Kauai',      lat: 21.870,    lon: -159.458,   coverColor: COVER.kauai },
  { id: 'koloa-landing',          name: 'Koloa Landing',                   region: 'Kauai',      lat: 21.875,    lon: -159.461,   coverColor: COVER.kauai },
  { id: 'niihau',                 name: "Ni'ihau",                         region: 'Kauai',      lat: 22.025,    lon: -160.100,   coverColor: COVER.kauai },
  { id: 'sheraton-caverns',       name: 'Sheraton Caverns',                region: 'Kauai',      lat: 21.870,    lon: -159.466,   coverColor: COVER.kauai },
  { id: 'tunnels-reef',           name: 'Tunnels Reef',                    region: 'Kauai',      lat: 22.226,    lon: -159.572,   coverColor: COVER.kauai },
  { id: 'nukumoi-point',          name: 'Nukumoi Point',                   region: 'Kauai',      lat: 21.876,    lon: -159.439,   coverColor: COVER.kauai },

  // ── Big Island ──────────────────────────────────────────────────────
  { id: 'kaiwi-point',            name: 'Kaiwi Point',                     region: 'Big Island', lat: 19.780,    lon: -156.025,   coverColor: COVER.bigIsl },
  { id: 'kealakekua-bay',         name: 'Kealakekua Bay',                  region: 'Big Island', lat: 19.479,    lon: -155.928,   coverColor: COVER.bigIsl },
  { id: 'manta-heaven',           name: 'Manta Heaven',                    region: 'Big Island', lat: 19.9636,   lon: -155.895,   coverColor: COVER.bigIsl },
  { id: 'two-step',               name: 'Two Step',                        region: 'Big Island', lat: 19.4180,   lon: -155.9099,  coverColor: COVER.bigIsl },
  { id: 'kahaluu-beach',          name: 'Kahaluu Beach',                   region: 'Big Island', lat: 19.5760,   lon: -155.9680,  coverColor: COVER.bigIsl },
  { id: 'garden-eel-cove',        name: 'Garden Eel Cove',                 region: 'Big Island', lat: 19.7414,   lon: -156.0561,  coverColor: COVER.bigIsl },
  { id: 'richardson-beach',       name: 'Richardson Beach',                region: 'Big Island', lat: 19.7370,   lon: -155.0170,  coverColor: COVER.bigIsl },

  // ── Molokai ─────────────────────────────────────────────────────────
  { id: 'moomomi',                name: "Mo'omomi",                        region: 'Molokai',    lat: 21.196,    lon: -157.265,   coverColor: COVER.molokai },
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
