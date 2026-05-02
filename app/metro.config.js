const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// SVG transformer — '*.svg' imports become inline React components.
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Lock Metro's project + watch scope to app/. Without this, Expo's
// auto-detection walks up to the repo root (parent package.json has
// `"main": "index.js"`) and tries to bundle the Firebase Functions
// code (analysis.js / webflow.js / firebase-functions/lib/logger).
// Those are Node-only modules; Metro can't resolve `util`,
// `firebase-admin`, etc. and the app bundle dies.
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blocked = [
  // Stale nested duplicates of the project (left over from prior
  // Claude sessions) that confuse Metro's resolver.
  path.join(__dirname, 'kaicast'),
  path.join(__dirname, 'app'),
  // Belt-and-suspenders: even if Metro discovers the parent dir via
  // some path we missed, never let it touch repo-root backend files.
  path.join(__dirname, '..', 'index.js'),
  path.join(__dirname, '..', 'analysis.js'),
  path.join(__dirname, '..', 'webflow.js'),
  path.join(__dirname, '..', 'tides.js'),
  path.join(__dirname, '..', 'buoy_Version2.js'),
  path.join(__dirname, '..', 'functions'),
  path.join(__dirname, '..', 'abyss'),
];

config.resolver.blockList = blocked.map(
  (dir) => new RegExp(`^${escape(dir)}(/|$).*`)
);

module.exports = config;
