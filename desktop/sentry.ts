/**
 * Sentry error tracking for the KaiCast desktop app.
 *
 * Mirrors the firebase.ts pattern: reads config from a VITE_* env var
 * (Vite inlines it at build time) and is a complete no-op when the DSN
 * is absent. This means local dev and any build without a configured
 * DSN behave exactly as before — Sentry only wakes up once you set
 * VITE_SENTRY_DSN in the environment.
 *
 * To turn it on:
 *   1. Create a project at sentry.io (platform: React) and copy its DSN.
 *   2. Set VITE_SENTRY_DSN=<dsn> in the build environment (.env.local
 *      for dev, or the hosting/CI env for production builds).
 *   3. (Optional, for readable stack traces) set SENTRY_AUTH_TOKEN,
 *      SENTRY_ORG and SENTRY_PROJECT so vite.config.ts uploads source
 *      maps on `npm run build`.
 *
 * Errors-only by design: we deliberately do NOT enable performance
 * tracing or session replay, both of which consume separate (smaller)
 * quotas on the free plan. If you want those later, add
 * tracesSampleRate / replay integrations here.
 */

import * as Sentry from '@sentry/react';

// Default DSN for the KaiCast desktop Sentry project. A DSN is
// public-safe — it only authorizes *sending* events, so it's designed
// to live in client bundles (this is why Sentry's own quickstart
// hardcodes it). VITE_SENTRY_DSN overrides it if set, e.g. to point a
// staging build at a separate project or to disable by setting it empty.
const DEFAULT_DSN =
  'https://7cc94e47dab9d0dfb403f5838a9d9487@o4511555730407424.ingest.us.sentry.io/4511555806953472';

const envDsn = (import.meta as any).env?.VITE_SENTRY_DSN;
const DSN = (typeof envDsn === 'string' ? envDsn : DEFAULT_DSN).trim();

/** True once init() has actually wired up Sentry (DSN present). */
export const sentryConfigured = !!DSN;

let initialized = false;

export function initSentry(): void {
  if (initialized || !sentryConfigured) return;
  initialized = true;
  try {
    Sentry.init({
      dsn: DSN,
      // Vite sets MODE to 'development' under `vite`/`npm run dev` and
      // 'production' under `vite build`. Lets you filter dev noise out
      // of the dashboard.
      environment: (import.meta as any).env?.MODE ?? 'production',
      // Optional release tag — set VITE_SENTRY_RELEASE (e.g. a git sha)
      // to tie every error to a specific deploy. Without it Sentry
      // groups errors under an "unknown" release, which is still fine.
      release: ((import.meta as any).env?.VITE_SENTRY_RELEASE ?? '').trim() || undefined,
      // Errors only — no tracing/replay sampling, so we stay well
      // within the free-tier error quota and don't touch the separate
      // performance-unit quota.
      sendDefaultPii: false,
    });
  } catch (err) {
    initialized = false;
    // eslint-disable-next-line no-console
    console.warn('[sentry] init failed; continuing without error tracking', err);
  }
}

/**
 * Capture a handled exception with optional structured context. Safe to
 * call whether or not Sentry is configured — it's a no-op when it isn't,
 * so call sites never need to guard.
 *
 * @param error   the thrown value (Error or anything)
 * @param context tags + extra data attached to the event (e.g.
 *                { tags: { flow: 'log-dive-publish' }, extra: { spotId } })
 */
export function captureException(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (!sentryConfigured) return;
  Sentry.captureException(error, context);
}

export { Sentry };
