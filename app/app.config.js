// Expo loads this in place of app.json. Converted from JSON so the
// @rnmapbox/maps download token can come from process.env at config-eval
// time — committing the secret token would fail GitHub push protection
// and gets the iOS/Android SDK auth baked into the prebuild output.

const downloadToken = process.env.MAPBOX_DOWNLOADS_TOKEN ?? '';

if (!downloadToken) {
  // eslint-disable-next-line no-console
  console.warn(
    '[app.config] MAPBOX_DOWNLOADS_TOKEN is not set. ' +
      '`expo prebuild` / `pod install` will fail to fetch the Mapbox SDK. ' +
      'Export it before running native builds (see app/README.md).'
  );
}

module.exports = () => ({
  expo: {
    name: 'KaiCast',
    slug: 'kaicast',
    scheme: 'kaicast',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    newArchEnabled: false,
    splash: {
      resizeMode: 'cover',
      backgroundColor: '#161616',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.kaicast.app',
    },
    android: {
      package: 'com.kaicast.app',
      adaptiveIcon: {
        backgroundColor: '#161616',
      },
    },
    web: {
      bundler: 'metro',
    },
    plugins: [
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsImpl: 'mapbox',
          RNMapboxMapsDownloadToken: downloadToken,
        },
      ],
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '14.0',
          },
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
          },
        },
      ],
    ],
    extra: {
      kaicastApiBase: 'https://us-central1-kaicast.cloudfunctions.net',
    },
    experiments: {
      tsconfigPaths: true,
    },
  },
});
