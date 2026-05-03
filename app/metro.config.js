const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const repoRoot = path.resolve(__dirname, '..');

// ─── SVG transformer ────────────────────────────────────────────────
// '*.svg' imports become inline React components instead of assets.
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// ─── Pin scope to app/ ──────────────────────────────────────────────
// Repo root has Firebase Functions code (index.js / analysis.js /
// webflow.js) and a root-level package.json that lists
// firebase-functions / firebase-admin / node-fetch. Pin the project
// root + watchFolders to app/ so Expo's monorepo auto-detection
// doesn't walk up and bundle server-side code.
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

// NB: deliberately NOT setting resolver.disableHierarchicalLookup —
// react-native ships nested peer deps at
// app/node_modules/react-native/node_modules/@react-native/* and
// disabling hierarchical lookup also blocks those, breaking core
// modules like Modal/VirtualizedList. Hierarchical lookup stays
// enabled; the blockList below is what keeps Metro from resolving
// the parent's server-side packages.

// ─── Defensive blockList ────────────────────────────────────────────
// Even though projectRoot is pinned, hierarchical lookup can still
// walk up to <repoRoot>/node_modules. Reject those paths explicitly
// so resolution fails fast instead of pulling a Node-only package
// (firebase-functions etc.) into the React Native bundle.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockedAbs = [
  path.join(repoRoot, 'index.js'),
  path.join(repoRoot, 'analysis.js'),
  path.join(repoRoot, 'buoy_Version2.js'),
  path.join(repoRoot, 'tides.js'),
  path.join(repoRoot, 'webflow.js'),
  path.join(repoRoot, 'functions'),
  path.join(repoRoot, 'abyss'),
  path.join(repoRoot, 'node_modules', 'firebase-functions'),
  path.join(repoRoot, 'node_modules', 'firebase-admin'),
  path.join(repoRoot, 'node_modules', 'node-fetch'),
];

config.resolver.blockList = blockedAbs.map(
  (p) => new RegExp(`^${escape(p)}(/.*)?$`)
);

module.exports = config;
