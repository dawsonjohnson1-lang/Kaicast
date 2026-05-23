/**
 * Route table + URL ↔ route serialization for the desktop SPA.
 *
 * Each RouteKey gets a real URL path (see STATIC_ROUTES below), so deep
 * links, browser back/forward, refresh, and per-page SEO/analytics all
 * work. App.tsx pushes to window.history on navigate() and listens to
 * popstate to handle back/forward.
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
  | 'manage-favorites'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'refund'
  | 'aup'
  | 'not-found';

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
  'manage-favorites',
]);

// Routes the auth screens themselves use — visiting these while signed-in
// just bounces you to the dashboard so users don't get stuck on a stale
// login form after refreshing.
export const AUTH_ROUTES: ReadonlySet<RouteKey> = new Set(['signin', 'signup']);

// Routes that the global Footer renders below. The auth + legal screens
// have their own footers / no chrome, so we skip them. Spots & Maps is
// also a viewport-locked layout (body overflow:hidden on mount) so the
// map stays fixed while side columns scroll — a footer would push the
// layout past 100vh and re-enable the page scroll we're trying to kill.
export const HIDE_FOOTER_ROUTES: ReadonlySet<RouteKey> = new Set([
  'signin',
  'signup',
  'spots-map',
]);

// ── URL ↔ route mapping ──────────────────────────────────────────────
// Firebase Hosting's desktop target already rewrites every path to
// /index.html (see firebase.json), and Vite's default SPA fallback
// handles dev refreshes — so no infra changes are needed.

const STATIC_ROUTES: Record<RouteKey, string> = {
  landing:       '/',
  signin:        '/signin',
  signup:        '/signup',
  dashboard:     '/dashboard',
  // spot-detail is dynamic; pathFor() embeds the spotId in the path.
  // Listed here to keep the Record exhaustive over RouteKey.
  'spot-detail': '/spot',
  conditions:    '/conditions',
  'spots-map':   '/spots',
  'log-dive':    '/log-dive',
  profile:       '/profile',
  'my-dives':    '/my-dives',
  community:     '/community',
  'manage-favorites': '/favorites',
  about:         '/about',
  terms:         '/terms',
  privacy:       '/privacy',
  cookies:       '/cookies',
  refund:        '/refund',
  aup:           '/aup',
  'not-found':   '/not-found',
};

const ALL_ROUTE_KEYS: ReadonlySet<string> = new Set(Object.keys(STATIC_ROUTES));

/** Serialize a route + params to a URL path (with query string). */
export function pathFor(route: RouteKey, params?: RouteParams): string {
  let path: string;
  if (route === 'spot-detail') {
    path = `/spot/${encodeURIComponent(params?.spotId ?? '')}`;
  } else {
    path = STATIC_ROUTES[route];
  }
  // Sub-tab + signin returnTo ride along as query string so URLs can
  // express them (e.g. /profile?tab=Settings, /signin?returnTo=profile).
  const qs = new URLSearchParams();
  if (params?.tab) qs.set('tab', params.tab);
  if (params?.returnTo) qs.set('returnTo', params.returnTo);
  const qsStr = qs.toString();
  return qsStr ? `${path}?${qsStr}` : path;
}

/** Parse window.location into a route + params. Unknown paths → landing. */
export function parseLocation(loc: { pathname: string; search: string }): {
  route: RouteKey;
  params?: RouteParams;
} {
  const qs = new URLSearchParams(loc.search);
  const tab = qs.get('tab') ?? undefined;
  const returnToRaw = qs.get('returnTo');
  const returnTo = returnToRaw && ALL_ROUTE_KEYS.has(returnToRaw)
    ? (returnToRaw as RouteKey)
    : undefined;

  const pathname = loc.pathname.replace(/\/+$/, '') || '/';

  // Dynamic: /spot/:spotId
  const spotMatch = pathname.match(/^\/spot\/([^/]+)$/);
  if (spotMatch) {
    const params: RouteParams = { spotId: decodeURIComponent(spotMatch[1]) };
    if (tab) params.tab = tab;
    if (returnTo) params.returnTo = returnTo;
    return { route: 'spot-detail', params };
  }

  // Static routes: reverse-lookup by path.
  for (const [route, staticPath] of Object.entries(STATIC_ROUTES) as Array<[RouteKey, string]>) {
    if (route === 'spot-detail') continue;
    if (staticPath === pathname) {
      const params: RouteParams = {};
      if (tab) params.tab = tab;
      if (returnTo) params.returnTo = returnTo;
      return {
        route,
        params: Object.keys(params).length ? params : undefined,
      };
    }
  }

  // Unknown path → 404 screen. (Firebase Hosting's SPA rewrite always
  // returns HTTP 200 with index.html, so a real 404 status isn't
  // possible without changing hosting config — but we at least render
  // a Not Found page so deleted routes like /dmca don't silently
  // resolve to the landing page.)
  return { route: 'not-found' };
}
