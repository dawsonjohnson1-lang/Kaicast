import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

/**
 * Sentry source-map upload is opt-in: it only runs when all three
 * credentials are present in the build environment. Without them the
 * build is byte-for-byte what it was before Sentry — no source maps
 * generated, no upload step, no failure. Set these in CI / the hosting
 * build env (NOT committed) once the Sentry project exists:
 *   SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
 */
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const sentryUploadEnabled = !!(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);

/**
 * Vite dev harness for the KaiCast desktop screens.
 *
 * Two non-obvious settings worth knowing:
 *
 *  - `react-native` is aliased to `react-native-web` so all the
 *    `import { View, Text, … } from 'react-native'` lines in the
 *    screen files resolve to the web shim at bundle time. This is
 *    the standard pattern any RN-Web setup needs; it's why Expo Web,
 *    Next.js + RN-Web, etc. all configure the same alias.
 *
 *  - `define: { __DEV__: 'true' }` is required because react-native
 *    references a global `__DEV__` flag at module init; without this
 *    you get "ReferenceError: __DEV__ is not defined" on first load.
 */
export default defineConfig({
  plugins: [
    react(),
    // Uploads source maps to Sentry on `vite build` so minified stack
    // traces become readable, then deletes the .map files from dist so
    // we don't ship them publicly. Inert unless the credentials above
    // are set.
    ...(sentryUploadEnabled
      ? [sentryVitePlugin({
          org: SENTRY_ORG,
          project: SENTRY_PROJECT,
          authToken: SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })]
      : []),
  ],
  // Only emit source maps when we're going to upload-and-delete them.
  build: {
    sourcemap: sentryUploadEnabled,
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.jsx', '.web.js', '.jsx', '.js'],
  },
  define: {
    __DEV__: 'true',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  server: {
    port: 5173,
    open: false,
  },
  optimizeDeps: {
    esbuildOptions: {
      // RN-Web ships JSX in .js files; tell esbuild to handle them.
      loader: { '.js': 'jsx' },
    },
  },
});
