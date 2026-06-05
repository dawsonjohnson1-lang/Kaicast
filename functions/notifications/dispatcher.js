/* eslint-env node */
'use strict';

/**
 * Notification dispatcher.
 *
 * Takes a batch of alert candidates from detectors, validates them
 * against the schema, deduplicates against existing /spot_alerts, and
 * writes the new ones in a single Firestore batch.
 *
 * Idempotency lives at the `dedupeKey` field: detectors return a key
 * that's stable as long as the same condition holds (e.g. for a
 * 90th-percentile vis spike, the key is `vis_spike:{spotId}:{hourKey}`
 * so it doesn't re-fire on the next hour while still spiking). Before
 * a write we check if an alert with the same dedupeKey already exists
 * and is not yet past its endMs; if so, we skip.
 *
 * The write path is batched and bounded (max 500 alerts per call —
 * the Firestore batch limit). Each batch commits before the next is
 * assembled, so a failure on alert #501 doesn't abort the first 500.
 */

const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { validateAlert } = require('./schema');

const SPOT_ALERTS_COLLECTION = 'spot_alerts';
const BATCH_LIMIT = 400; // leave headroom under Firestore's 500 hard limit

/**
 * Persist a list of alert candidates. Returns { written, skipped }.
 *
 * Detectors should NEVER call Firestore directly — they return pure
 * data, this is the only writer. Means the detectors are easy to unit
 * test and the production write surface is single-file auditable.
 */
async function persist(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { written: 0, skipped: 0, invalid: 0 };
  }

  const db = admin.firestore();
  const col = db.collection(SPOT_ALERTS_COLLECTION);
  const now = Date.now();

  // 1. Validate. Drop invalid; log.
  const valid = [];
  let invalid = 0;
  for (const c of candidates) {
    const errs = validateAlert(c);
    if (errs.length > 0) {
      logger.warn('notifications/dispatcher: dropping invalid alert', {
        category: c?.category, errors: errs,
      });
      invalid++;
      continue;
    }
    valid.push(c);
  }

  // 2. Dedupe — look up existing live alerts by dedupeKey.
  //    Firestore's `in` operator caps at 30, so we batch.
  const dedupeKeys = [...new Set(valid.map((c) => c.dedupeKey).filter(Boolean))];
  const existing = new Set();
  for (let i = 0; i < dedupeKeys.length; i += 30) {
    const slice = dedupeKeys.slice(i, i + 30);
    const snap = await col
      .where('dedupeKey', 'in', slice)
      .where('endMs', '>', now)
      .get();
    for (const d of snap.docs) {
      const k = d.data().dedupeKey;
      if (k) existing.add(k);
    }
  }

  const toWrite = valid.filter((c) => !c.dedupeKey || !existing.has(c.dedupeKey));

  // 3. Batched writes.
  let written = 0;
  for (let i = 0; i < toWrite.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const slice = toWrite.slice(i, i + BATCH_LIMIT);
    for (const c of slice) {
      const ref = col.doc(); // auto-id
      batch.set(ref, {
        ...c,
        alertId: ref.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    try {
      await batch.commit();
      written += slice.length;
    } catch (err) {
      logger.error('notifications/dispatcher: batch commit failed', {
        batchStart: i, size: slice.length, error: err.message,
      });
    }
  }

  const result = {
    written,
    skipped: valid.length - toWrite.length,
    invalid,
  };
  if (written > 0 || invalid > 0) {
    logger.info('notifications/dispatcher: persisted', result);
  }
  return result;
}

/**
 * Convenience: resolve (mark as ended) any live alerts matching a
 * predicate. Used by Tier 2 sources that need to auto-resolve early
 * — e.g. brown-water clears when a rainfall gauge reads clean.
 */
async function resolveWhere({ category, predicate }) {
  const db = admin.firestore();
  const now = Date.now();
  const snap = await db.collection(SPOT_ALERTS_COLLECTION)
    .where('category', '==', category)
    .where('endMs', '>', now)
    .get();

  const batch = db.batch();
  let count = 0;
  for (const d of snap.docs) {
    if (!predicate(d.data())) continue;
    batch.update(d.ref, {
      endMs: now,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}

module.exports = { persist, resolveWhere };
