// Vessel-type factor matrix — the single source of truth for how each
// hull behaves in a given sea state. The dashboard's per-vessel
// summaries (vesselSummary.ts) and advisory chips (conditionChips.ts)
// both read from here so a catamaran and a RIB never get the same
// read on the same conditions.
//
// MIRROR: app/src/charter/vesselFactors.ts holds the same matrix for
// the mobile app (different bundler — kept in sync by hand, like the
// four spot-list mirrors documented in CLAUDE.md). Change both.
//
// Thresholds and seasickness modifiers come straight from the charter
// spec's vessel matrix. `seasicknessModifier` scales a baseline 0–1
// risk score (1.0 = no change, <1 calmer hull, >1 rougher ride).

import type { VesselType } from './types';

/** A canonical hull-behavior class — the nine the engine reasons about.
 *  Legacy + 'other' VesselType values are folded onto these (or null)
 *  by normalizeVesselType(). */
export type VesselClass =
  | 'catamaran'
  | 'sailing_catamaran'
  | 'monohull'
  | 'sailing_monohull'
  | 'adventure_small'
  | 'sportfishing'
  | 'dive_boat'
  | 'pontoon'
  | 'fishing_rib';

export interface VesselFactors {
  /** Display label for cards / chips. */
  label: string;
  /** Short plural the prose voice uses ("the cats", "the RIBs"). */
  plural: string;
  /** True for dive-oriented hulls — unlocks thermocline / narcosis /
   *  water-temp-for-exposure chips that don't apply to a snorkel cat. */
  isDive: boolean;
  /** Multiplies the baseline seasickness risk. 0.75 = −25%, 1.6 = +60%. */
  seasicknessModifier: number;
  /** Max wind-chop (ft) the hull handles before it's a rough ride. */
  maxChopFt: number;
  /** Max sustained wind (kt) before conditions degrade for this hull. */
  maxWindKt: number;
  /** Max long-period swell (ft) that's comfortable AT OR ABOVE
   *  `swellForgivingPeriodS`. Short-period swell is treated as chop. */
  maxSwellFt: number;
  /** Swell period (s) at/above which `maxSwellFt` applies — below it the
   *  swell rides like wind-chop and the chop thresholds govern. */
  swellForgivingPeriodS: number;
  /** The hull's notable weaknesses, used to color the prose summary. */
  concerns: string[];
}

const MATRIX: Record<VesselClass, VesselFactors> = {
  catamaran: {
    label: 'Catamaran (power)',
    plural: 'the cats',
    isDive: false,
    seasicknessModifier: 0.75,
    maxChopFt: 4,
    maxWindKt: 15,
    maxSwellFt: 5,
    swellForgivingPeriodS: 10,
    concerns: [],
  },
  sailing_catamaran: {
    label: 'Sailing catamaran',
    plural: 'the sail cats',
    isDive: false,
    seasicknessModifier: 0.8,
    maxChopFt: 4,
    maxWindKt: 15,
    maxSwellFt: 5,
    swellForgivingPeriodS: 10,
    concerns: ['downwind in heavy swell gets uncomfortable', 'passengers can get cold on long offshore legs'],
  },
  monohull: {
    label: 'Monohull cruiser',
    plural: 'the monohulls',
    isDive: false,
    seasicknessModifier: 1.0,
    maxChopFt: 3,
    maxWindKt: 18,
    maxSwellFt: 5,
    swellForgivingPeriodS: 8,
    concerns: ['rolls in beam swell', 'wind-against-current makes it worse'],
  },
  sailing_monohull: {
    label: 'Sailing monohull',
    plural: 'the sailing monos',
    isDive: false,
    seasicknessModifier: 1.15,
    maxChopFt: 3,
    maxWindKt: 14,
    maxSwellFt: 4,
    swellForgivingPeriodS: 9,
    concerns: ['heels and rolls in beam seas', 'motion accumulates on inexperienced passengers'],
  },
  adventure_small: {
    label: 'Adventure small (RIB / center console)',
    plural: 'the small boats',
    isDive: false,
    seasicknessModifier: 1.5,
    maxChopFt: 2,
    maxWindKt: 12,
    maxSwellFt: 3,
    swellForgivingPeriodS: 10,
    concerns: ['short-period chop is punishing', 'wind-on-tide slop', 'passengers take spray', 'fuel burn high in rough seas'],
  },
  sportfishing: {
    label: 'Sportfishing',
    plural: 'the sportfishers',
    isDive: false,
    seasicknessModifier: 1.0,
    maxChopFt: 3,
    maxWindKt: 18,
    maxSwellFt: 4,
    // The deep-V eats long-period swell; period matters most for this hull.
    swellForgivingPeriodS: 10,
    concerns: ['drift/troll means wind-vs-current direction matters most', 'shallow-water chop + current = rough', 'fuel burn in rough seas'],
  },
  dive_boat: {
    label: 'Dive boat (specialized)',
    plural: 'the dive boats',
    isDive: true,
    seasicknessModifier: 0.8,
    maxChopFt: 3.5,
    maxWindKt: 16,
    maxSwellFt: 4,
    swellForgivingPeriodS: 9,
    concerns: ['diver entry/exit comfort is the real limit, not seaworthiness'],
  },
  pontoon: {
    label: 'Pontoon / deck boat',
    plural: 'the pontoons',
    isDive: false,
    seasicknessModifier: 1.4,
    maxChopFt: 1.5,
    maxWindKt: 12,
    maxSwellFt: 3,
    // Flat bottom tolerates long swell but hates any short wind-wave.
    swellForgivingPeriodS: 11,
    concerns: ['flat bottom is brutal in any chop', 'wind-chop combinations intolerable for most passengers'],
  },
  fishing_rib: {
    label: 'Fishing RIB',
    plural: 'the RIBs',
    isDive: false,
    seasicknessModifier: 1.6,
    maxChopFt: 1.5,
    maxWindKt: 10,
    maxSwellFt: 2.5,
    swellForgivingPeriodS: 10,
    concerns: ['bow-slams in short-period chop', 'heavy spray exposure', 'vibration + loud engines fatigue passengers'],
  },
};

/** Fold any VesselType (incl. legacy + 'other' + undefined) onto a
 *  canonical behavior class, or null when the type is unknown / unset.
 *  null means the UI must prompt the owner to pick a type — we never
 *  guess a hull's behavior. */
export function normalizeVesselType(type: VesselType | null | undefined): VesselClass | null {
  switch (type) {
    case 'catamaran':
    case 'sailing_catamaran':
    case 'monohull':
    case 'sailing_monohull':
    case 'adventure_small':
    case 'sportfishing':
    case 'dive_boat':
    case 'pontoon':
    case 'fishing_rib':
      return type;
    // Legacy fleet-doc values:
    case 'mono_sail':       return 'sailing_monohull';
    case 'center_console':  return 'adventure_small';
    case 'rib_inflatable':  return 'fishing_rib';
    case 'cabin_cruiser':   return 'monohull';
    // 'other' carries free text we can't reason about → treat as unset.
    case 'other':
    default:
      return null;
  }
}

/** Factors for a vessel type, or null when the type is unknown/unset
 *  (caller should render the "set vessel type" prompt). */
export function vesselFactors(type: VesselType | null | undefined): VesselFactors | null {
  const cls = normalizeVesselType(type);
  return cls ? MATRIX[cls] : null;
}

/** Options for a vessel-type picker (canonical classes only). */
export const VESSEL_TYPE_OPTIONS: ReadonlyArray<{ id: VesselClass; label: string }> =
  (Object.keys(MATRIX) as VesselClass[]).map((id) => ({ id, label: MATRIX[id].label }));
