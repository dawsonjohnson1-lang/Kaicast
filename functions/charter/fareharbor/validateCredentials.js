// validateFareHarborCredentials — pre-flight check for the Settings
// Connection UI. Takes { shortname, userApiKey }, calls FH to list
// items, returns either:
//   { valid: true,  itemCount, companyName }
//   { valid: false, error, kind }
//
// Caller must be an authenticated org member of the orgId they
// claim to be configuring. We use the requesting user's charter
// status (from users/{uid}) to check that.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { listItems, FhError } = require('./fareharborApi');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const FAREHARBOR_APP_KEY = defineSecret('FAREHARBOR_APP_KEY');

exports.validateFareHarborCredentials = onCall(
  {
    region: 'us-central1',
    cors: true,
    secrets: [FAREHARBOR_APP_KEY],
    timeoutSeconds: 20,
    memory: '256MiB',
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to validate FareHarbor credentials.');
    }
    const uid = req.auth.uid;
    const shortname = String(req.data?.shortname ?? '').trim();
    const userApiKey = String(req.data?.userApiKey ?? '').trim();
    if (!shortname || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(shortname)) {
      throw new HttpsError('invalid-argument', 'shortname must be a kebab-case slug');
    }
    if (!userApiKey || userApiKey.length < 16) {
      throw new HttpsError('invalid-argument', 'userApiKey looks too short to be a real FH key');
    }

    // Caller must be a charter admin (any orgId — we don't enforce the
    // specific orgId here since the credentials are just being validated,
    // not yet saved).
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    const u = userSnap.exists ? userSnap.data() : null;
    if (u?.accountType !== 'charter') {
      throw new HttpsError('permission-denied', 'Only charter accounts can validate FareHarbor credentials.');
    }

    try {
      const items = await listItems(shortname, userApiKey);
      // FH's `/items/` returns either an array OR an object with
      // `items: [...]` depending on endpoint version. Handle both.
      const itemList = Array.isArray(items) ? items : Array.isArray(items?.items) ? items.items : [];
      // Best-effort company name from the first item (FH includes it
      // on every item).
      const companyName = String(itemList[0]?.company?.name ?? '') || shortname;
      logger.info('[fh-validate] ok', { shortname, itemCount: itemList.length });
      return {
        valid: true,
        itemCount: itemList.length,
        companyName,
      };
    } catch (err) {
      if (err instanceof FhError) {
        logger.warn('[fh-validate] failed', { shortname, kind: err.kind, status: err.status });
        return {
          valid: false,
          kind: err.kind,
          status: err.status,
          error:
            err.kind === 'auth'         ? 'FareHarbor rejected the credentials. Double-check the shortname + User API key.' :
            err.kind === 'not-found'    ? `No FareHarbor company found at shortname "${shortname}".` :
            err.kind === 'app-key-missing' ? 'KaiCast\'s FareHarbor App Key isn\'t configured server-side. Contact support.' :
            err.kind === 'network'      ? 'Could not reach FareHarbor. Try again in a minute.' :
                                          err.message || 'Could not validate the credentials.',
        };
      }
      logger.error('[fh-validate] unexpected', { error: err.message });
      throw new HttpsError('internal', 'Unexpected error while validating credentials');
    }
  },
);
