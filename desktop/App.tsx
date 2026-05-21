import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts } from './tokens';
import {
  AUTH_ROUTES,
  HIDE_FOOTER_ROUTES,
  PRIVATE_ROUTES,
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
import { AuthScreen } from './AuthScreen';
import { LegalScreen, type LegalDoc } from './LegalScreen';

/**
 * Desktop app shell.
 *
 *  - <AuthProvider> wraps the whole tree so screens can read/write auth.
 *  - AppInner handles route gating: signed-out users on private routes
 *    bounce to /signin; signed-in users on /signin or /signup bounce to
 *    /dashboard.
 *  - History stack persists current route to localStorage so reloads
 *    land on the same screen (but unsigned users always re-land on
 *    landing, regardless of what was saved).
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
  'terms':        (p: any) => <LegalScreen doc="terms" {...p} />,
  'privacy':      (p: any) => <LegalScreen doc="privacy" {...p} />,
  'cookies':      (p: any) => <LegalScreen doc="cookies" {...p} />,
  'refund':       (p: any) => <LegalScreen doc="refund" {...p} />,
  'dmca':         (p: any) => <LegalScreen doc="dmca" {...p} />,
  'aup':          (p: any) => <LegalScreen doc="aup" {...p} />,
};

const ALL_ROUTES = Object.keys(SCREENS) as RouteKey[];

const LS_KEY = 'kaicast.desktop.route';
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

  const [history, setHistory] = React.useState<Frame[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage?.getItem(LS_KEY);
      if (saved && ALL_ROUTES.includes(saved as RouteKey)) {
        return [{ route: saved as RouteKey }];
      }
    }
    // First visit (or cleared storage): open the map of all spots so
    // visitors can poke around immediately — no auth wall up front.
    return [{ route: 'spots-map' }];
  });
  const [cursor, setCursor] = React.useState(0);

  const current = history[cursor];

  const navigate: NavigateFn = React.useCallback((route, params) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, cursor + 1); // drop forward history on new nav
      return [...truncated, { route, params }];
    });
    setCursor((c) => c + 1);
  }, [cursor]);

  // ── Route gate ──
  // Compute the route we should actually render, given auth state.
  // We don't mutate history here — we just show a different screen.
  // This means after sign-in, the user lands on whatever they originally
  // asked for (via params.returnTo on the signin frame, if it was set).
  const effective = computeEffectiveFrame(current, auth.user != null, auth.loading);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(LS_KEY, current.route);
      window.scrollTo(0, 0);
    }
  }, [current.route]);

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
          key={`${effective.route}-${cursor}`}
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
