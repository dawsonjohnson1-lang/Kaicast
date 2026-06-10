// Vessel-type factor matrix — MOBILE mirror of
// desktop/charter/vesselFactors.ts. Same nine hull-behavior classes,
// same seasickness modifiers + max-operable thresholds. Kept in sync by
// hand (different bundler), like the four spot-list mirrors in CLAUDE.md.

import type { VesselType } from '@/types/charter';

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
  label: string;
  plural: string;
  isDive: boolean;
  seasicknessModifier: number;
  maxChopFt: number;
  maxWindKt: number;
  maxSwellFt: number;
  swellForgivingPeriodS: number;
  concerns: string[];
}

const MATRIX: Record<VesselClass, VesselFactors> = {
  catamaran: {
    label: 'Catamaran (power)', plural: 'the cats', isDive: false,
    seasicknessModifier: 0.75, maxChopFt: 4, maxWindKt: 15, maxSwellFt: 5,
    swellForgivingPeriodS: 10, concerns: [],
  },
  sailing_catamaran: {
    label: 'Sailing catamaran', plural: 'the sail cats', isDive: false,
    seasicknessModifier: 0.8, maxChopFt: 4, maxWindKt: 15, maxSwellFt: 5,
    swellForgivingPeriodS: 10,
    concerns: ['downwind in heavy swell gets uncomfortable', 'passengers can get cold on long offshore legs'],
  },
  monohull: {
    label: 'Monohull cruiser', plural: 'the monohulls', isDive: false,
    seasicknessModifier: 1.0, maxChopFt: 3, maxWindKt: 18, maxSwellFt: 5,
    swellForgivingPeriodS: 8,
    concerns: ['rolls in beam swell', 'wind-against-current makes it worse'],
  },
  sailing_monohull: {
    label: 'Sailing monohull', plural: 'the sailing monos', isDive: false,
    seasicknessModifier: 1.15, maxChopFt: 3, maxWindKt: 14, maxSwellFt: 4,
    swellForgivingPeriodS: 9,
    concerns: ['heels and rolls in beam seas', 'motion accumulates on inexperienced passengers'],
  },
  adventure_small: {
    label: 'Adventure small (RIB / center console)', plural: 'the small boats', isDive: false,
    seasicknessModifier: 1.5, maxChopFt: 2, maxWindKt: 12, maxSwellFt: 3,
    swellForgivingPeriodS: 10,
    concerns: ['short-period chop is punishing', 'wind-on-tide slop', 'passengers take spray', 'fuel burn high in rough seas'],
  },
  sportfishing: {
    label: 'Sportfishing', plural: 'the sportfishers', isDive: false,
    seasicknessModifier: 1.0, maxChopFt: 3, maxWindKt: 18, maxSwellFt: 4,
    swellForgivingPeriodS: 10,
    concerns: ['drift/troll means wind-vs-current direction matters most', 'shallow-water chop + current = rough', 'fuel burn in rough seas'],
  },
  dive_boat: {
    label: 'Dive boat (specialized)', plural: 'the dive boats', isDive: true,
    seasicknessModifier: 0.8, maxChopFt: 3.5, maxWindKt: 16, maxSwellFt: 4,
    swellForgivingPeriodS: 9,
    concerns: ['diver entry/exit comfort is the real limit, not seaworthiness'],
  },
  pontoon: {
    label: 'Pontoon / deck boat', plural: 'the pontoons', isDive: false,
    seasicknessModifier: 1.4, maxChopFt: 1.5, maxWindKt: 12, maxSwellFt: 3,
    swellForgivingPeriodS: 11,
    concerns: ['flat bottom is brutal in any chop', 'wind-chop combinations intolerable for most passengers'],
  },
  fishing_rib: {
    label: 'Fishing RIB', plural: 'the RIBs', isDive: false,
    seasicknessModifier: 1.6, maxChopFt: 1.5, maxWindKt: 10, maxSwellFt: 2.5,
    swellForgivingPeriodS: 10,
    concerns: ['bow-slams in short-period chop', 'heavy spray exposure', 'vibration + loud engines fatigue passengers'],
  },
};

/** Fold any VesselType (incl. legacy + 'other' + undefined) onto a
 *  canonical class, or null when unknown/unset (UI must prompt). */
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
    case 'mono_sail':       return 'sailing_monohull';
    case 'center_console':  return 'adventure_small';
    case 'rib_inflatable':  return 'fishing_rib';
    case 'cabin_cruiser':   return 'monohull';
    case 'other':
    default:
      return null;
  }
}

export function vesselFactors(type: VesselType | null | undefined): VesselFactors | null {
  const cls = normalizeVesselType(type);
  return cls ? MATRIX[cls] : null;
}

export const VESSEL_TYPE_OPTIONS: ReadonlyArray<{ id: VesselClass; label: string }> =
  (Object.keys(MATRIX) as VesselClass[]).map((id) => ({ id, label: MATRIX[id].label }));
