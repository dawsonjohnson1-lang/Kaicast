/* eslint-env node */
'use strict';

/**
 * Unit tests for snapshotResolver's cold-storage fallback, specifically
 * the HST-midnight boundary: archive files are bucketed by the HST date
 * of each snapshot's generatedAt, so an in-window snapshot can live in
 * the day adjacent to the dive's own HST date. Mocks firebase-admin so
 * the test runs without emulator orchestration.
 *
 * Run: node functions/__test__/snapshotResolver.unit.js
 */

const assert = require('assert');
const zlib = require('zlib');
const Module = require('module');

// ── Mock firebase-admin BEFORE snapshotResolver requires it ───────
const fakeFiles = new Map(); // "bucket/path" → Buffer (gzipped JSON)

const fakeAdmin = {
  firestore: () => ({
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
    }),
  }),
  storage: () => ({
    bucket: (bucketName) => ({
      file: (path) => ({
        exists: async () => [fakeFiles.has(`${bucketName}/${path}`)],
        download: async () => [fakeFiles.get(`${bucketName}/${path}`)],
      }),
    }),
  }),
};

const fakeLogger = { info: () => {}, warn: () => {}, error: () => {} };

const intercepts = {
  'firebase-admin': fakeAdmin,
  'firebase-functions/logger': fakeLogger,
};
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(intercepts, req)) return intercepts[req];
  return origLoad.apply(this, arguments);
};

// ── Now load snapshotResolver with the mocks in place ─────────────
const path = require('path');
const {
  COLD_STORAGE_BUCKET,
  formatHstDate,
  resolveFromColdStorage,
} = require(path.join(__dirname, '..', 'snapshotResolver.js'));

// ── Fixtures ──────────────────────────────────────────────────────

function seedArchive(spotId, hstDate, entries) {
  const buf = zlib.gzipSync(Buffer.from(JSON.stringify(entries), 'utf8'));
  fakeFiles.set(`${COLD_STORAGE_BUCKET}/${spotId}/${hstDate}.json.gz`, buf);
}

function makeEntry(generatedAtMs) {
  return {
    generatedAt: new Date(generatedAtMs).toISOString(),
    sources: ['openweather'],
    qcFlags: [],
    now: {
      metrics: { waveHeightM: 0.6, windSpeedKts: 10 },
      tide: { currentTideState: 'rising', currentTideHeight: 1.1 },
      visibility: { estimatedVisibilityFeet: 40, rating: 'Good' },
      confidenceScore: 0.8,
    },
  };
}

(async () => {

// ── Test 1: 23:45 HST dive, snapshot in NEXT HST day's file ───────

  console.log('--- Test 1: 23:45 HST dive resolves from next HST day\'s archive ---');
  fakeFiles.clear();
  // 23:45 HST on 2026-01-15 == 2026-01-16T09:45:00Z.
  const diveAtMs = Date.parse('2026-01-16T09:45:00Z');
  // Nearest snapshot 00:05 HST on 2026-01-16 (20 min away) — lands in
  // the 2026-01-16 file, not the dive's own 2026-01-15 file.
  const snapshotAtMs = Date.parse('2026-01-16T10:05:00Z');
  assert.strictEqual(formatHstDate(diveAtMs), '2026-01-15');
  assert.strictEqual(formatHstDate(snapshotAtMs), '2026-01-16');
  seedArchive('test-reef', '2026-01-16', [makeEntry(snapshotAtMs)]);

  const result = await resolveFromColdStorage('test-reef', diveAtMs);
  assert.ok(result, 'should resolve across the HST midnight boundary');
  assert.strictEqual(result.snapshot_source, 'cold_storage');
  assert.strictEqual(result.resolved_within_min, 20);
  assert.strictEqual(result.visibility_ft, 40);
  console.log('✓ Test 1 passed.');

// ── Test 2: same-day file still resolves (no regression) ──────────

  console.log('--- Test 2: same-HST-day archive still resolves ---');
  fakeFiles.clear();
  // 12:00 HST on 2026-01-15 == 2026-01-15T22:00:00Z.
  const middayMs = Date.parse('2026-01-15T22:00:00Z');
  seedArchive('test-reef', '2026-01-15', [makeEntry(middayMs + 10 * 60 * 1000)]);

  const sameDay = await resolveFromColdStorage('test-reef', middayMs);
  assert.ok(sameDay, 'should resolve from the dive\'s own HST-day file');
  assert.strictEqual(sameDay.resolved_within_min, 10);
  console.log('✓ Test 2 passed.');

// ── Test 3: out-of-window snapshot stays null ─────────────────────

  console.log('--- Test 3: snapshot outside 30-min window returns null ---');
  fakeFiles.clear();
  // Only snapshot is 45 min after the dive — outside the window, even
  // though its file is now loaded by the adjacent-day walk.
  seedArchive('test-reef', '2026-01-16', [makeEntry(diveAtMs + 45 * 60 * 1000)]);

  const miss = await resolveFromColdStorage('test-reef', diveAtMs);
  assert.strictEqual(miss, null, 'out-of-window snapshot must not match');
  console.log('✓ Test 3 passed.');

  console.log('\nAll 3 tests passed.');
})()
.catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
