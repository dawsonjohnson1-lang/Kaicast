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
  | 'landing'
  | 'signin'
  | 'signup'
  | 'dashboard'
  | 'spot-detail'
  | 'conditions'
  | 'spots-map'
  | 'log-dive'
  | 'profile'
  | 'my-dives'
  | 'community'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'refund'
  | 'dmca'
  | 'aup';

export type RouteParams = {
  spotId?: string;
  /** Which sub-tab to open on the destination screen (Profile / SpotDetail). */
  tab?: string;
  /** Where to return after successful sign-in (signin → returnTo). */
  returnTo?: RouteKey;
};

export type NavigateFn = (route: RouteKey, params?: RouteParams) => void;

// Routes that require a signed-in user. Anonymous visitors hitting one
// of these get redirected to /signin with a returnTo back to where they
// were trying to go. Dashboard is gated too — the personalized stats /
// favorites view only makes sense with an account.
export const PRIVATE_ROUTES: ReadonlySet<RouteKey> = new Set([
  'dashboard',
  'profile',
  'my-dives',
  'log-dive',
]);

// Routes the auth screens themselves use — visiting these while signed-in
// just bounces you to the dashboard so users don't get stuck on a stale
// login form after refreshing.
export const AUTH_ROUTES: ReadonlySet<RouteKey> = new Set(['signin', 'signup']);

// Routes that the global Footer renders below. The auth + legal screens
// have their own footers / no chrome, so we skip them.
export const HIDE_FOOTER_ROUTES: ReadonlySet<RouteKey> = new Set(['signin', 'signup']);
