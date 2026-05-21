/**
 * Lightweight route map for the desktop preview.
 *
 * Not a real router (no URL parsing, no history) — a typed enum of
 * destinations plus an optional `params` shelf that screens use when
 * navigation needs to carry context (e.g. which spot to open).
 *
 * Lives in its own file because both App.tsx and every screen import
 * the NavigateFn type, and circular imports between siblings get
 * messy without a shared module.
 */

export type RouteKey =
  | 'dashboard'
  | 'spot-detail'
  | 'conditions'
  | 'spots-map'
  | 'log-dive'
  | 'profile'
  | 'my-dives'
  | 'community';

export type RouteParams = {
  spotId?: string;
  /** Which sub-tab to open on the destination screen (Profile / SpotDetail). */
  tab?: string;
};

export type NavigateFn = (route: RouteKey, params?: RouteParams) => void;
