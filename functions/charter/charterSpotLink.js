/* eslint-env node */
'use strict';

/**
 * charterSpotLink — translate a charter PRIVATE spot doc-id into the
 * PUBLIC KaiCast spot id its conditions report is keyed by.
 *
 * Charter operating spots live at charter_accounts/{orgId}/spots/{id} and
 * are created with addDoc (auto-ids) — their doc-id is NEVER a public
 * KaiCast spot id. Conditions/forecasts for a charter spot come from the
 * linked public spot's report (see desktop DayForecastSection: "the
 * charter private spot is just a label + a join key"). kaicast_reports and
 * the cold-storage archive are bucketed by the PUBLIC id, so the snapshot
 * resolver must be handed `linkedPublicSpotId`, not the charter doc-id —
 * otherwise it queries kaicast_reports/{autoId}_{hourKey}, which never
 * exists, and every snapshot silently resolves null.
 *
 * Falls back to the charter id when the spot is unlinked: there's no
 * public report to resolve in that case, so the snapshot lands null either
 * way, but returning the id keeps the stored primarySpotId non-empty.
 */

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} operatorId   charter_accounts doc id (the org)
 * @param {string} charterSpotId  the private spot's doc id
 * @returns {Promise<string|null>} the public spot id (or the charter id when unlinked)
 */
async function publicSpotIdFor(db, operatorId, charterSpotId) {
  if (!operatorId || !charterSpotId) return charterSpotId || null;
  try {
    const doc = await db
      .collection('charter_accounts').doc(operatorId)
      .collection('spots').doc(charterSpotId)
      .get();
    const linked = doc.exists ? doc.data()?.linkedPublicSpotId : null;
    return typeof linked === 'string' && linked.length > 0 ? linked : charterSpotId;
  } catch {
    // A lookup failure must never block snapshot resolution — fall back to
    // the charter id (resolver will return null, which is a valid outcome).
    return charterSpotId;
  }
}

module.exports = { publicSpotIdFor };
