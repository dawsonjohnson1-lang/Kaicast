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
  { id: 'turtle-reef-turtle-bay', name: "Turtle Reef/Turtle Bay", region: 'Oahu', lat: 21.708, lon: -158.005 },
  { id: 'mokuleia', name: "Mokuleia", region: 'Oahu', lat: 21.585, lon: -158.253 },
  { id: 'makua', name: "Makua Beach", region: 'Oahu', lat: 21.531, lon: -158.240 },

  // ── Maui ────────────────────────────────────────────────────────────
  { id: 'airport-beach', name: "Airport Beach", region: 'Maui', lat: 20.9042, lon: -156.690 },
  { id: 'ala-wharf', name: "Ala Wharf", region: 'Maui', lat: 20.8989, lon: -156.690 },
  { id: 'black-rock-kaanapali', name: "Black Rock (Kaanapali)", region: 'Maui', lat: 20.9262, lon: -156.7000 },
  { id: 'honolua-bay', name: "Honolua Bay", region: 'Maui', lat: 21.014, lon: -156.643 },
  { id: 'makena-landing', name: "Makena Landing", region: 'Maui', lat: 20.6536, lon: -156.4460 },
  { id: 'molokini-crater', name: "Molokini Crater", region: 'Maui', lat: 20.6323, lon: -156.4960 },
  { id: 'wailea-point-ulua-beach', name: "Wailea Point/Ulua Beach", region: 'Maui', lat: 20.6833, lon: -156.4475 },

  // ── Kauai ───────────────────────────────────────────────────────────
  { id: 'brenneckes-ledge', name: "Brennecke's Ledge", region: 'Kauai', lat: 21.870, lon: -159.458 },
  { id: 'koloa-landing', name: "Koloa Landing", region: 'Kauai', lat: 21.875, lon: -159.461 },
  { id: 'niihau', name: "Ni'ihau", region: 'Kauai', lat: 22.025, lon: -160.100 },
  { id: 'sheraton-caverns', name: "Sheraton Caverns", region: 'Kauai', lat: 21.870, lon: -159.466 },
  { id: 'tunnels-reef', name: "Tunnels Reef", region: 'Kauai', lat: 22.226, lon: -159.572 },

  // ── Big Island ──────────────────────────────────────────────────────
  { id: 'kaiwi-point', name: "Kaiwi Point", region: 'Big Island', lat: 19.780, lon: -156.025 },
  { id: 'kealakekua-bay', name: "Kealakekua Bay", region: 'Big Island', lat: 19.479, lon: -155.928 },
  { id: 'manta-heaven', name: "Manta Heaven", region: 'Big Island', lat: 19.9636, lon: -155.895 },
];

const SPOTS_BY_ID = new Map(SPOTS.map((s) => [s.id, s]));

export function findSpot(spotId: string | undefined): Spot | null {
  if (!spotId) return null;
  return SPOTS_BY_ID.get(spotId) ?? null;
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
