const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blocked = [
  path.join(__dirname, 'kaicast'),
  path.join(__dirname, 'app'),
];

config.resolver.blockList = blocked.map(
  (dir) => new RegExp(`^${escape(dir)}(/|$).*`)
);

module.exports = config;
