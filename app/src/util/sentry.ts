// Sentry crash + error reporting wrapper.
//
// The minute production users hit anything that throws, we want to
// know. Sentry catches JS exceptions, native crashes (after a release
// build), unhandled promise rejections, and ANRs. Free tier is
// enough for v1 (5k events/mo).
//
// Configure: set EXPO_PUBLIC_SENTRY_DSN in app/.env from
// https://kaicast.sentry.io → Settings → Projects → kaicast →
// Client Keys (DSN). When the env var is missing, every export
// below is a no-op so demo / dev runs don't error.

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();
const isConfigured = !!dsn && dsn.startsWith('http');

let initialized = false;

/** Call once at app bootstrap. No-op when DSN missing. */
export function initSentry(): void {
  if (initialized || !isConfigured) return;
  Sentry.init({
    dsn,
    // Trace = perf monitoring. Off by default; flip on later when
    // we want to instrument hot paths.
    tracesSampleRate: 0,
    // Send the JS bundle version Sentry can match to source maps when
    // they're uploaded as part of EAS builds.
    release: Constants.expoConfig?.version ?? 'unknown',
    dist: String(Constants.expoConfig?.runtimeVersion ?? '1'),
    // Don't capture noisy mobile-only warnings.
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
    // Strip dev-only frames so we don't burn quota on hot-reload errors.
    beforeSend(event) {
      if (__DEV__) return null;
      return event;
    },
  });
  initialized = true;
}

/** Wrap the root <App /> component so React errors land in Sentry. */
export function wrap<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  if (!isConfigured) return Component;
  // Sentry.wrap's parameterization is too loose to match a specific
  // generic Component; cast through unknown so the wrapped component
  // still keeps its prop type for callers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Sentry.wrap as any)(Component) as React.ComponentType<P>;
}

/** Manually report a caught exception with optional context. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!isConfigured) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
    }
    Sentry.captureException(err);
  });
}

/** Attach the signed-in user to all subsequent events. */
export function setUser(user: { id: string; email?: string } | null): void {
  if (!isConfigured) return;
  Sentry.setUser(user);
}
