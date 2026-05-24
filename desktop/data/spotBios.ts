// Per-spot auto bios. These are short, factual blurbs intended to
// stand in for a real KaiCast forecaster write-up — we surface a
// disclaimer below each one in the UI so users know it's not curated.
//
// When a real human forecaster reviews and writes a proper guide
// for a spot, replace its entry here OR move the curated copy
// into a separate `CURATED_BIOS` map and key off that first.

import type { Spot } from './spots';

type Bio = string[];

const BIOS: Record<string, Bio> = {
  'electric-beach': [
    "Electric Beach (Kahe Point) sits on Oahu's leeward coast where the AES power plant's warm-water outflow draws in pelagics year-round — spinner dolphins, monk seals, eagle rays, the occasional manta.",
    "Shore-entry over boulders to a mostly sandy bottom with scattered lava patches and concrete pipes at ~35-45ft. Best in summer when the leeward swell drops; afternoons can stir up chop.",
  ],
  'hanauma-bay': [
    "Hanauma Bay is a sheltered volcanic crater on Oahu's east end — protected as a Marine Life Conservation District since 1967.",
    "Easy shore entry over a shallow reef flat then a sand channel out to the keyhole at ~10ft. Closed Mondays and Tuesdays; reservations required for non-residents. Wind chop builds in afternoon trades.",
  ],
  'china-walls': [
    "China Walls is a dramatic lava cliff dive on Oahu's southeast shore at Portlock — vertical walls drop into 30-50ft visibility most days.",
    "Advanced shore entry off the rocks; surf and surge can be serious here even on small days. Best for confident freedivers and experienced scuba teams.",
  ],
  'turtle-canyon': [
    "Turtle Canyon is the classic Waikiki boat-tour dive site — a sand channel between two reef ridges where green sea turtles gather to be cleaned.",
    "Charter access only. Calm protected water year-round on the south shore; viz is best when south swell is small and trades are light.",
  ],
  'sharks-cove': [
    "Shark's Cove sits on Oahu's north shore at Pupukea — a tide-pool-fringed cove with caves and arches once the winter swell drops.",
    "Summer only. Shore entry over slick lava; pick a calm-tide window. Marine Life Conservation District — no fishing, no collecting.",
  ],
  'three-tables': [
    "Three Tables is the calmer north-shore sister to Shark's Cove — three flat coral plateaus that surface at low tide, sheltered between Sharks Cove and Pupukea Beach.",
    "Easy sand-and-rock entry directly from the beach. The tables are within 50 yards of shore; don't cross over them at low tide. Summer only, like everything in the Pupukea zone.",
  ],
  'turtle-reef-turtle-bay': [
    "Turtle Reef sits off Kuilima Point at Turtle Bay — Oahu's northeast tip — a wide reef plateau with frequent honu (green sea turtle) sightings.",
    "Shore or short boat access depending on swell. North-facing, so winter swell shuts it down; spring-to-fall is the window.",
  ],
  'mokuleia': [
    "Mokuleia Beach Park runs along Oahu's north-shore strand between Waialua and Kaena Point — long shallow reef shelf with sandy patches.",
    "Calm summer mornings only; the reef ledge drops into deeper water about 100yds offshore. Watch for current near the Mokuleia stream mouth after rain.",
  ],
  'makua': [
    "Makua (Pray For Sex Beach) is a remote west-shore beach with offshore reef and the occasional pod of spinner dolphins on calm mornings.",
    "Long sandy entry; deep water comes up fast about 50yds out. Strong currents on the outer reef — local knowledge or a buddy who knows the bottom is essential.",
  ],
  'mokulua': [
    "The Mokulua Islands — known locally as the Mokes — are a pair of small offshore islands off Lanikai on Oahu's windward side.",
    "Kayak access from Kailua Beach is the standard. Leeward side of Moku Nui has a reef shelf at 10-30ft good for snorkel and freedive when trades are light.",
  ],

  // ── Maui ─────────────────────────────────────────────────────────
  'airport-beach': [
    "Airport Beach (Kaanapali North) is the shore-entry sister to nearby Black Rock — long flat reef just offshore with regular turtle sightings.",
    "Sandy walk-in, no surge entry. Best in mornings before the afternoon Maalaea breeze fills in across the channel.",
  ],
  'ala-wharf': [
    "Ala Wharf (Mala Pier) in Lahaina is the wreck of a 1992 pier — the storm-shattered concrete pilings are now a reef of their own with eels, schools of taape, and resident turtles.",
    "Easy beach entry next to the wharf; the wreck starts about 25yds out at 15-25ft. Surge picks up when south swell is running.",
  ],
  'black-rock-kaanapali': [
    "Black Rock (Puu Kekaa) is the lava promontory at the north end of Kaanapali Beach — a classic shore dive over reef ledges and sand channels.",
    "Walk-in from the Sheraton beach, work your way around the point. Watch for current on the outside; viz is best in the morning before chop builds.",
  ],
  'honolua-bay': [
    "Honolua Bay is a protected marine reserve on Maui's northwest tip — a deep V-shaped bay with rock walls and a healthy reef community.",
    "Shore entry through a forest trail and a short cobble walk; the south side of the bay tends to be clearer. Closed to swimming/snorkeling when winter swell hits.",
  ],
  'makena-landing': [
    "Makena Landing on Maui's south shore is an old loading-cove turned shore dive — turtle cleaning stations on the south side and an outer reef out toward Five Caves.",
    "Calm protected entry off the boat ramp. Best in the morning before the south-shore breeze picks up.",
  ],
  'molokini-crater': [
    "Molokini is a partially submerged volcanic crater 2.5 miles off Maui's south coast — one of Hawaii's most reliable visibility sites at 100+ft most days.",
    "Charter access only. Inner crater is shallow reef for snorkel; back wall drops to 250ft+ for advanced divers. Best in summer.",
  ],
  'wailea-point-ulua-beach': [
    "Ulua Beach and the Wailea Point reef system anchor south-Maui's resort-coast shore diving — gentle reef shelf with consistent turtle traffic.",
    "Sandy walk-in entry, swim out to either the Wailea Point ledges or the Ulua arches. Wind is usually offshore in the morning here.",
  ],

  // ── Kauai ────────────────────────────────────────────────────────
  'brenneckes-ledge': [
    "Brennecke's Ledge sits offshore from Poipu Beach on Kauai's sunny south shore — a long underwater shelf that drops from 30 to 60ft.",
    "Boat access. South swell can shut it down quickly in summer; calm winter mornings are the best window.",
  ],
  'koloa-landing': [
    "Koloa Landing is Kauai's most reliable south-shore shore dive — a protected cove with two short walls and the resident Lehua the green sea turtle.",
    "Easy boat-ramp entry. Diveable year-round but best when south swell is below 2ft and trades are light.",
  ],
  'niihau': [
    "The waters off Ni'ihau and Lehua Rock are Hawaii's most remote dive destination — pristine reef, regular monk seal sightings, frequent oceanic shark encounters.",
    "Liveaboard or long-charter day-trip from Kauai only. Summer charter season; the channel crossing requires a flat-trade-wind window.",
  ],
  'sheraton-caverns': [
    "Sheraton Caverns is the signature Poipu charter dive — three large lava-tube arches with resident turtles inside the dome and on the surrounding sand shelf.",
    "Boat access. Calm year-round when the south swell is small; tight summer charter rotation, book ahead.",
  ],
  'tunnels-reef': [
    "Tunnels Reef on Kauai's north shore is one of the islands' most photographed snorkels — a maze of caverns and arches in 10-30ft over a wide reef shelf.",
    "Summer only — winter swell shuts the whole north shore down. Calm mornings before the trades fill in is the window.",
  ],

  // ── Big Island ──────────────────────────────────────────────────
  'kaiwi-point': [
    "Kaiwi Point sits just outside Kailua-Kona on Big Island's calm leeward coast — a lava-point dive with deep ledges, the occasional spinner pod, and the famous Kaiwi pinnacle.",
    "Charter boat access. Year-round diveable; afternoons get bumpy when the wind picks up around the point.",
  ],
  'kealakekua-bay': [
    "Kealakekua Bay is a State Marine Life Conservation District — vertical wall, healthy reef, and the spinner dolphins that rest in the bay daily.",
    "Kayak across from Napoopoo or charter access. Protected bay, calm year-round. Permits required for kayak landing at Captain Cook monument.",
  ],
  'manta-heaven': [
    "Manta Heaven is the daytime sister of the famous Manta Village night dive — same reef plate off Keauhou where giant Pacific mantas come to feed on the plankton drawn by lights.",
    "Charter night-dive operation. Best from January through April when manta activity peaks. Bring patience; the wait under the lights is part of the experience.",
  ],
  'two-step': [
    "Two Step (Honaunau Bay / Pu'uhonua) is the classic Big Island shore-entry snorkel and dive — a lava-shelf step-down into 30-50ft of clear water inside the bay.",
    "Park at the City of Refuge lot or the boat ramp next door. Step entry can be slippery; wait for a lull and time the swell. Spinner dolphins often visit in the morning.",
  ],
  'kahaluu-beach': [
    "Kahaluu Beach Park is the most accessible snorkel and freedive spot on the Big Island's Kona coast — a protected reef enclosure with calm shallows and abundant fish.",
    "Walk-in sand entry from the beach. Watch the channel cut through the breakwater on south swell days. Excellent for beginners; crowded mid-day in summer.",
  ],
  'garden-eel-cove': [
    "Garden Eel Cove is a Kona charter favorite — a sand flat at 40-60ft north of Kailua Pier where colonies of spotted garden eels sway in the current.",
    "Boat access only. Best in summer when leeward seas are flat. Manta Village runs the night charter from the same anchorage; expect that traffic.",
  ],
  'richardson-beach': [
    "Richardson Beach is Hilo's black-sand snorkel spot on the Big Island's east shore — protected tide pools and reef pockets in 5-20ft.",
    "Walk-in entry; east-shore visibility runs murkier than Kona, so plan for 10-30ft viz and morning sessions before trades pick up. Sea turtles bask on the sand here.",
  ],

  // ── Oahu (additions) ────────────────────────────────────────────
  'pupukea-beach': [
    "Pupukea Beach Park stretches from Shark's Cove to Three Tables on Oahu's north shore — a Marine Life Conservation District protecting the reef and tide pools.",
    "Multiple entry points along the park; the south end (toward Sharks Cove) has the best shore-dive structure. Summer only — winter's NS swell closes the whole zone out.",
  ],
  'waimea-bay': [
    "Waimea Bay is Oahu's iconic big-wave winter venue — but in summer it's a calm sand-bottom cove ideal for shallow shore dives and the famous Waimea jump rock.",
    "Park in the small lot or walk in from Sharks Cove. Surf can build fast on north-swell forecasts; don't enter when waves are over 3ft, the shorebreak is brutal.",
  ],
  'magic-island': [
    "Magic Island is the artificial peninsula at the east end of Ala Moana Beach Park — a sheltered lagoon and reef shelf protected by an outer breakwater.",
    "Walk-in entry from the beach. The reef ledge runs the length of the peninsula at 8-25ft. Best at slack tide; the lagoon current can pull when the tide is changing fast.",
  ],
  'sandy-beach': [
    "Sandy Beach on Oahu's east end is a body-surfing landmark — heavy shorebreak and rip current most of the year. Dive access is reserved for the calmest summer days.",
    "Shore entry only when surf is below 2ft and trades are light. Outer reef holds tako and the occasional monk seal; treat the inner shorebreak as a no-go zone.",
  ],
  'koko-crater': [
    "Koko Crater is the offshore reef ridge just east of Hanauma Bay on Oahu's southeast tip — a deeper boat-access dive with lava arches and pelagic visitors.",
    "Charter access only. Strong current is common on the outside of the point; book with a Hanauma-area operator who knows the slack-tide window.",
  ],
  'pearl-harbor': [
    "Pearl Harbor is a national historic landmark and an active military base — recreational diving is restricted to specific permitted tour operators.",
    "No casual shore or boat access. The Arizona Memorial and surrounding waters are monitored. Use a registered tour for any in-water activity; otherwise the harbor is closed to divers.",
  ],
  'makaha': [
    "Makaha is on Oahu's west shore — a winter big-wave break, a summer reef dive, with the famous Makaha Caverns offshore.",
    "Shore-entry off the beach or boat to the caverns. Summer is the diveable window when leeward swell drops; afternoon brings the same offshore trade chop as the rest of the west side.",
  ],

  // ── Maui (additions) ────────────────────────────────────────────
  'la-perouse': [
    "La Perouse Bay is Maui's southernmost dive zone — black lava-rock entries into reef channels formed by the 1790 Haleakala eruption.",
    "4WD or long hike from the Makena pavement end. Spinner dolphins, monk seals, and the occasional manta in summer. Wind builds early — dive before 9am.",
  ],

  // ── Kauai (additions) ───────────────────────────────────────────
  'nukumoi-point': [
    "Nukumoi Point sits just off Poipu on Kauai's south shore — a reef ledge at 25-40ft that links Brennecke's Ledge to Koloa Landing.",
    "Boat or long-swim shore access from Poipu Beach. Diveable year-round when south swell is small. Sea turtles are regulars; watch for current at the point.",
  ],

  // ── Molokai (additions) ─────────────────────────────────────────
  'moomomi': [
    "Mo'omomi Preserve is Molokai's remote north-coast dive zone — protected dunes, fossil reef, and one of the few uncrowded dive sites in the main Hawaiian Islands.",
    "4WD road access from Hoolehua. Exposed north-facing coast — diveable only on flat summer days. No services; pack water and call a Molokai shop before going.",
  ],
};

const DISCLAIMER =
  "This info was a quick automated bio. We're still waiting for a KaiCast forecaster to evaluate this spot.";

/**
 * Return the about-this-spot paragraphs for a spot, plus the
 * standard "auto-bio" disclaimer. Always returns at least the
 * disclaimer — never empty.
 */
export function getSpotBio(spot: Pick<Spot, 'id' | 'name' | 'region'>): {
  paragraphs: string[];
  disclaimer: string;
} {
  const curated = BIOS[spot.id];
  if (curated) {
    return { paragraphs: curated, disclaimer: DISCLAIMER };
  }
  // Fallback template for any spot id we haven't written copy for yet.
  return {
    paragraphs: [
      `${spot.name} is a dive site on ${spot.region}. Conditions depend on the prevailing swell direction, wind, and tide for the area.`,
      `Check the live forecast above before heading out — and tag a local for entry and exit beta if you're new to this spot.`,
    ],
    disclaimer: DISCLAIMER,
  };
}
