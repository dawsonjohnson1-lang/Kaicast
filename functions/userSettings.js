/**
 * updateUserSetting — single callable that owns all /users/{uid} writes
 * for the canonical Settings surface (Account, Diver profile, Preferences).
 *
 * The mobile + desktop Settings screens render the same fields and write
 * through this function. Centralizing validation here keeps the two
 * clients from drifting on enum values or accepting malformed phones.
 *
 * Wire from index.js:
 *   exports.updateUserSetting = require('./userSettings').updateUserSetting;
 *
 * Request shape:
 *   { path: '<dotted-field-path>', value: <scalar | boolean> }
 *
 * Response shape:
 *   { ok: true, path, value }
 *
 * Error codes (HttpsError):
 *   - unauthenticated  : no auth context
 *   - invalid-argument : path/value rejected by validateSettingsWrite()
 *                        OR homeSpotId references a missing spot
 *   - permission-denied: path requires re-auth (email/phone) and the
 *                        callable will refuse — clients must re-auth
 *                        client-side first (Firebase Auth doesn't
 *                        expose a "freshness" check server-side without
 *                        the ID token's auth_time field, so this
 *                        check is advisory; the real enforcement is
 *                        firebase-auth's updateEmail / updatePhoneNumber
 *                        APIs, which natively require recent re-auth).
 *
 * Rules: firestore.rules denies client writes to profile/prefs/meta/phone
 * directly, so this callable (Admin SDK, bypasses rules) is the only
 * write path.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const {
  SETTINGS_PATHS,
  REAUTH_REQUIRED_PATHS,
  validateSettingsWrite,
} = require('./shared/userSettings');

exports.updateUserSetting = onCall(
  {
    region: 'us-central1',
    // Per-instance cap. Settings writes are infrequent and cheap; one
    // concurrent invocation per user is plenty.
    maxInstances: 10,
  },
  async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const data = request.data ?? {};
    const { path, value } = data;

    // Shape check.
    if (typeof path !== 'string') {
      throw new HttpsError('invalid-argument', '`path` must be a string');
    }

    // Allowlist + scalar validation lives in shared/userSettings.js so
    // mobile/desktop can mirror it for inline form feedback.
    const v = validateSettingsWrite(path, value);
    if (!v.ok) {
      throw new HttpsError('invalid-argument', v.message);
    }

    // Re-auth gate. Server can't reliably check "did they just re-auth"
    // without the ID token's auth_time + a freshness window, which gets
    // brittle. We refuse the write here and tell the client to drive
    // re-auth via Firebase Auth's native APIs (updateEmail /
    // updatePhoneNumber) which natively require recent credentials.
    if (REAUTH_REQUIRED_PATHS.includes(path)) {
      // Allow the write IF the client passes `acknowledgedReauth: true` —
      // meaning it has already re-auth'd and is mirroring the change
      // into the user doc. This is an honor-system flag; the real
      // enforcement is on Firebase Auth's side.
      if (data.acknowledgedReauth !== true) {
        throw new HttpsError(
          'permission-denied',
          'This field requires re-authentication. Re-auth via Firebase Auth, then retry with acknowledgedReauth=true.',
        );
      }
    }

    const db = admin.firestore();

    // homeSpotId existence check — needs Firestore so it lives here
    // instead of in shared/.
    if (path === SETTINGS_PATHS.homeSpotId) {
      const spotSnap = await db.collection('spots').doc(value).get();
      if (!spotSnap.exists) {
        throw new HttpsError(
          'invalid-argument',
          `homeSpotId references missing spot: ${value}`,
        );
      }
    }

    // updatedBy is inferred from a client-supplied platform tag,
    // clamped to the allowed values. Mobile passes 'ios'/'android' via
    // Platform.OS, desktop passes 'web'. Anything else falls back to
    // 'web' so we never store nonsense.
    const rawPlatform = typeof data.clientPlatform === 'string' ? data.clientPlatform : '';
    const updatedBy =
      rawPlatform === 'ios' ? 'ios' :
      rawPlatform === 'android' ? 'android' :
      'web';

    // Build a dotted-path update. Firestore's update() takes a flat
    // object where dotted keys mean nested writes — so the same call
    // patches `profile.certification` without touching the rest of
    // `profile`.
    const update = {
      [path]: value,
      'meta.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      'meta.updatedBy': updatedBy,
    };

    const ref = db.collection('users').doc(auth.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      // First write on a freshly-signed-up user — set rather than
      // update so the doc gets created.
      await ref.set(update, { merge: true });
    } else {
      await ref.update(update);
    }

    logger.info('[updateUserSetting] wrote', { uid: auth.uid, path, updatedBy });

    return { ok: true, path, value };
  },
);
