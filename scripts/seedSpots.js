#!/usr/bin/env node

// Seeds /spots/{spotId} with the 5 Oahu spots used by the pipeline.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seedSpots.js
//
// The service account must have Cloud Datastore User role on the
// Firebase project. Re-running is safe: it does a `set` per doc, which
// overwrites any earlier seed but does not delete fields the pipeline
// added separately.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const SPOTS = [
  {
    id: 'sharks-cove',
    name: "Shark's Cove",
    lat: 21.6417,
    lon: -158.0617,
    island: 'Oahu',
    coast: 'north',
    heroImageUrl: '',
    mapPreviewUrl: '',
    googleMapsUrl: 'https://maps.google.com/?q=Sharks+Cove+Oahu',
    guideText:
      "Volcanic-rock cove on the North Shore. Best in summer when north swells calm down. " +
      "Enter from the south end of the cove, exit on the rising tide. Watch for surge near the rocks.",
    idealConditionsText: 'Calm summer swells under 2 ft, light tradewinds, mid to high tide.',
    abilityLevel: 'Intermediate',
    abilityLevelScore: 0.55,
    entryType: 'Shore',
    maxDepthFt: 45,
    bestTimeOfDay: 'Early morning',
    parkingNotes: "Free lot across Kamehameha Hwy. Fills early on weekends.",
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
  },
  {
    id: 'three-tables',
    name: 'Three Tables',
    lat: 21.6367,
    lon: -158.0633,
    island: 'Oahu',
    coast: 'north',
    googleMapsUrl: 'https://maps.google.com/?q=Three+Tables+Beach+Oahu',
    guideText:
      'Three flat reef tables 50–80 yards offshore on the North Shore. Excellent reef life ' +
      'and easy entry on calm days. Surge can build quickly when swell is up.',
    idealConditionsText: 'Calm summer swells under 2 ft, light tradewinds.',
    abilityLevel: 'Intermediate',
    abilityLevelScore: 0.5,
    entryType: 'Shore',
    maxDepthFt: 40,
    bestTimeOfDay: 'Early morning',
    parkingNotes: 'Pulloff on Kamehameha Hwy.',
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: true,
  },
  {
    id: 'mokuleia',
    name: 'Mokuleia',
    lat: 21.5783,
    lon: -158.1553,
    island: 'Oahu',
    coast: 'north',
    googleMapsUrl: 'https://maps.google.com/?q=Mokuleia+Beach+Oahu',
    guideText:
      'Long shoreline of fringing reef with sandy entry channels. Best on glassy ' +
      'summer days when north swell is asleep. Watch for rip currents at channel exits.',
    idealConditionsText: 'Light tradewinds, swell under 2 ft.',
    abilityLevel: 'Intermediate - Advanced',
    abilityLevelScore: 0.65,
    entryType: 'Shore',
    maxDepthFt: 35,
    bestTimeOfDay: 'Morning',
    parkingNotes: 'Roadside pulloffs along Farrington Hwy.',
    maxCleanSwellFt: 2,
    hardNoGoSwellFt: 5,
    runoffSensitivity: 'medium',
    nearStreamMouth: false,
    nearDrainage: false,
  },
  {
    id: 'makua',
    name: 'Makua Beach',
    lat: 21.527379,
    lon: -158.229536,
    island: 'Oahu',
    coast: 'west',
    googleMapsUrl: 'https://maps.google.com/?q=Makua+Beach+Oahu',
    guideText:
      'Rugged west-side beach with offshore reef and frequent dolphin sightings. ' +
      'Known as the Makua / Tunnels caverns dive — boat-access only for the deep cave system.',
    idealConditionsText: 'Glassy summer mornings, no south swell, light wind.',
    abilityLevel: 'Advanced',
    abilityLevelScore: 0.85,
    entryType: 'Shore',
    maxDepthFt: 60,
    bestTimeOfDay: 'Early morning',
    parkingNotes: 'Limited parking along Farrington Hwy.',
    maxCleanSwellFt: 3,
    hardNoGoSwellFt: 6,
    runoffSensitivity: 'high',
    nearStreamMouth: true,
    nearDrainage: false,
  },
  {
    id: 'hanauma-bay',
    name: 'Hanauma Bay',
    lat: 21.2694,
    lon: -157.6939,
    island: 'Oahu',
    coast: 'south',
    googleMapsUrl: 'https://maps.google.com/?q=Hanauma+Bay+Oahu',
    guideText:
      'Protected nature preserve with a sandy beginner area inside the reef. ' +
      'Reservation required. Excellent for first-timers; advanced divers can swim out to the keyhole.',
    idealConditionsText: 'Calm conditions year-round inside the bay.',
    abilityLevel: 'Beginner - Intermediate',
    abilityLevelScore: 0.25,
    entryType: 'Shore',
    maxDepthFt: 35,
    bestTimeOfDay: 'Right at opening (7am)',
    parkingNotes: 'Park entry fee + parking fee. Reservations on hanaumabaystatepark.com.',
    maxCleanSwellFt: 4,
    hardNoGoSwellFt: 7,
    runoffSensitivity: 'low',
    nearStreamMouth: false,
    nearDrainage: false,
  },
];

async function main() {
  let written = 0;
  for (const spot of SPOTS) {
    await db.collection('spots').doc(spot.id).set(spot, { merge: true });
    console.log(`✓ ${spot.id}`);
    written++;
  }
  console.log(`\nSeeded ${written} spots.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
