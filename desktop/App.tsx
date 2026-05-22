import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts } from './tokens';
import {
  AUTH_ROUTES,
  HIDE_FOOTER_ROUTES,
  PRIVATE_ROUTES,
  parseLocation,
  pathFor,
  type NavigateFn,
  type RouteKey,
  type RouteParams,
} from './router';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { Footer } from './components/Footer';
import { CookieBanner } from './components/CookieBanner';

import { SpotDetailScreen } from './SpotDetailScreen';
import { ConditionsScreen } from './ConditionsScreen';
import { SpotsMapScreen } from './SpotsMapScreen';
import { DashboardScreen } from './DashboardScreen';
import { ProfileScreen } from './ProfileScreen';
import { LogDiveScreen } from './LogDiveScreen';
import { MyDivesScreen } from './MyDivesScreen';
import { CommunityScreen } from './CommunityScreen';
import { LandingScreen } from './LandingScreen';
import { ManageFavoritesScreen } from './ManageFavoritesScreen';
import { AuthScreen } from './AuthScreen';
import { LegalScreen, type LegalDoc } from './LegalScreen';

/**
 * Desktop app shell.
 *
 *  - <AuthProvider> wraps the whole tree so screens can read/write auth.
 *  - AppInner handles route gating: signed-out users on private routes
 *    bounce to /signin; signed-in users on /signin or /signup bounce to
 *    /dashboard.
 *  - Routing is URL-driven: window.location is the source of truth, we
 *    pushState() on navigate, and listen to popstate for back/forward.
 *    No more localStorage-stashed route — refresh + deep links + SEO
 *    just work.
 *  - Footer + cookie banner sit beneath every screen unless suppressed
 *    (auth screens are intentionally chrome-free).
 */

const SCREENS: Record<RouteKey, React.ComponentType<any>> = {
  'landing':      LandingScreen,
  'signin':       (p: any) => <AuthScreen mode="signin" {...p} />,
  'signup':       (p: any) => <AuthScreen mode="signup" {...p} />,
  'dashboard':    DashboardScreen,
  'spot-detail':  SpotDetailScreen,
  'conditions':   ConditionsScreen,
  'spots-map':    SpotsMapScreen,
  'log-dive':     LogDiveScreen,
  'profile':      ProfileScreen,
  'my-dives':     MyDivesScreen,
  'community':    CommunityScreen,
  'manage-favorites': ManageFavoritesScreen,
  'terms':        (p: any) => <LegalScreen doc="terms" {...p} />,
  'privacy':      (p: any) => <LegalScreen doc="privacy" {...p} />,
  'cookies':      (p: any) => <LegalScreen doc="cookies" {...p} />,
  'refund':       (p: any) => <LegalScreen doc="refund" {...p} />,
  'aup':          (p: any) => <LegalScreen doc="aup" {...p} />,
  'not-found':    NotFoundScreen,
};

function NotFoundScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  // Set the page title so the tab + crawlers see "Not found" even
  // though Firebase Hosting can't return a real 404 status given the
  // SPA fallback config.
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const prev = document.title;
      document.title = 'Not found · KaiCast';
      return () => { document.title = prev; };
    }
  }, []);
  return (
    <View style={notFoundStyles.wrap}>
      <Text style={notFoundStyles.code}>404</Text>
      <Text style={notFoundStyles.title}>Page not found</Text>
      <Text style={notFoundStyles.body}>
        The page you’re looking for has moved or no longer exists.
      </Text>
      <Pressable style={notFoundStyles.cta} onPress={() => onNavigate?.('spots-map')}>
        <Text style={notFoundStyles.ctaText}>Back to the map</Text>
      </Pressable>
    </View>
  );
}

const notFoundStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: '60vh' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
    gap: 12,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 48,
    letterSpacing: 4,
    color: colors.text3,
    fontWeight: '700',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text1,
    fontWeight: '700',
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text3,
    textAlign: 'center',
    maxWidth: 420,
  },
  cta: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  ctaText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#04070d',
    fontWeight: '600',
  },
});

// Set the first time a user successfully signs in so we can distinguish
// brand-new accounts (land on the map after sign-in for the orientation
// tour) from returning users (land on the dashboard every time).
const LS_RETURNING_KEY = 'kaicast.desktop.returningUser';

type Frame = { route: RouteKey; params?: RouteParams };

export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const auth = useAuth();

  // URL is the source of truth. Initialize from window.location; unknown
  // paths fall back to landing inside parseLocation.
  const [current, setCurrent] = React.useState<Frame>(() => {
    if (typeof window !== 'undefined' && window.location) {
      return parseLocation(window.location);
    }
    return { route: 'landing' };
  });
  // Bumped on every navigate() call (NOT on back/forward) — used as a
  // React key so clicking a link to the same route remounts the screen,
  // while back/forward reuses the existing instance.
  const [navTick, setNavTick] = React.useState(0);

  const navigate: NavigateFn = React.useCallback((route, params) => {
    const next: Frame = { route, params };
    setCurrent(next);
    setNavTick((t) => t + 1);
    if (typeof window !== 'undefined') {
      const url = pathFor(route, params);
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== url) window.history.pushState({}, '', url);
      window.scrollTo(0, 0);
    }
  }, []);

  // Back/forward: parse the new URL and update state. Don't pushState —
  // the browser already moved the history cursor for us.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      setCurrent(parseLocation(window.location));
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // If the initial URL didn't match a known route, parseLocation coerced
  // us to landing — replaceState so the URL bar reflects what we render.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const canonical = pathFor(current.route, current.params);
    const actual = window.location.pathname + window.location.search;
    if (actual !== canonical) {
      window.history.replaceState({}, '', canonical);
    }
    // Run-once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Route gate ──
  // Compute the route we should actually render, given auth state.
  // We don't mutate the URL here — we just swap the screen. This means
  // after sign-in, the user lands on whatever they originally asked for
  // (via params.returnTo on the signin frame, if it was set).
  const effective = computeEffectiveFrame(current, auth.user != null, auth.loading);

  // After sign-in, route based on history:
  //   - signin had a returnTo → honor it (user was bounced from a
  //     private route)
  //   - first-ever login on this browser → land on the spots map so
  //     they can explore before getting the dashboard firehose
  //   - returning user → straight to dashboard
  // We set a localStorage flag on the first successful sign-in so the
  // "first vs returning" distinction survives refreshes.
  React.useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return;
    if (current.route !== 'signin' && current.route !== 'signup') return;
    const returnTo = current.params?.returnTo;
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    const isReturning = typeof window !== 'undefined'
      ? !!window.localStorage?.getItem(LS_RETURNING_KEY)
      : false;
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(LS_RETURNING_KEY, '1');
    }
    navigate(isReturning ? 'dashboard' : 'spots-map');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.user]);

  if (auth.loading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const ScreenComponent = SCREENS[effective.route];
  const showFooter = !HIDE_FOOTER_ROUTES.has(effective.route);

  return (
    <View style={styles.root}>
      <View style={styles.screenWrap}>
        <ScreenComponent
          key={`${effective.route}-${navTick}`}
          onNavigate={navigate}
          params={effective.params}
        />
      </View>
      {showFooter ? <Footer onNavigate={navigate} /> : null}
      <CookieBanner onNavigate={navigate} />
    </View>
  );
}

// Decide which route to actually render. We never mutate history (so the
// user's back-stack stays intact); we just swap the screen.
function computeEffectiveFrame(
  current: Frame,
  signedIn: boolean,
  loading: boolean,
): Frame {
  if (loading) return current;

  // Signed-out + private route → bounce to signin with returnTo.
  if (!signedIn && PRIVATE_ROUTES.has(current.route)) {
    return {
      route: 'signin',
      params: { returnTo: current.route },
    };
  }

  // Signed-in + auth route → no need; punt to dashboard. (The post-signin
  // effect in AppInner will navigate to returnTo if one was carried.)
  if (signedIn && AUTH_ROUTES.has(current.route)) {
    return { route: 'dashboard' };
  }

  // Signed-in + marketing landing ('/') → punt straight to dashboard.
  // The landing page is the unauthenticated marketing surface; a
  // logged-in user hitting "/" wants their dashboard, not the pitch.
  if (signedIn && current.route === 'landing') {
    return { route: 'dashboard' };
  }

  return current;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    backgroundColor: colors.bg,
  },
  screenWrap: {
    flex: 1,
  },
  fullCenter: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
  },
});
