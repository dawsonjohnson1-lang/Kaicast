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
// firebase-functions, firebase-admin, node-fetch. Without these
// guards Metro:
//   1. walks up via watchFolders auto-detection and tries to bundle
//      server-side .js files at the repo root;
//   2. walks up via Node's default hierarchical node_modules lookup
//      and resolves `firebase-functions` from
//      <repoRoot>/node_modules/firebase-functions, whose
//      `require('util')` crashes RN's resolver.
// projectRoot + watchFolders block (1); nodeModulesPaths +
// disableHierarchicalLookup block (2). The blockList below is a
// belt-and-suspenders for both.
config.projectRoot = __dirname;
config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

// ─── Defensive blockList ────────────────────────────────────────────
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockedAbs = [
  path.join(repoRoot, 'index.js'),
  path.join(repoRoot, 'analysis.js'),
  path.join(repoRoot, 'buoy_Version2.js'),
  path.join(repoRoot, 'tides.js'),
  path.join(repoRoot, 'webflow.js'),
  path.join(repoRoot, 'functions'),
  path.join(repoRoot, 'node_modules', 'firebase-functions'),
  path.join(repoRoot, 'node_modules', 'firebase-admin'),
  path.join(repoRoot, 'node_modules', 'node-fetch'),
];

config.resolver.blockList = blockedAbs.map(
  (p) => new RegExp(`^${escape(p)}(/.*)?$`)
);

module.exports = config;
