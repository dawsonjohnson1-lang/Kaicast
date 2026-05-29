// Hawaii marine-life taxonomy for the dive log species picker.
// Desktop mirror of app/src/data/marineLife.ts — same IDs + labels so
// the same dive log doc renders identically on both surfaces.
//
// Per CLAUDE.md's "spot list" pattern, this lives in two places
// because mobile (Metro) and desktop (Vite) can't share a TS module
// out of the box. When you add/rename a species, change both files;
// scripts/check-spots-in-sync.mjs can be extended to cover this once
// drift becomes a real risk.

export type SpeciesCategoryId =
  | 'shark'
  | 'ray'
  | 'turtle'
  | 'mammal'
  | 'eel'
  | 'octopus'
  | 'pelagic'
  | 'reef-fish'
  | 'bottom-dweller'
  | 'invertebrate'
  | 'other';

export type Species = {
  id: string;
  label: string;
};

export type SpeciesCategory = {
  id: SpeciesCategoryId;
  label: string;
  emoji: string;
  species: Species[];
};

export const SPECIES_CATEGORIES: SpeciesCategory[] = [
  {
    id: 'shark',
    label: 'Shark',
    emoji: '🦈',
    species: [
      { id: 'whitetip-reef-shark',  label: 'Whitetip Reef Shark' },
      { id: 'blacktip-reef-shark',  label: 'Blacktip Reef Shark' },
      { id: 'gray-reef-shark',      label: 'Gray Reef Shark' },
      { id: 'sandbar-shark',        label: 'Sandbar Shark' },
      { id: 'galapagos-shark',      label: 'Galapagos Shark' },
      { id: 'scalloped-hammerhead', label: 'Scalloped Hammerhead' },
      { id: 'tiger-shark',          label: 'Tiger Shark' },
      { id: 'oceanic-whitetip',     label: 'Oceanic Whitetip' },
    ],
  },
  {
    id: 'ray',
    label: 'Ray',
    emoji: '🪼',
    species: [
      { id: 'manta-ray',           label: 'Manta Ray' },
      { id: 'spotted-eagle-ray',   label: 'Spotted Eagle Ray' },
      { id: 'hawaiian-stingray',   label: 'Hawaiian Stingray' },
      { id: 'broad-stingray',      label: 'Broad Stingray' },
      { id: 'devil-ray',           label: 'Devil Ray' },
    ],
  },
  {
    id: 'turtle',
    label: 'Turtle',
    emoji: '🐢',
    species: [
      { id: 'green-sea-turtle',    label: 'Green Sea Turtle (Honu)' },
      { id: 'hawksbill-turtle',    label: "Hawksbill Turtle (Honu'ea)" },
      { id: 'olive-ridley-turtle', label: 'Olive Ridley Turtle' },
    ],
  },
  {
    id: 'mammal',
    label: 'Marine Mammal',
    emoji: '🐬',
    species: [
      { id: 'spinner-dolphin',      label: 'Spinner Dolphin' },
      { id: 'bottlenose-dolphin',   label: 'Bottlenose Dolphin' },
      { id: 'spotted-dolphin',      label: 'Spotted Dolphin' },
      { id: 'monk-seal',            label: 'Hawaiian Monk Seal' },
      { id: 'humpback-whale',       label: 'Humpback Whale' },
      { id: 'false-killer-whale',   label: 'False Killer Whale' },
      { id: 'pilot-whale',          label: 'Short-finned Pilot Whale' },
    ],
  },
  {
    id: 'eel',
    label: 'Eel',
    emoji: '🪱',
    species: [
      { id: 'yellow-margin-moray',  label: 'Yellow-margin Moray' },
      { id: 'whitemouth-moray',     label: 'Whitemouth Moray' },
      { id: 'snowflake-moray',      label: 'Snowflake Moray' },
      { id: 'dragon-moray',         label: 'Dragon Moray' },
      { id: 'giant-moray',          label: 'Giant Moray' },
      { id: 'undulated-moray',      label: 'Undulated Moray' },
      { id: 'garden-eel',           label: 'Spotted Garden Eel' },
      { id: 'conger-eel',           label: 'Conger Eel' },
    ],
  },
  {
    id: 'octopus',
    label: 'Octopus & Squid',
    emoji: '🐙',
    species: [
      { id: 'day-octopus',          label: "Day Octopus (He'e)" },
      { id: 'night-octopus',        label: 'Night Octopus' },
      { id: 'bobtail-squid',        label: 'Hawaiian Bobtail Squid' },
      { id: 'reef-squid',           label: 'Bigfin Reef Squid' },
    ],
  },
  {
    id: 'pelagic',
    label: 'Pelagic Fish',
    emoji: '🐟',
    species: [
      { id: 'yellowfin-tuna',       label: 'Yellowfin Tuna (Ahi)' },
      { id: 'mahimahi',             label: 'Mahimahi' },
      { id: 'wahoo',                label: 'Wahoo (Ono)' },
      { id: 'great-barracuda',      label: 'Great Barracuda' },
      { id: 'heller-barracuda',     label: "Heller's Barracuda" },
      { id: 'giant-trevally',       label: 'Giant Trevally (Ulua)' },
      { id: 'bluefin-trevally',     label: 'Bluefin Trevally' },
      { id: 'jack-crevalle',        label: 'Jack Crevalle' },
      { id: 'rainbow-runner',       label: 'Rainbow Runner' },
    ],
  },
  {
    id: 'reef-fish',
    label: 'Reef Fish',
    emoji: '🐠',
    species: [
      { id: 'yellow-tang',          label: 'Yellow Tang' },
      { id: 'achilles-tang',        label: 'Achilles Tang' },
      { id: 'convict-tang',         label: 'Convict Tang' },
      { id: 'orangespine-unicornfish', label: 'Orangespine Unicornfish' },
      { id: 'moorish-idol',         label: 'Moorish Idol' },
      { id: 'hawaiian-sergeant',    label: 'Hawaiian Sergeant' },
      { id: 'saddle-wrasse',        label: 'Saddle Wrasse' },
      { id: 'humuhumu-trigger',     label: 'Humuhumunukunukuapuaʻa (Reef Triggerfish)' },
      { id: 'lagoon-trigger',       label: 'Lagoon Triggerfish' },
      { id: 'parrotfish',           label: 'Parrotfish (Uhu)' },
      { id: 'butterflyfish',        label: 'Butterflyfish' },
      { id: 'raccoon-butterflyfish',label: 'Raccoon Butterflyfish' },
      { id: 'milletseed-butterflyfish', label: 'Milletseed Butterflyfish' },
      { id: 'goatfish',             label: 'Goatfish (Weke)' },
      { id: 'bigeye',               label: 'Hawaiian Bigeye' },
      { id: 'cardinalfish',         label: 'Cardinalfish' },
      { id: 'damselfish',           label: 'Damselfish' },
      { id: 'pufferfish',           label: 'Spotted Pufferfish' },
      { id: 'porcupinefish',        label: 'Porcupinefish' },
      { id: 'boxfish',              label: 'Boxfish (Pakuʻikuʻi)' },
      { id: 'trumpetfish',          label: 'Trumpetfish' },
      { id: 'cornetfish',           label: 'Cornetfish' },
      { id: 'soldierfish',          label: 'Soldierfish' },
      { id: 'squirrelfish',         label: 'Squirrelfish' },
    ],
  },
  {
    id: 'bottom-dweller',
    label: 'Bottom Dweller',
    emoji: '🐡',
    species: [
      { id: 'frogfish',             label: "Commerson's Frogfish" },
      { id: 'leaf-scorpionfish',    label: 'Leaf Scorpionfish' },
      { id: 'devil-scorpionfish',   label: 'Devil Scorpionfish' },
      { id: 'crocodilefish',        label: 'Crocodilefish' },
      { id: 'flounder',             label: 'Flowery Flounder' },
      { id: 'lizardfish',           label: 'Lizardfish' },
      { id: 'sand-tilefish',        label: 'Sand Tilefish' },
      { id: 'razor-wrasse',         label: 'Razor Wrasse' },
    ],
  },
  {
    id: 'invertebrate',
    label: 'Invertebrate',
    emoji: '🦀',
    species: [
      { id: 'spiny-lobster',        label: 'Spiny Lobster (Ula)' },
      { id: 'slipper-lobster',      label: 'Slipper Lobster' },
      { id: 'reef-lobster',         label: 'Hawaiian Reef Lobster' },
      { id: '7-11-crab',            label: '7-11 Crab' },
      { id: 'hermit-crab',          label: 'Hermit Crab' },
      { id: 'spanish-dancer',       label: 'Spanish Dancer Nudibranch' },
      { id: 'gold-lace-nudibranch', label: 'Gold Lace Nudibranch' },
      { id: 'phyllidia-nudibranch', label: 'Phyllidia Nudibranch' },
      { id: 'sea-cucumber',         label: 'Sea Cucumber' },
      { id: 'crown-of-thorns',      label: 'Crown of Thorns Starfish' },
      { id: 'cushion-star',         label: 'Cushion Starfish' },
      { id: 'sea-urchin',           label: 'Sea Urchin (Wana)' },
      { id: 'pencil-urchin',        label: 'Slate Pencil Urchin' },
      { id: 'collector-urchin',     label: 'Collector Urchin' },
      { id: 'christmas-tree-worm',  label: 'Christmas Tree Worm' },
      { id: 'feather-duster-worm',  label: 'Feather Duster Worm' },
      { id: 'cone-snail',           label: 'Cone Snail' },
      { id: 'cowrie',               label: 'Hawaiian Cowrie' },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '🌊',
    species: [
      { id: 'box-jellyfish',        label: 'Hawaiian Box Jellyfish' },
      { id: 'moon-jellyfish',       label: 'Moon Jellyfish' },
      { id: 'portuguese-man-of-war',label: 'Portuguese Man-of-War' },
      { id: 'sea-snake',            label: 'Yellow-bellied Sea Snake' },
      { id: 'flying-fish',          label: 'Flying Fish' },
      { id: 'remora',               label: 'Remora' },
    ],
  },
];

export const SPECIES_BY_ID: Map<string, { categoryId: SpeciesCategoryId; label: string }> = new Map(
  SPECIES_CATEGORIES.flatMap((c) =>
    c.species.map((s) => [s.id, { categoryId: c.id, label: s.label }] as const),
  ),
);
