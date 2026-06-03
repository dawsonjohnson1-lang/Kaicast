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
  | 'not-found'
  // Crew invitation accept page — public route, dynamic id in path.
  // The screen calls getCrewInvitationPublic for the unauth landing
  // state and acceptCrewInvitation once the invitee has signed in.
  | 'invite-accept'
  // ── Charter dashboard (a different product on the same hosting) ─────
  // Gated to users whose Firestore doc has accountType === 'charter'.
  // Consumer routes redirect charter users to /charter; charter routes
  // redirect non-charter users to /dashboard. The brief route is the
  // one exception — public, no auth, token-gated read-only share.
  | 'charter-home'
  | 'charter-trips'
  | 'charter-spots'
  | 'charter-log'
  | 'charter-crew'
  | 'charter-emergency'
  | 'charter-brief'
  // Self-service provisioning page — signed-in but NOT charter-gated.
  // Calls the provisionCharterOperator callable. Temporary; remove
  // when the real onboarding flow lands.
  | 'charter-setup'
  // Tabbed editor (Organization / Fleet / Harbors / Operations /
  // Account). Charter-gated. Reuses the wizard's sub-components but
  // saves per-tab instead of all-at-once.
  | 'charter-settings';

export type RouteParams = {
  spotId?: string;
  /** Which sub-tab to open on the destination screen (Profile / SpotDetail). */
  tab?: string;
  /** Where to return after successful sign-in (signin → returnTo). */
  returnTo?: RouteKey;
  /** Trip id — used by /charter/brief/:tripId and the charter log detail. */
  tripId?: string;
  /** Read-only share token — required by /charter/brief/:tripId so the
   *  trip's briefingShareToken must match the URL token before it
   *  renders anything. */
  briefToken?: string;
  /** Invitation id — required by /invite/:inviteId. The screen looks
   *  it up via the getCrewInvitationPublic callable. */
  inviteId?: string;
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
  // Charter routes require both authentication AND accountType === 'charter'.
  // The non-charter half of that check is enforced in App.tsx; the auth
  // half flows through this PRIVATE_ROUTES gate. charter-brief is
  // intentionally absent — it's a public token-gated share page.
  // charter-setup IS in PRIVATE_ROUTES but NOT in CHARTER_ROUTES so a
  // consumer-account caller can reach it to provision themselves.
  'charter-home',
  'charter-trips',
  'charter-spots',
  'charter-log',
  'charter-crew',
  'charter-emergency',
  'charter-setup',
  'charter-settings',
]);

/** Routes that require `accountType === 'charter'` in addition to auth.
 *  Non-charter users hitting these get bounced to /dashboard. The brief
 *  route is intentionally out — it's a public read-only share. */
export const CHARTER_ROUTES: ReadonlySet<RouteKey> = new Set([
  'charter-home',
  'charter-trips',
  'charter-spots',
  'charter-log',
  'charter-crew',
  'charter-emergency',
  'charter-settings',
]);

/** Routes that should redirect a CHARTER user back to /charter (the
 *  consumer surface is hidden from charter accounts entirely). The
 *  legal / public-marketing routes are NOT in this set — charters can
 *  still read /privacy, /terms, etc. */
export const CONSUMER_HOME_ROUTES: ReadonlySet<RouteKey> = new Set([
  'landing',
  'dashboard',
  'spots-map',
  'spot-detail',
  'conditions',
  'community',
  'log-dive',
  'my-dives',
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
  'invite-accept',
  // Charter shell has its own chrome (CharterNav + Emergency button);
  // the consumer footer would just be marketing noise inside a pro tool.
  'charter-home',
  'charter-trips',
  'charter-spots',
  'charter-log',
  'charter-crew',
  'charter-emergency',
  'charter-brief',
  'charter-settings',
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
  // Charter routes. charter-brief is dynamic — pathFor() embeds the
  // tripId in the path (`/charter/brief/${tripId}`); the placeholder
  // value here keeps the Record type exhaustive over RouteKey.
  'charter-home':      '/charter',
  'charter-trips':     '/charter/trips',
  'charter-spots':     '/charter/spots',
  'charter-log':       '/charter/log',
  'charter-crew':      '/charter/crew',
  'charter-emergency': '/charter/emergency',
  'charter-brief':     '/charter/brief',
  'charter-setup':     '/charter/setup',
  'charter-settings':  '/charter/settings',
  // /invite/:inviteId — dynamic; pathFor() embeds the id. The
  // placeholder value here keeps the Record exhaustive.
  'invite-accept':     '/invite',
};

const ALL_ROUTE_KEYS: ReadonlySet<string> = new Set(Object.keys(STATIC_ROUTES));

/** Serialize a route + params to a URL path (with query string). */
export function pathFor(route: RouteKey, params?: RouteParams): string {
  let path: string;
  if (route === 'spot-detail') {
    path = `/spot/${encodeURIComponent(params?.spotId ?? '')}`;
  } else if (route === 'charter-brief') {
    // /charter/brief/:tripId — tripId is required to render anything.
    // The briefToken (used to authorize access on the rendering screen)
    // rides along as a query string so the share link is one URL.
    path = `/charter/brief/${encodeURIComponent(params?.tripId ?? '')}`;
  } else if (route === 'invite-accept') {
    // /invite/:inviteId — the inviteId is the link's auth on the
    // unauth read; the accept callable layers on email-match + signed-in.
    path = `/invite/${encodeURIComponent(params?.inviteId ?? '')}`;
  } else {
    path = STATIC_ROUTES[route];
  }
  // Sub-tab + signin returnTo ride along as query string so URLs can
  // express them (e.g. /profile?tab=Settings, /signin?returnTo=profile).
  const qs = new URLSearchParams();
  if (params?.tab) qs.set('tab', params.tab);
  if (params?.returnTo) qs.set('returnTo', params.returnTo);
  if (params?.briefToken) qs.set('t', params.briefToken);
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

  // Dynamic: /charter/brief/:tripId — public share, token in `?t=`
  const briefMatch = pathname.match(/^\/charter\/brief\/([^/]+)$/);
  if (briefMatch) {
    const params: RouteParams = { tripId: decodeURIComponent(briefMatch[1]) };
    const briefToken = qs.get('t') ?? undefined;
    if (briefToken) params.briefToken = briefToken;
    return { route: 'charter-brief', params };
  }

  // Dynamic: /invite/:inviteId — public crew-invite landing page.
  const inviteMatch = pathname.match(/^\/invite\/([^/]+)$/);
  if (inviteMatch) {
    return {
      route: 'invite-accept',
      params: { inviteId: decodeURIComponent(inviteMatch[1]) },
    };
  }

  // Static routes: reverse-lookup by path.
  for (const [route, staticPath] of Object.entries(STATIC_ROUTES) as Array<[RouteKey, string]>) {
    if (route === 'spot-detail') continue;
    if (route === 'charter-brief') continue; // dynamic, handled above
    if (route === 'invite-accept') continue; // dynamic, handled above
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
