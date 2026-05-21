import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
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
