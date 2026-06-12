/* eslint-env node */
'use strict';

/**
 * captureStandaloneLogSnapshot — server-trusted conditions snapshot for
 * desktop standalone captain's logs.
 *
 * The desktop standalone filer writes charter_logs/{logId} directly (a
 * one-shot create == finalize; there's no draft/submit split like the
 * mobile rich-log flow). So instead of a finalize callable, we hook the
 * document's creation: resolve the SAME immutable snapshot the dive-log
 * pipeline produces and patch it back onto the doc.
 *
 * Why a trigger and not a callable: the client create is already gated by
 * the charter_logs firestore.rules (org owner OR captain's license), and
 * the snapshot-immutability rule there blocks clients from writing
 * conditionsSnapshot — so this trigger (Admin SDK, bypasses rules) is the
 * ONLY writer of the snapshot. No auth/gate logic to duplicate.
 *
 * Scope guard: only `schema: 'standalone-v1'` docs. The mobile rich
 * CharterLog (no `schema` field) captures its snapshot at finalize via
 * generateCaptainsLog — NOT at create — so it's deliberately skipped here.
 *
 * Region: us-central1 (matches existing deployment).
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const { resolveConditionsSnapshot } = require('../snapshotResolver');
const { publicSpotIdFor } = require('./charterSpotLink');

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MIDDAY_OFFSET_MS = 12 * 3600 * 1000; // noon HST — representative operating hour.

/**
 * One snapshot per day at the operating spot. Resolve at noon HST of the
 * log's date — a representative operating hour — but never in the future
 * (a log filed mid-morning resolves against `now` so a report exists).
 */
function snapshotTimeFor(dateMs) {
  const nowMs = Date.now();
  const midday = (Number.isFinite(dateMs) ? dateMs : nowMs) + MIDDAY_OFFSET_MS;
  return Math.min(nowMs, midday);
}

exports.captureStandaloneLogSnapshot = onDocumentCreated(
  {
    document: 'charter_logs/{logId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const log = snap.data() || {};

    // Only the desktop standalone-flow docs (see scope guard above).
    if (log.schema !== 'standalone-v1') return;
    // Immutable: never overwrite an already-captured snapshot.
    if (log.conditionsSnapshot) return;

    // primarySpotId = the first operating spot visited that day, resolved
    // to its PUBLIC KaiCast spot id. log.spotIds holds the charter's
    // private spot doc-ids (auto-ids); kaicast_reports is keyed by the
    // public id, so we translate via linkedPublicSpotId — otherwise the
    // resolver always misses and the snapshot is silently null.
    const spotIds = Array.isArray(log.spotIds)
      ? log.spotIds.filter((s) => typeof s === 'string' && s.length > 0)
      : [];
    const primarySpotId = spotIds[0]
      ? await publicSpotIdFor(admin.firestore(), log.operatorId, spotIds[0])
      : null;

    let snapshot = null;
    if (primarySpotId) {
      try {
        snapshot = await resolveConditionsSnapshot(primarySpotId, snapshotTimeFor(log.date));
      } catch (err) {
        // A resolver failure must not leave the doc in a broken state —
        // we still write a null snapshot (calibration skips it).
        logger.warn('[standalone-log] snapshot resolution failed', {
          logId: event.params.logId, primarySpotId, error: err?.message || String(err),
        });
      }
    }

    // merge:true patch — this is an UPDATE, so it won't re-fire onCreate.
    await snap.ref.set({
      primarySpotId,
      conditionsSnapshot: snapshot,
      zeroTripDay: !(Number.isFinite(log.tripCount) && log.tripCount > 0),
    }, { merge: true });

    logger.info('[standalone-log] snapshot captured', {
      logId: event.params.logId,
      primarySpotId,
      snapshot_source: snapshot?.snapshot_source ?? 'unresolved',
      resolved_within_min: snapshot?.resolved_within_min ?? null,
    });
  },
);
