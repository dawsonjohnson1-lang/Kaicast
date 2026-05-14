/* eslint-env node */
'use strict';

/**
 * archiveHourly — copy each spot's just-finished hour's kaicast_reports
 * snapshot into a per-spot, per-HST-day gzipped JSON file in Cloud
 * Storage. Lets submitDiveLog resolve prediction snapshots for dives
 * older than a few weeks (or whatever Firestore TTL we set on the
 * hourly docs).
 *
 * Path: gs://kaicast-historical/{spot_id}/{yyyy-mm-dd-HST}.json.gz
 *
 * File shape: a single JSON array of hourly snapshots, each containing
 * the fields submitDiveLog's `extractPredictionFields` needs
 * (generatedAt, hourKey, now, sources, qcFlags). We do NOT mirror the
 * whole kaicast_reports doc — windows[] and days[] would inflate file
 * size 10× and they're never consumed by the resolver path.
 *
 * Day boundary: HST (UTC−10), no DST. Matches the diver's mental model
 * ("the dive happened on Tuesday") rather than UTC.
 *
 * Schedule: minute :05 every hour (after the :00 scheduler that
 * writes kaicast_reports — gives it 5 min slack).
 *
 * Region: us-central1.
 *
 * Bucket bootstrap: if kaicast-historical doesn't exist, the function
 * logs a warning and skips. Create the bucket once via
 *   gsutil mb -l us-central1 gs://kaicast-historical/
 * before the first run.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const db = () => admin.firestore();
const storage = () => admin.storage();

const COLD_STORAGE_BUCKET = 'kaicast-historical';
const HST_OFFSET_MS = -10 * 3600 * 1000;

// ─── Helpers ────────────────────────────────────────────────────────

function buildHourKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return (
    String(x.getUTCFullYear()) +
    String(x.getUTCMonth() + 1).padStart(2, '0') +
    String(x.getUTCDate()).padStart(2, '0') +
    String(x.getUTCHours()).padStart(2, '0')
  );
}

function formatHstDate(ms) {
  const d = new Date(ms + HST_OFFSET_MS);
  return (
    String(d.getUTCFullYear()) + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/** Compact projection — only the fields submitDiveLog's resolver reads. */
function projectForArchive(report) {
  return {
    spot:          report.spot ?? null,
    hourKey:       report.hourKey ?? null,
    generatedAt:   report.generatedAt ?? null,
    sources:       Array.isArray(report.sources) ? report.sources : [],
    qcFlags:       Array.isArray(report.qcFlags) ? report.qcFlags : [],
    now:           report.now ?? null,
  };
}

// ─── Schedule entry ─────────────────────────────────────────────────

exports.archiveHourly = onSchedule(
  {
    schedule: '5 * * * *',
    timeZone: 'Etc/UTC',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
    retryCount: 2,
  },
  async () => {
    // Skip if bucket doesn't exist (greenfield setup).
    let bucket;
    try {
      bucket = storage().bucket(COLD_STORAGE_BUCKET);
      const [bucketExists] = await bucket.exists();
      if (!bucketExists) {
        logger.warn(
          'archiveHourly: bucket missing. Create once via: ' +
          `gsutil mb -l us-central1 gs://${COLD_STORAGE_BUCKET}/`,
        );
        return;
      }
    } catch (err) {
      logger.error('archiveHourly: bucket access failed', { error: err.message });
      return;
    }

    // Target the hour that just finished. e.g. if cron fires at 14:05,
    // archive the 13:00 snapshot.
    const justFinishedMs = Date.now() - 3600 * 1000;
    const hourKey = buildHourKey(new Date(justFinishedMs));

    const snap = await db().collection('kaicast_reports')
      .where('hourKey', '==', hourKey)
      .get();

    if (snap.empty) {
      logger.info('archiveHourly: no kaicast_reports docs for hour', { hourKey });
      return;
    }

    logger.info('archiveHourly: starting', { hourKey, spotCount: snap.size });

    let written = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      const spotId = data.spot;
      if (!spotId || !data.generatedAt) continue;

      const generatedAtMs = new Date(data.generatedAt).getTime();
      if (!Number.isFinite(generatedAtMs)) continue;
      const hstDate = formatHstDate(generatedAtMs);
      const filename = `${spotId}/${hstDate}.json.gz`;
      const file = bucket.file(filename);

      try {
        // Read existing file if present, dedupe by hourKey, append.
        let entries = [];
        const [exists] = await file.exists();
        if (exists) {
          const [buf] = await file.download();
          try {
            const text = (await gunzip(buf)).toString('utf8');
            entries = JSON.parse(text);
            if (!Array.isArray(entries)) entries = [];
          } catch (err) {
            logger.warn('archiveHourly: existing file unreadable, overwriting', {
              filename, error: err.message,
            });
            entries = [];
          }
        }

        const projected = projectForArchive(data);
        const existingIdx = entries.findIndex((e) => e.hourKey === projected.hourKey);
        if (existingIdx >= 0) {
          entries[existingIdx] = projected;
        } else {
          entries.push(projected);
        }
        entries.sort((a, b) => String(a.hourKey).localeCompare(String(b.hourKey)));

        const gzipped = await gzip(Buffer.from(JSON.stringify(entries), 'utf8'));
        await file.save(gzipped, {
          contentType: 'application/json',
          metadata: {
            contentEncoding: 'gzip',
            cacheControl: 'private, max-age=3600',
          },
          resumable: false,
        });
        written++;
      } catch (err) {
        failed++;
        logger.warn('archiveHourly: spot archive failed', {
          spot: spotId, filename, error: err.message,
        });
      }
    }

    logger.info('archiveHourly: done', { hourKey, written, failed });
  },
);
