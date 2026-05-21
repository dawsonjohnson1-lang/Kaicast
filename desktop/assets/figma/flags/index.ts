import hawaii from './hawaii.png';

// Keyed by short region code. Hawaii ('HI') is the only flag in the design
// today; add more entries here as the design grows and look them up by code
// rather than hardcoding paths in components.
export const flags = {
  HI: hawaii,
} as const;

export type FlagKey = keyof typeof flags;
