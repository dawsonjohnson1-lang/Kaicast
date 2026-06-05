/* eslint-env node */
'use strict';

/**
 * Notification engine — public entry points.
 *
 * Two cron functions are exported and wired in functions/index.js:
 *
 *   - boxJellyForecaster: daily at 04:00 HST, walks the next 14 days
 *     of lunar phase, emits any box-jellyfish window alerts that
 *     haven't been emitted yet.
 *
 *   - spotOfDayPublisher: once a day at 06:00 HST, pulls the latest
 *     report per spot, ranks by score, emits top 3 across islands.
 *
 * The per-spot Tier 1 detectors (vis_spike, wind_drop, window_open,
 * streak_*) run *inline* from the existing `scheduler` cron in
 * functions/index.js — see `runTier1ForSpot` below. Wiring it from
 * inside the existing scheduler avoids the cost of an extra cron
 * function per spot and gives us cheap access to the just-written
 * report + the history we'd otherwise have to re-query.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const tier1 = require('./tier1');
const dispatcher = require('./dispatcher');
const { computeBoxJellyAlerts } = require('./boxJelly');

const REGION = 'us-central1';
const HOURS_OF_HISTORY = 30 * 24; // 30 days

// ─── Inline Tier 1 entry — called from scheduler ───────────────────
//
// Returns: { written, skipped, invalid } from the dispatcher. Safe
// to call per-spot inside the existing scheduler loop; reuses the
// kaicast_reports docs that were just written.

async function runTier1ForSpot({ spot, currentReport }) {
  if (!spot || !currentReport) return { written: 0, skipped: 0, invalid: 0 };

  // Pull the last 30 days of history for this spot, newest first.
  // The kaicast_reports doc IDs follow {spotId}_{hourKey} pattern, so
  // we query by `spot == spotId` field instead of substring matching.
  const db = admin.firestore();
  const since = Date.now() - HOURS_OF_HISTORY * 3600 * 1000;
  const histSnap = await db.collection('kaicast_reports')
    .where('spot', '==', spot.id)
    .where('savedAt', '>=', new Date(since))
    .orderBy('savedAt', 'desc')
    .limit(HOURS_OF_HISTORY)
    .get()
    .catch((err) => {
      logger.warn('notifications: history fetch failed', { spotId: spot.id, error: err.message });
      return null;
    });

  const history = histSnap ? histSnap.docs.map((d) => d.data()) : [];
  const candidates = tier1.detectAllForSpot({ spot, current: currentReport, history });
  return dispatcher.persist(candidates);
}

// ─── Box jellyfish cron ─────────────────────────────────────────────

exports.boxJellyForecaster = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'Pacific/Honolulu',
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    retryCount: 1,
  },
  async () => {
    const candidates = computeBoxJellyAlerts({ horizonDays: 14 });
    const result = await dispatcher.persist(candidates);
    logger.info('notifications/boxJellyForecaster: done', result);
  },
);

// ─── Spot-of-the-day cron ───────────────────────────────────────────

exports.spotOfDayPublisher = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'Pacific/Honolulu',
    region: REGION,
    timeoutSeconds: 120,
    memory: '256MiB',
    retryCount: 1,
  },
  async () => {
    const db = admin.firestore();
    // Pull the most recent report per spot. Group by `spot` field —
    // grouping in JS since Firestore doesn't have GROUP BY.
    const snap = await db.collection('kaicast_reports')
      .where('savedAt', '>=', new Date(Date.now() - 3 * 3600 * 1000))
      .orderBy('savedAt', 'desc')
      .limit(500)
      .get();

    const latestPerSpot = new Map();
    for (const d of snap.docs) {
      const data = d.data();
      const id = data.spot;
      if (!id || latestPerSpot.has(id)) continue;
      latestPerSpot.set(id, data);
    }
    const allCurrentReports = [...latestPerSpot.values()];

    const candidates = tier1.detectSpotOfDay({ allCurrentReports });
    const result = await dispatcher.persist(candidates);
    logger.info('notifications/spotOfDayPublisher: done', { ...result, sampled: allCurrentReports.length });
  },
);

// ─── Public API for the scheduler hook ──────────────────────────────

module.exports = {
  runTier1ForSpot,
  boxJellyForecaster: exports.boxJellyForecaster,
  spotOfDayPublisher: exports.spotOfDayPublisher,
};
