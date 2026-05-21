import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import { App } from './App';

/**
 * Vite entry point. RN-Web mounts via AppRegistry, which writes the
 * required CSS reset + font scaling into the document head before the
 * first paint. createRoot is then attached to <div id="root">.
 */

AppRegistry.registerComponent('KaiCastDesktop', () => App);

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
