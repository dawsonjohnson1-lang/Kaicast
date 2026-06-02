// Preset list of Hawaii small boat harbors used by the onboarding
// harbor-search field. Captains can type-ahead match against this
// list or fall through to manual lat/lng entry. Coordinates are the
// nominal harbor entrance — they're the seed coords used to populate
// the form's lat/lng inputs, captains override for their slip if
// needed.

export interface HarborPreset {
  id: string;
  name: string;
  /** Island the harbor is on — drives the default-island bias in the
   *  search-result ranking (so an Oahu-registered org sees Oahu
   *  harbors first). */
  island: 'Oahu' | 'Maui' | 'Kauai' | 'Big Island' | 'Molokai' | 'Lanai';
  lat: number;
  lng: number;
}

export const HAWAII_HARBORS: HarborPreset[] = [
  // ── Oahu ────────────────────────────────────────────────────────
  { id: 'haleiwa',         name: 'Haleiwa Small Boat Harbor',   island: 'Oahu',       lat: 21.5915, lng: -158.1098 },
  { id: 'waianae',         name: 'Waianae Small Boat Harbor',   island: 'Oahu',       lat: 21.4438, lng: -158.1859 },
  { id: 'kewalo-basin',    name: 'Kewalo Basin Harbor',         island: 'Oahu',       lat: 21.2933, lng: -157.8559 },
  { id: 'ala-wai',         name: 'Ala Wai Boat Harbor',         island: 'Oahu',       lat: 21.2861, lng: -157.8390 },
  { id: 'hawaii-kai',      name: 'Hawaii Kai Marina',           island: 'Oahu',       lat: 21.2807, lng: -157.7115 },
  { id: 'ko-olina',        name: 'Ko Olina Marina',             island: 'Oahu',       lat: 21.3329, lng: -158.1235 },
  { id: 'heeia-kea',       name: "He'eia Kea Small Boat Harbor",island: 'Oahu',       lat: 21.4395, lng: -157.8156 },
  // ── Maui ────────────────────────────────────────────────────────
  { id: 'lahaina',         name: 'Lahaina Small Boat Harbor',   island: 'Maui',       lat: 20.8716, lng: -156.6797 },
  { id: 'maalaea',         name: 'Maalaea Small Boat Harbor',   island: 'Maui',       lat: 20.7917, lng: -156.5106 },
  { id: 'kihei',           name: 'Kihei Boat Ramp',             island: 'Maui',       lat: 20.7475, lng: -156.4584 },
  { id: 'mala-wharf',      name: 'Mala Wharf Ramp',             island: 'Maui',       lat: 20.8836, lng: -156.6938 },
  // ── Big Island ──────────────────────────────────────────────────
  { id: 'honokohau',       name: 'Honokohau Harbor',            island: 'Big Island', lat: 19.6694, lng: -156.0234 },
  { id: 'kawaihae',        name: 'Kawaihae Harbor',             island: 'Big Island', lat: 20.0367, lng: -155.8284 },
  { id: 'hilo',            name: 'Hilo Bay (Wailoa Sampan Basin)', island: 'Big Island', lat: 19.7333, lng: -155.0667 },
  { id: 'keauhou',         name: 'Keauhou Bay Boat Ramp',       island: 'Big Island', lat: 19.5572, lng: -155.9627 },
  // ── Kauai ───────────────────────────────────────────────────────
  { id: 'nawiliwili',      name: 'Nawiliwili Small Boat Harbor', island: 'Kauai',     lat: 21.9550, lng: -159.3567 },
  { id: 'port-allen',      name: 'Port Allen Small Boat Harbor', island: 'Kauai',     lat: 21.8990, lng: -159.5870 },
  { id: 'kikiaola',        name: 'Kikiaola Small Boat Harbor',  island: 'Kauai',       lat: 21.9558, lng: -159.6873 },
  { id: 'hanalei',         name: 'Hanalei Pier (Seasonal)',     island: 'Kauai',       lat: 22.2087, lng: -159.5005 },
  // ── Molokai ─────────────────────────────────────────────────────
  { id: 'kaunakakai',      name: 'Kaunakakai Small Boat Harbor', island: 'Molokai',   lat: 21.0809, lng: -157.0250 },
  // ── Lanai ───────────────────────────────────────────────────────
  { id: 'manele',          name: 'Manele Small Boat Harbor',    island: 'Lanai',      lat: 20.7458, lng: -156.8867 },
];

/** Search across the preset list by case-insensitive name match.
 *  Returns the top `max` results, ranked simply by substring index
 *  (earlier match wins) then by alphabetical name. */
export function searchHarborPresets(query: string, max = 6): HarborPreset[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const scored = HAWAII_HARBORS
    .map((h) => ({ h, idx: h.name.toLowerCase().indexOf(q) }))
    .filter((s) => s.idx >= 0)
    .sort((a, b) => (a.idx - b.idx) || a.h.name.localeCompare(b.h.name));
  return scored.slice(0, max).map((s) => s.h);
}
