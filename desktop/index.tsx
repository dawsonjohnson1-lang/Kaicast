import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import { App } from './App';
import './theme.css';

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

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
