/**
 * useBreakpoint — viewport-width breakpoint hook for the desktop app.
 *
 * Returns:
 *   'lg' for ≥1280 px  — design-target laptops & monitors (full layout)
 *   'md' for 1024–1279 — 13" laptops (tightened columns)
 *
 * Anything <768 px gets redirected to /mobile.html before React even
 * mounts (see desktop/index.html), so this hook never sees phone widths.
 * The 768–1023 band falls into 'md' too — iPads in landscape land here
 * and the design still works at that density.
 */

import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'lg' | 'md';

export const BREAKPOINT_LG_MIN = 1280;

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINT_LG_MIN ? 'lg' : 'md';
}

/**
 * Pick a value for the current breakpoint. Avoids verbose ternaries at
 * every callsite — `bp(lgValue, mdValue)`.
 */
export function pick<T>(breakpoint: Breakpoint, lg: T, md: T): T {
  return breakpoint === 'lg' ? lg : md;
}
