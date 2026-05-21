const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Pin scope to app/ so Expo's monorepo auto-detection doesn't walk
// up into the repo's Firebase Functions code.
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

// SVG transformer (preserved).
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Alias server-only Node packages to an empty stub. Anything in the
// bundle that requests them (whether directly or transitively, via
// hierarchical lookup, via a stale cache, etc.) gets the stub
// instead of the real package — so the bundle never tries to read
// firebase-functions/lib/logger/index.js and the
// `require("util")` line that crashes Metro is never reached.
const stub = path.resolve(__dirname, 'src/utils/server-only-stub.js');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'firebase-functions': stub,
  'firebase-admin': stub,
  'firebase': stub,
  'node-fetch': stub,
};

// Belt-and-suspenders: also intercept at resolveRequest so deep
// sub-paths like 'firebase-functions/lib/logger' redirect too.
const FORBIDDEN = ['firebase-functions', 'firebase-admin', 'firebase', 'node-fetch'];
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const root = moduleName.split('/')[0];
  if (FORBIDDEN.includes(root) || FORBIDDEN.includes(moduleName)) {
    return { type: 'sourceFile', filePath: stub };
  }
  return upstream
    ? upstream(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
