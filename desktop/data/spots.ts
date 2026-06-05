// Canonical KaiCast spot list — mirrors the 26 spots in the live
// Firestore `spots` collection. Embedded statically so the desktop
// preview doesn't need a Firebase round-trip on first load. Keep this
// in sync with `spots/` in Firestore (admin script: scripts/seedSpots.mjs).

export type Spot = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
};

// All lat/lon are the on-water dive entry point (or anchorage for
// charter sites) so satellite hero + map markers land in the water,
// not on a beach or parking lot. Updated 2026-05-21: turtle-canyon
// moved to the leeward offshore site; three-tables + waimea-bay
// removed (clustered with Shark's Cove on the north shore).
export const SPOTS: Spot[] = [
  // ── Oahu ────────────────────────────────────────────────────────────
  { id: 'electric-beach', name: "Electric Beach", region: 'Oahu', lat: 21.355, lon: -158.140 },
  { id: 'hanauma-bay', name: "Hanauma Bay", region: 'Oahu', lat: 21.266, lon: -157.694 },
  { id: 'china-walls', name: "China Walls", region: 'Oahu', lat: 21.261, lon: -157.714 },
  { id: 'turtle-canyon', name: "Turtle Canyon", region: 'Oahu', lat: 21.274714, lon: -157.839682 },
  { id: 'mokulua', name: "Mokulua Islands (the Mokes)", region: 'Oahu', lat: 21.395, lon: -157.703 },
  { id: 'sharks-cove', name: "Shark's Cove", region: 'Oahu', lat: 21.6545, lon: -158.0651 },
  { id: 'three-tables', name: "Three Tables", region: 'Oahu', lat: 21.6483, lon: -158.0666 },
  // Pupukea Beach removed 2026-05-24: umbrella name overlapping Shark's Cove
  // + Three Tables (same Pupukea Marine Life Conservation District, identical
  // ROMS/buoy/tide data, no distinguishing topology).
  { id: 'waimea-bay', name: "Waimea Bay", region: 'Oahu', lat: 21.6411, lon: -158.0664 },
  { id: 'turtle-reef-turtle-bay', name: "Turtle Reef/Turtle Bay", region: 'Oahu', lat: 21.708, lon: -158.005 },
  { id: 'mokuleia', name: "Mokuleia", region: 'Oahu', lat: 21.585, lon: -158.253 },
  { id: 'makua', name: "Makua Beach", region: 'Oahu', lat: 21.531, lon: -158.240 },
  { id: 'makaha', name: "Makaha", region: 'Oahu', lat: 21.4691, lon: -158.2206 },
  { id: 'magic-island', name: "Magic Island", region: 'Oahu', lat: 21.2836, lon: -157.8497 },
  { id: 'sandy-beach', name: "Sandy Beach", region: 'Oahu', lat: 21.2849, lon: -157.6717 },
  // Koko Crater removed 2026-05-24: body-surf coastline duplicate of Sandy
  // Beach (~0.6 km apart, identical fetch data, no distinct dive topology).
  { id: 'pearl-harbor', name: "Pearl Harbor", region: 'Oahu', lat: 21.3650, lon: -157.9500 },

  // ── Maui ────────────────────────────────────────────────────────────
  // Airport Beach + Ala Wharf removed 2026-05-24: same Kaanapali reef strip
  // as Black Rock, ≤3 km away, identical conditions data, only differ in
  // parking-lot access. Black Rock is the anchor name for this reef.
  { id: 'black-rock-kaanapali', name: "Black Rock (Kaanapali)", region: 'Maui', lat: 20.9262, lon: -156.7000 },
  { id: 'honolua-bay', name: "Honolua Bay", region: 'Maui', lat: 21.014, lon: -156.643 },
  { id: 'makena-landing', name: "Makena Landing", region: 'Maui', lat: 20.6536, lon: -156.4460 },
  { id: 'molokini-crater', name: "Molokini Crater", region: 'Maui', lat: 20.6323, lon: -156.4960 },
  { id: 'wailea-point-ulua-beach', name: "Wailea Point/Ulua Beach", region: 'Maui', lat: 20.6833, lon: -156.4475 },
  { id: 'la-perouse', name: "La Perouse", region: 'Maui', lat: 20.5949, lon: -156.4242 },

  // ── Kauai ───────────────────────────────────────────────────────────
  { id: 'brenneckes-ledge', name: "Brennecke's Ledge", region: 'Kauai', lat: 21.870, lon: -159.458 },
  { id: 'koloa-landing', name: "Koloa Landing", region: 'Kauai', lat: 21.875, lon: -159.461 },
  { id: 'niihau', name: "Ni'ihau", region: 'Kauai', lat: 22.025, lon: -160.100 },
  { id: 'sheraton-caverns', name: "Sheraton Caverns", region: 'Kauai', lat: 21.870, lon: -159.466 },
  { id: 'tunnels-reef', name: "Tunnels Reef", region: 'Kauai', lat: 22.226, lon: -159.572 },
  // Nukumoi Point removed 2026-05-24: lesser-known fringing reef ~2 km from
  // Koloa Landing, identical fetch data, no distinguishing topology vs the
  // other Poipu spots (Koloa Landing / Sheraton Caverns / Brennecke's).

  // ── Big Island ──────────────────────────────────────────────────────
  { id: 'kaiwi-point', name: "Kaiwi Point", region: 'Big Island', lat: 19.780, lon: -156.025 },
  { id: 'kealakekua-bay', name: "Kealakekua Bay", region: 'Big Island', lat: 19.479, lon: -155.928 },
  { id: 'manta-heaven', name: "Manta Heaven", region: 'Big Island', lat: 19.9636, lon: -155.895 },
  { id: 'two-step', name: "Two Step", region: 'Big Island', lat: 19.4180, lon: -155.9099 },
  { id: 'kahaluu-beach', name: "Kahaluu Beach", region: 'Big Island', lat: 19.5760, lon: -155.9680 },
  { id: 'garden-eel-cove', name: "Garden Eel Cove", region: 'Big Island', lat: 19.7414, lon: -156.0561 },
  { id: 'richardson-beach', name: "Richardson Beach", region: 'Big Island', lat: 19.7370, lon: -155.0170 },

  // ── Molokai ─────────────────────────────────────────────────────────
  { id: 'moomomi', name: "Mo'omomi", region: 'Molokai', lat: 21.196, lon: -157.265 },
];

const SPOTS_BY_ID = new Map(SPOTS.map((s) => [s.id, s]));

function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, '')              // "Shark's" → "sharks", "Brennecke's" → "brenneckes"
    .replace(/\([^)]*\)/g, '')      // strip parentheticals: "(Kaanapali)", "(the Mokes)"
    .replace(/[/]/g, ' ')           // "Tunnels/Mākua" → "tunnels makua"
    .replace(/[^a-z0-9]+/g, '-')    // every non-alphanum run → "-"
    .replace(/^-+|-+$/g, '');       // trim leading/trailing
}

/**
 * Alternate slug used by every per-screen `slugify` helper across the
 * app — the apostrophe becomes a HYPHEN because the per-screen
 * slugify just runs `replace(/[^a-z0-9]+/g, '-')` without stripping
 * apostrophes first. That produces "shark-s-cove", "brennecke-s-ledge",
 * "ni-ihau", etc.  When a user (or the share-link generator) hits
 * /spot/shark-s-cove we need to resolve it back to the canonical
 * "sharks-cove" id, so we index both forms.
 */
function slugifyAltApostropheAsHyphen(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Build slug→spot indexes so screens calling slugify(name) hit the
// canonical entry even when the slug doesn't match the id directly
// (e.g. "Tunnels Beach" → slug "tunnels-beach" → resolves to the
// "tunnels-reef" canonical spot, "Shark's Cove" → slug
// "shark-s-cove" → resolves to "sharks-cove").
const SPOTS_BY_NAME_SLUG = new Map<string, Spot>();
const SPOTS_BY_PARTIAL = new Map<string, Spot>();
for (const s of SPOTS) {
  // Register both slug conventions per name so either lookup hits.
  SPOTS_BY_NAME_SLUG.set(slugifyName(s.name), s);
  SPOTS_BY_NAME_SLUG.set(slugifyAltApostropheAsHyphen(s.name), s);
  // First word of the name acts as a partial fallback so common short
  // forms ("black-rock" → "Black Rock (Kaanapali)") still resolve.
  const firstWord = slugifyName(s.name.split(/\s+/)[0]);
  if (firstWord && !SPOTS_BY_PARTIAL.has(firstWord)) {
    SPOTS_BY_PARTIAL.set(firstWord, s);
  }
}

// Hand-curated aliases for display-name variants that don't slug to
// the canonical id. Almost everything else now has its own canonical
// entry above; these are the few that share coordinates with another
// spot (display-only variants) and don't deserve a duplicate row.
const SPOT_ALIASES: Record<string, string> = {
  'tunnels-beach': 'tunnels-reef',                 // same spot, different display name
  'ulua-beach': 'wailea-point-ulua-beach',         // same spot, abbreviated label
};

export function findSpot(spotId: string | undefined): Spot | null {
  if (!spotId) return null;
  // 1. exact id
  const direct = SPOTS_BY_ID.get(spotId);
  if (direct) return direct;
  // 2. curated alias map
  const aliased = SPOT_ALIASES[spotId];
  if (aliased) {
    const hit = SPOTS_BY_ID.get(aliased);
    if (hit) return hit;
  }
  // 3. slugified name match (catches "tunnels-reef" requested but
  //    canonical id is "tunnels-reef" already — and "shark-s-cove"
  //    style apostrophe-splits)
  const bySlug = SPOTS_BY_NAME_SLUG.get(spotId);
  if (bySlug) return bySlug;
  // 4. first-word partial (only when nothing else matched)
  const firstWord = spotId.split('-')[0];
  const byPartial = SPOTS_BY_PARTIAL.get(firstWord);
  if (byPartial) return byPartial;
  return null;
}

/**
 * Mapbox Static Images URL — pulls a real satellite tile centered on
 * the spot's coordinates. Token read from VITE_MAPBOX_TOKEN (set in
 * `desktop/.env`). Falls back to null when unset; callers should drop
 * back to a gradient placeholder in that case.
 */
export function mapboxSatelliteUrl(
  lat: number,
  lon: number,
  width = 1200,
  height = 720,
  zoom = 15,
): string | null {
  const token =
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_MAPBOX_TOKEN) ||
    '';
  if (!token || token.length < 30) return null;
  const w = Math.max(1, Math.min(1280, Math.round(width)));
  const h = Math.max(1, Math.min(1280, Math.round(height)));
  const z = Math.max(0, Math.min(22, zoom));
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${lon.toFixed(5)},${lat.toFixed(5)},${z}/${w}x${h}@2x?access_token=${token}`
  );
}
