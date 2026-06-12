/* eslint-env node */
'use strict';

/**
 * claimAnonymousLogs — attach pre-signup dive logs to a real account.
 *
 * submitDiveLog accepts an `anonymous_claim_token` (a client-generated
 * secret, 16-128 chars) in place of auth and tags those logs
 * `uid: 'anon:{token}'`. When the user later signs up, the client
 * calls this with the same token and every matching log is rewritten
 * to the authed uid.
 *
 * Security model: the token IS the proof of ownership — it never left
 * the device that generated it, so presenting it is equivalent to
 * being that device. Logs are stamped with claim provenance
 * (claimed_from_anon / claimed_at) so the claim is auditable and the
 * nightly calibration job is unaffected (it never reads uid).
 *
 * Idempotent: claiming a token with no remaining logs returns
 * { claimed: 0 } rather than erroring, so the client can safely retry.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const db = () => admin.firestore();

/** Matches submitDiveLog's anonymous_claim_token zod bounds. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

const BATCH_SIZE = 400;

exports.claimAnonymousLogs = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to claim your dive logs.');

    const token = String(req.data?.anonymous_claim_token ?? '').trim();
    if (!TOKEN_RE.test(token)) {
      throw new HttpsError('invalid-argument', 'anonymous_claim_token is malformed.');
    }

    const anonUid = `anon:${token}`;
    let claimed = 0;

    // Page through matching logs — a device could have months of
    // anonymous logging behind one token.
    for (;;) {
      const snap = await db()
        .collection('diveLogs')
        .where('uid', '==', anonUid)
        .limit(BATCH_SIZE)
        .get();
      if (snap.empty) break;

      const batch = db().batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          uid,
          claimed_from_anon: true,
          claimed_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      claimed += snap.size;
      if (snap.size < BATCH_SIZE) break;
    }

    logger.info('claimAnonymousLogs: done', { uid, claimed });
    return { claimed };
  },
);
