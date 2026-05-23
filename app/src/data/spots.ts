// Canonical KaiCast spot list for the mobile app.
//
// Mirrors desktop/data/spots.ts and the SPOTS const in functions/index.js
// so all three surfaces agree on IDs, coordinates, region, and display
// names. When Firebase is wired, this list seeds the `spots` Firestore
// collection (see scripts/seedSpots.mjs) and useSpots() reads from there.
//
// Coordinate convention: lat/lon point at the on-water dive entry / boat
// anchorage so satellite hero tiles and map markers land in water, not
// on a parking lot. If you change a coord here, also update
// desktop/data/spots.ts and functions/index.js's SPOTS array — those
// three lists must agree.

import type { Spot } from '@/types';

// Rich per-spot copy for the spots that already had descriptions in the
// original 7-spot mockData list. Newly-added spots fall back to the
// shared CONDITIONAL_PLACEHOLDER_DESCRIPTION below until we write proper
// blurbs (tracked separately — most divers expect spot bios for the top
// destinations first, which is where the rich data already lives).
const RICH_DATA: Record<string, Pick<Spot, 'description' | 'entryExit' | 'marineLife' | 'coverColor'>> = {
  'electric-beach': {
    description:
      'A warm-water outflow channel from the Kahe power plant attracts pelagic species year-round. Calm water inside the cove makes for friendly free-dive entries; visibility opens up dramatically once the trade winds drop in the morning.',
    entryExit:
      'Sandy beach with a rocky shoreline. Enter on either side of the outfall — the south side is gentler. Watch for surge near the rocks at higher tides.',
    marineLife: ['Spinner Dolphins', 'Green Sea Turtles', 'Reef Sharks', 'Manta Rays', 'Eagle Rays'],
    coverColor: '#0a3a4d',
  },
  'sharks-cove': {
    description:
      "A protected lava-rock cove on the North Shore that's a Marine Life Conservation District. Best in the summer when the surf is flat — winter brings huge swells that close it out.",
    entryExit:
      "Rock entry off the parking-lot side; Three Tables to the left is gentler. Strong currents on big-swell days — don't enter in winter unless the surf is under 3 ft.",
    marineLife: ['Reef Fish', 'Green Sea Turtles', 'Octopus', 'Moray Eels'],
    coverColor: '#0a3a4d',
  },
  'three-tables': {
    description:
      "Three flat coral plateaus that surface at low tide, sheltered between Shark's Cove and Pupukea Beach. Mellow free-diving in summer, dangerous in winter.",
    entryExit:
      "Easy sand-and-rock entry directly from the beach. The tables are within 50 yards of shore — don't cross over them at low tide.",
    marineLife: ['Green Sea Turtles', 'Reef Fish', 'Octopus'],
    coverColor: '#0c2a4d',
  },
  'molokini-crater': {
    description:
      'A crescent-shaped volcanic crater off the south coast of Maui with some of the clearest water in Hawaii. Boat-only access through tour operators; the back wall drops to ~250 ft.',
    entryExit:
      'Boat-access only. Most operators run from Maalaea Harbor. Backside dive is advanced — open ocean exposure and strong currents.',
    marineLife: ['Reef Sharks', 'Eagle Rays', 'Schooling Fish', 'Trumpetfish', 'Frogfish'],
    coverColor: '#0a4a3a',
  },
};

const DEFAULT_COVER = '#0c2438';

type SpotSeed = { id: string; name: string; region: string; lat: number; lon: number };

const SEEDS: SpotSeed[] = [
  // ── Oahu ────────────────────────────────────────────────────────────
  { id: 'electric-beach',         name: 'Electric Beach',                  region: 'Oahu',       lat: 21.355,    lon: -158.140 },
  { id: 'hanauma-bay',            name: 'Hanauma Bay',                     region: 'Oahu',       lat: 21.266,    lon: -157.694 },
  { id: 'china-walls',            name: 'China Walls',                     region: 'Oahu',       lat: 21.261,    lon: -157.714 },
  { id: 'turtle-canyon',          name: 'Turtle Canyon',                   region: 'Oahu',       lat: 21.274714, lon: -157.839682 },
  { id: 'mokulua',                name: 'Mokulua Islands (the Mokes)',     region: 'Oahu',       lat: 21.395,    lon: -157.703 },
  { id: 'sharks-cove',            name: "Shark's Cove",                    region: 'Oahu',       lat: 21.6545,   lon: -158.0651 },
  { id: 'three-tables',           name: 'Three Tables',                    region: 'Oahu',       lat: 21.6483,   lon: -158.0666 },
  { id: 'pupukea-beach',          name: 'Pupukea Beach',                   region: 'Oahu',       lat: 21.6533,   lon: -158.0639 },
  { id: 'waimea-bay',             name: 'Waimea Bay',                      region: 'Oahu',       lat: 21.6411,   lon: -158.0664 },
  { id: 'turtle-reef-turtle-bay', name: 'Turtle Reef/Turtle Bay',          region: 'Oahu',       lat: 21.708,    lon: -158.005 },
  { id: 'mokuleia',               name: 'Mokuleia',                        region: 'Oahu',       lat: 21.585,    lon: -158.253 },
  { id: 'makua',                  name: 'Makua Beach',                     region: 'Oahu',       lat: 21.531,    lon: -158.240 },
  { id: 'makaha',                 name: 'Makaha',                          region: 'Oahu',       lat: 21.4691,   lon: -158.2206 },
  { id: 'magic-island',           name: 'Magic Island',                    region: 'Oahu',       lat: 21.2836,   lon: -157.8497 },
  { id: 'sandy-beach',            name: 'Sandy Beach',                     region: 'Oahu',       lat: 21.2849,   lon: -157.6717 },
  { id: 'koko-crater',            name: 'Koko Crater',                     region: 'Oahu',       lat: 21.2810,   lon: -157.6798 },
  { id: 'pearl-harbor',           name: 'Pearl Harbor',                    region: 'Oahu',       lat: 21.3650,   lon: -157.9500 },

  // ── Maui ────────────────────────────────────────────────────────────
  { id: 'airport-beach',          name: 'Airport Beach',                   region: 'Maui',       lat: 20.9042,   lon: -156.690 },
  { id: 'ala-wharf',              name: 'Ala Wharf',                       region: 'Maui',       lat: 20.8989,   lon: -156.690 },
  { id: 'black-rock-kaanapali',   name: 'Black Rock (Kaanapali)',          region: 'Maui',       lat: 20.9262,   lon: -156.7000 },
  { id: 'honolua-bay',            name: 'Honolua Bay',                     region: 'Maui',       lat: 21.014,    lon: -156.643 },
  { id: 'makena-landing',         name: 'Makena Landing',                  region: 'Maui',       lat: 20.6536,   lon: -156.4460 },
  { id: 'molokini-crater',        name: 'Molokini Crater',                 region: 'Maui',       lat: 20.6323,   lon: -156.4960 },
  { id: 'wailea-point-ulua-beach',name: 'Wailea Point/Ulua Beach',         region: 'Maui',       lat: 20.6833,   lon: -156.4475 },
  { id: 'la-perouse',             name: 'La Perouse',                      region: 'Maui',       lat: 20.5949,   lon: -156.4242 },

  // ── Kauai ───────────────────────────────────────────────────────────
  { id: 'brenneckes-ledge',       name: "Brennecke's Ledge",               region: 'Kauai',      lat: 21.870,    lon: -159.458 },
  { id: 'koloa-landing',          name: 'Koloa Landing',                   region: 'Kauai',      lat: 21.875,    lon: -159.461 },
  { id: 'niihau',                 name: "Ni'ihau",                         region: 'Kauai',      lat: 22.025,    lon: -160.100 },
  { id: 'sheraton-caverns',       name: 'Sheraton Caverns',                region: 'Kauai',      lat: 21.870,    lon: -159.466 },
  { id: 'tunnels-reef',           name: 'Tunnels Reef',                    region: 'Kauai',      lat: 22.226,    lon: -159.572 },
  { id: 'nukumoi-point',          name: 'Nukumoi Point',                   region: 'Kauai',      lat: 21.876,    lon: -159.439 },

  // ── Big Island ──────────────────────────────────────────────────────
  { id: 'kaiwi-point',            name: 'Kaiwi Point',                     region: 'Big Island', lat: 19.780,    lon: -156.025 },
  { id: 'kealakekua-bay',         name: 'Kealakekua Bay',                  region: 'Big Island', lat: 19.479,    lon: -155.928 },
  { id: 'manta-heaven',           name: 'Manta Heaven',                    region: 'Big Island', lat: 19.9636,   lon: -155.895 },
  { id: 'two-step',               name: 'Two Step',                        region: 'Big Island', lat: 19.4180,   lon: -155.9099 },
  { id: 'kahaluu-beach',          name: 'Kahaluu Beach',                   region: 'Big Island', lat: 19.5760,   lon: -155.9680 },
  { id: 'garden-eel-cove',        name: 'Garden Eel Cove',                 region: 'Big Island', lat: 19.7414,   lon: -156.0561 },
  { id: 'richardson-beach',       name: 'Richardson Beach',                region: 'Big Island', lat: 19.7370,   lon: -155.0170 },

  // ── Molokai ─────────────────────────────────────────────────────────
  { id: 'moomomi',                name: "Mo'omomi",                        region: 'Molokai',    lat: 21.196,    lon: -157.265 },
];

export const SPOTS: Spot[] = SEEDS.map((s) => ({
  ...s,
  ...(RICH_DATA[s.id] ?? { coverColor: DEFAULT_COVER }),
}));

export const SPOTS_BY_ID: Map<string, Spot> = new Map(SPOTS.map((s) => [s.id, s]));
