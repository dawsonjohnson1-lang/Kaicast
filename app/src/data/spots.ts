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

// Rich per-spot copy. Bios mirror desktop/data/spotBios.ts so the spot
// detail screen reads the same paragraphs on mobile and desktop —
// description = first paragraph (what the spot IS), entryExit = second
// paragraph (how to access + when to dive it). marineLife is mobile-
// only metadata kept for the spots that have curated lists.
const RICH_DATA: Record<string, Pick<Spot, 'description' | 'entryExit' | 'marineLife' | 'coverColor'>> = {
  // ── Oahu ────────────────────────────────────────────────────────────
  'electric-beach': {
    description:
      "Electric Beach (Kahe Point) sits on Oahu's leeward coast where the AES power plant's warm-water outflow draws in pelagics year-round — spinner dolphins, monk seals, eagle rays, the occasional manta.",
    entryExit:
      'Shore-entry over boulders to a mostly sandy bottom with scattered lava patches and concrete pipes at ~35-45ft. Best in summer when the leeward swell drops; afternoons can stir up chop.',
    marineLife: ['Spinner Dolphins', 'Green Sea Turtles', 'Reef Sharks', 'Manta Rays', 'Eagle Rays'],
    coverColor: '#0a3a4d',
  },
  'hanauma-bay': {
    description:
      "Hanauma Bay is a sheltered volcanic crater on Oahu's east end — protected as a Marine Life Conservation District since 1967.",
    entryExit:
      'Easy shore entry over a shallow reef flat then a sand channel out to the keyhole at ~10ft. Closed Mondays and Tuesdays; reservations required for non-residents. Wind chop builds in afternoon trades.',
    coverColor: '#0a3a4d',
  },
  'china-walls': {
    description:
      "China Walls is a dramatic lava cliff dive on Oahu's southeast shore at Portlock — vertical walls drop into 30-50ft visibility most days.",
    entryExit:
      'Advanced shore entry off the rocks; surf and surge can be serious here even on small days. Best for confident freedivers and experienced scuba teams.',
    coverColor: '#0a3a4d',
  },
  'turtle-canyon': {
    description:
      'Turtle Canyon is the classic Waikiki boat-tour dive site — a sand channel between two reef ridges where green sea turtles gather to be cleaned.',
    entryExit:
      'Charter access only. Calm protected water year-round on the south shore; viz is best when south swell is small and trades are light.',
    coverColor: '#0a3a4d',
  },
  'mokulua': {
    description:
      "The Mokulua Islands — known locally as the Mokes — are a pair of small offshore islands off Lanikai on Oahu's windward side.",
    entryExit:
      'Kayak access from Kailua Beach is the standard. Leeward side of Moku Nui has a reef shelf at 10-30ft good for snorkel and freedive when trades are light.',
    coverColor: '#0a3a4d',
  },
  'sharks-cove': {
    description:
      "Shark's Cove sits on Oahu's north shore at Pupukea — a tide-pool-fringed cove with caves and arches once the winter swell drops.",
    entryExit:
      'Summer only. Shore entry over slick lava; pick a calm-tide window. Marine Life Conservation District — no fishing, no collecting.',
    marineLife: ['Reef Fish', 'Green Sea Turtles', 'Octopus', 'Moray Eels'],
    coverColor: '#0a3a4d',
  },
  'three-tables': {
    description:
      "Three Tables is the calmer north-shore sister to Shark's Cove — three flat coral plateaus that surface at low tide, sheltered between Sharks Cove and Pupukea Beach.",
    entryExit:
      "Easy sand-and-rock entry directly from the beach. The tables are within 50 yards of shore; don't cross over them at low tide. Summer only, like everything in the Pupukea zone.",
    marineLife: ['Green Sea Turtles', 'Reef Fish', 'Octopus'],
    coverColor: '#0a3a4d',
  },
  'turtle-reef-turtle-bay': {
    description:
      "Turtle Reef sits off Kuilima Point at Turtle Bay — Oahu's northeast tip — a wide reef plateau with frequent honu (green sea turtle) sightings.",
    entryExit:
      'Shore or short boat access depending on swell. North-facing, so winter swell shuts it down; spring-to-fall is the window.',
    coverColor: '#0a3a4d',
  },
  'mokuleia': {
    description:
      "Mokuleia Beach Park runs along Oahu's north-shore strand between Waialua and Kaena Point — long shallow reef shelf with sandy patches.",
    entryExit:
      'Calm summer mornings only; the reef ledge drops into deeper water about 100yds offshore. Watch for current near the Mokuleia stream mouth after rain.',
    coverColor: '#0a3a4d',
  },
  'makua': {
    description:
      'Makua (Pray For Sex Beach) is a remote west-shore beach with offshore reef and the occasional pod of spinner dolphins on calm mornings.',
    entryExit:
      'Long sandy entry; deep water comes up fast about 50yds out. Strong currents on the outer reef — local knowledge or a buddy who knows the bottom is essential.',
    coverColor: '#0a3a4d',
  },

  // ── Maui ────────────────────────────────────────────────────────────
  'airport-beach': {
    description:
      'Airport Beach (Kaanapali North) is the shore-entry sister to nearby Black Rock — long flat reef just offshore with regular turtle sightings.',
    entryExit:
      'Sandy walk-in, no surge entry. Best in mornings before the afternoon Maalaea breeze fills in across the channel.',
    coverColor: '#0a4a3a',
  },
  'ala-wharf': {
    description:
      'Ala Wharf (Mala Pier) in Lahaina is the wreck of a 1992 pier — the storm-shattered concrete pilings are now a reef of their own with eels, schools of taape, and resident turtles.',
    entryExit:
      'Easy beach entry next to the wharf; the wreck starts about 25yds out at 15-25ft. Surge picks up when south swell is running.',
    coverColor: '#0a4a3a',
  },
  'black-rock-kaanapali': {
    description:
      'Black Rock (Puu Kekaa) is the lava promontory at the north end of Kaanapali Beach — a classic shore dive over reef ledges and sand channels.',
    entryExit:
      'Walk-in from the Sheraton beach, work your way around the point. Watch for current on the outside; viz is best in the morning before chop builds.',
    coverColor: '#0a4a3a',
  },
  'honolua-bay': {
    description:
      "Honolua Bay is a protected marine reserve on Maui's northwest tip — a deep V-shaped bay with rock walls and a healthy reef community.",
    entryExit:
      'Shore entry through a forest trail and a short cobble walk; the south side of the bay tends to be clearer. Closed to swimming/snorkeling when winter swell hits.',
    coverColor: '#0a4a3a',
  },
  'makena-landing': {
    description:
      "Makena Landing on Maui's south shore is an old loading-cove turned shore dive — turtle cleaning stations on the south side and an outer reef out toward Five Caves.",
    entryExit:
      'Calm protected entry off the boat ramp. Best in the morning before the south-shore breeze picks up.',
    coverColor: '#0a4a3a',
  },
  'molokini-crater': {
    description:
      "Molokini is a partially submerged volcanic crater 2.5 miles off Maui's south coast — one of Hawaii's most reliable visibility sites at 100+ft most days.",
    entryExit:
      'Charter access only. Inner crater is shallow reef for snorkel; back wall drops to 250ft+ for advanced divers. Best in summer.',
    marineLife: ['Reef Sharks', 'Eagle Rays', 'Schooling Fish', 'Trumpetfish', 'Frogfish'],
    coverColor: '#0a4a3a',
  },
  'wailea-point-ulua-beach': {
    description:
      "Ulua Beach and the Wailea Point reef system anchor south-Maui's resort-coast shore diving — gentle reef shelf with consistent turtle traffic.",
    entryExit:
      'Sandy walk-in entry, swim out to either the Wailea Point ledges or the Ulua arches. Wind is usually offshore in the morning here.',
    coverColor: '#0a4a3a',
  },

  // ── Kauai ───────────────────────────────────────────────────────────
  'brenneckes-ledge': {
    description:
      "Brennecke's Ledge sits offshore from Poipu Beach on Kauai's sunny south shore — a long underwater shelf that drops from 30 to 60ft.",
    entryExit:
      'Boat access. South swell can shut it down quickly in summer; calm winter mornings are the best window.',
    coverColor: '#3a0a4d',
  },
  'koloa-landing': {
    description:
      "Koloa Landing is Kauai's most reliable south-shore shore dive — a protected cove with two short walls and the resident Lehua the green sea turtle.",
    entryExit:
      'Easy boat-ramp entry. Diveable year-round but best when south swell is below 2ft and trades are light.',
    coverColor: '#3a0a4d',
  },
  'niihau': {
    description:
      "The waters off Ni'ihau and Lehua Rock are Hawaii's most remote dive destination — pristine reef, regular monk seal sightings, frequent oceanic shark encounters.",
    entryExit:
      'Liveaboard or long-charter day-trip from Kauai only. Summer charter season; the channel crossing requires a flat-trade-wind window.',
    coverColor: '#3a0a4d',
  },
  'sheraton-caverns': {
    description:
      'Sheraton Caverns is the signature Poipu charter dive — three large lava-tube arches with resident turtles inside the dome and on the surrounding sand shelf.',
    entryExit:
      'Boat access. Calm year-round when the south swell is small; tight summer charter rotation, book ahead.',
    coverColor: '#3a0a4d',
  },
  'tunnels-reef': {
    description:
      "Tunnels Reef on Kauai's north shore is one of the islands' most photographed snorkels — a maze of caverns and arches in 10-30ft over a wide reef shelf.",
    entryExit:
      'Summer only — winter swell shuts the whole north shore down. Calm mornings before the trades fill in is the window.',
    coverColor: '#3a0a4d',
  },

  // ── Big Island ──────────────────────────────────────────────────────
  'kaiwi-point': {
    description:
      "Kaiwi Point sits just outside Kailua-Kona on Big Island's calm leeward coast — a lava-point dive with deep ledges, the occasional spinner pod, and the famous Kaiwi pinnacle.",
    entryExit:
      'Charter boat access. Year-round diveable; afternoons get bumpy when the wind picks up around the point.',
    coverColor: '#4a3a0a',
  },
  'kealakekua-bay': {
    description:
      'Kealakekua Bay is a State Marine Life Conservation District — vertical wall, healthy reef, and the spinner dolphins that rest in the bay daily.',
    entryExit:
      'Kayak across from Napoopoo or charter access. Protected bay, calm year-round. Permits required for kayak landing at Captain Cook monument.',
    coverColor: '#4a3a0a',
  },
  'manta-heaven': {
    description:
      'Manta Heaven is the daytime sister of the famous Manta Village night dive — same reef plate off Keauhou where giant Pacific mantas come to feed on the plankton drawn by lights.',
    entryExit:
      'Charter night-dive operation. Best from January through April when manta activity peaks. Bring patience; the wait under the lights is part of the experience.',
    coverColor: '#4a3a0a',
  },
  'two-step': {
    description:
      "Two Step (Honaunau Bay / Pu'uhonua) is the classic Big Island shore-entry snorkel and dive — a lava-shelf step-down into 30-50ft of clear water inside the bay.",
    entryExit:
      'Park at the City of Refuge lot or the boat ramp next door. Step entry can be slippery; wait for a lull and time the swell. Spinner dolphins often visit in the morning.',
    coverColor: '#4a3a0a',
  },
  'kahaluu-beach': {
    description:
      "Kahaluu Beach Park is the most accessible snorkel and freedive spot on the Big Island's Kona coast — a protected reef enclosure with calm shallows and abundant fish.",
    entryExit:
      'Walk-in sand entry from the beach. Watch the channel cut through the breakwater on south swell days. Excellent for beginners; crowded mid-day in summer.',
    coverColor: '#4a3a0a',
  },
  'garden-eel-cove': {
    description:
      'Garden Eel Cove is a Kona charter favorite — a sand flat at 40-60ft north of Kailua Pier where colonies of spotted garden eels sway in the current.',
    entryExit:
      'Boat access only. Best in summer when leeward seas are flat. Manta Village runs the night charter from the same anchorage; expect that traffic.',
    coverColor: '#4a3a0a',
  },
  'richardson-beach': {
    description:
      "Richardson Beach is Hilo's black-sand snorkel spot on the Big Island's east shore — protected tide pools and reef pockets in 5-20ft.",
    entryExit:
      'Walk-in entry; east-shore visibility runs murkier than Kona, so plan for 10-30ft viz and morning sessions before trades pick up. Sea turtles bask on the sand here.',
    coverColor: '#4a3a0a',
  },

  // ── Oahu additions ──────────────────────────────────────────────────
  'pupukea-beach': {
    description:
      "Pupukea Beach Park stretches from Shark's Cove to Three Tables on Oahu's north shore — a Marine Life Conservation District protecting the reef and tide pools.",
    entryExit:
      'Multiple entry points along the park; the south end (toward Sharks Cove) has the best shore-dive structure. Summer only — winter\'s NS swell closes the whole zone out.',
    coverColor: '#0a3a4d',
  },
  'waimea-bay': {
    description:
      "Waimea Bay is Oahu's iconic big-wave winter venue — but in summer it's a calm sand-bottom cove ideal for shallow shore dives and the famous Waimea jump rock.",
    entryExit:
      "Park in the small lot or walk in from Sharks Cove. Surf can build fast on north-swell forecasts; don't enter when waves are over 3ft, the shorebreak is brutal.",
    coverColor: '#0a3a4d',
  },
  'magic-island': {
    description:
      'Magic Island is the artificial peninsula at the east end of Ala Moana Beach Park — a sheltered lagoon and reef shelf protected by an outer breakwater.',
    entryExit:
      'Walk-in entry from the beach. The reef ledge runs the length of the peninsula at 8-25ft. Best at slack tide; the lagoon current can pull when the tide is changing fast.',
    coverColor: '#0a3a4d',
  },
  'sandy-beach': {
    description:
      "Sandy Beach on Oahu's east end is a body-surfing landmark — heavy shorebreak and rip current most of the year. Dive access is reserved for the calmest summer days.",
    entryExit:
      'Shore entry only when surf is below 2ft and trades are light. Outer reef holds tako and the occasional monk seal; treat the inner shorebreak as a no-go zone.',
    coverColor: '#0a3a4d',
  },
  'koko-crater': {
    description:
      "Koko Crater is the offshore reef ridge just east of Hanauma Bay on Oahu's southeast tip — a deeper boat-access dive with lava arches and pelagic visitors.",
    entryExit:
      'Charter access only. Strong current is common on the outside of the point; book with a Hanauma-area operator who knows the slack-tide window.',
    coverColor: '#0a3a4d',
  },
  'pearl-harbor': {
    description:
      'Pearl Harbor is a national historic landmark and an active military base — recreational diving is restricted to specific permitted tour operators.',
    entryExit:
      'No casual shore or boat access. The Arizona Memorial and surrounding waters are monitored. Use a registered tour for any in-water activity; otherwise the harbor is closed to divers.',
    coverColor: '#0a3a4d',
  },
  'makaha': {
    description:
      "Makaha is on Oahu's west shore — a winter big-wave break, a summer reef dive, with the famous Makaha Caverns offshore.",
    entryExit:
      'Shore-entry off the beach or boat to the caverns. Summer is the diveable window when leeward swell drops; afternoon brings the same offshore trade chop as the rest of the west side.',
    coverColor: '#0a3a4d',
  },

  // ── Maui additions ──────────────────────────────────────────────────
  'la-perouse': {
    description:
      "La Perouse Bay is Maui's southernmost dive zone — black lava-rock entries into reef channels formed by the 1790 Haleakala eruption.",
    entryExit:
      '4WD or long hike from the Makena pavement end. Spinner dolphins, monk seals, and the occasional manta in summer. Wind builds early — dive before 9am.',
    coverColor: '#0a4a3a',
  },

  // ── Kauai additions ─────────────────────────────────────────────────
  'nukumoi-point': {
    description:
      "Nukumoi Point sits just off Poipu on Kauai's south shore — a reef ledge at 25-40ft that links Brennecke's Ledge to Koloa Landing.",
    entryExit:
      'Boat or long-swim shore access from Poipu Beach. Diveable year-round when south swell is small. Sea turtles are regulars; watch for current at the point.',
    coverColor: '#3a0a4d',
  },

  // ── Molokai additions ──────────────────────────────────────────────
  'moomomi': {
    description:
      "Mo'omomi Preserve is Molokai's remote north-coast dive zone — protected dunes, fossil reef, and one of the few uncrowded dive sites in the main Hawaiian Islands.",
    entryExit:
      '4WD road access from Hoolehua. Exposed north-facing coast — diveable only on flat summer days. No services; pack water and call a Molokai shop before going.',
    coverColor: '#0a3a4d',
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
