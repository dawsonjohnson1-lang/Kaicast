// This stub stands in for server-only Node packages
// (firebase-functions, firebase-admin, firebase, node-fetch) inside
// the React Native bundle. Anything in app/ that touches these is
// a bug — fetch the Cloud Function over HTTP via app/src/api/kaicast.ts
// instead. Logging the importer here lets us catch regressions early.
/* eslint-disable */
if (typeof console !== 'undefined' && console.warn) {
  console.warn(
    '[server-only-stub] A server-only package was imported into the ' +
    'RN bundle. It was replaced with an empty stub. Find the importer ' +
    'with: grep -rn "firebase-\\|node-fetch" app/src app/App.tsx'
  );
}
module.exports = new Proxy({}, {
  get() { return () => {}; },
});
