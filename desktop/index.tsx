import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import { App } from './App';
import { initSentry, sentryConfigured, Sentry } from './sentry';
import './theme.css';

// Wire up error tracking before anything else mounts so the very first
// errors (including init-time crashes) are captured. No-op when
// VITE_SENTRY_DSN isn't set — see sentry.ts.
initSentry();

/**
 * Vite entry point. RN-Web mounts via AppRegistry, which writes the
 * required CSS reset + font scaling into the document head before the
 * first paint. createRoot is then attached to <div id="root">.
 *
 * Theme bootstrap below applies the user's saved palette to <html>
 * BEFORE React mounts so the very first paint is in the right colors
 * (no FOUC flash). The hooks/useTheme.ts module then takes over for
 * runtime changes.
 */

(function bootstrapTheme() {
  try {
    const saved = window.localStorage?.getItem('kaicast.desktop.theme');
    const theme = saved === 'light' ? 'theme-light' : 'theme-dark';
    document.documentElement.classList.add(theme);
  } catch {
    document.documentElement.classList.add('theme-dark');
  }
})();

AppRegistry.registerComponent('KaiCastDesktop', () => App);

// Wrap in Sentry's error boundary so React render-time crashes (which
// React otherwise swallows by unmounting the tree) get reported. When
// Sentry isn't configured the boundary still works as a plain
// last-resort fallback — it just doesn't phone home.
const Tree = sentryConfigured
  ? (
    <Sentry.ErrorBoundary fallback={<RootCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  )
  : <App />;

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    {Tree}
  </React.StrictMode>,
);

function RootCrashFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#04070d',
        color: '#e6edf6',
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</div>
      <div style={{ fontSize: 14, color: '#9aa7b8', maxWidth: 420 }}>
        The page hit an unexpected error. Reload to try again — the issue has
        been reported.
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8,
          padding: '10px 18px',
          borderRadius: 999,
          border: 'none',
          background: '#3da9fc',
          color: '#04070d',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  );
}
