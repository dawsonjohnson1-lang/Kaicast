/* eslint-env node */
'use strict';

/**
 * Unit tests for submitDiveLog's pure-function pieces (snapshot
 * resolution + delta computation + payload validation). Mocks
 * firebase-admin so the test runs without emulator orchestration.
 *
 * Run: node functions/__test__/submitDiveLog.unit.js
 */

const assert = require('assert');
const Module = require('module');

// ── Mock firebase-admin BEFORE submitDiveLog requires it ──────────
const fakeDocs = new Map();         // path → data
const fakeUploads = new Map();      // bucket/file → Buffer

const fakeDoc = (path) => ({
  get: async () => ({
    exists: fakeDocs.has(path),
    data: () => fakeDocs.get(path),
  }),
});

const fakeCollection = (name) => ({
  doc: (id) => fakeDoc(`${name}/${id}`),
});

const fakeFirestore = {
  collection: fakeCollection,
  runTransaction: async (fn) => {
    const tx = {
      get: async (ref) => ref.get(),
      set: (ref, data) => {
        // Persist sets back into fakeDocs for assertions.
        const path = ref.__path || 'unknown';
        fakeDocs.set(path, { ...(fakeDocs.get(path) || {}), ...data });
      },
    };
    return fn(tx);
  },
};

// Provide doc refs that carry their path so the txn set can record it.
fakeFirestore.collection = (name) => ({
  doc: (id) => {
    const path = id ? `${name}/${id}` : `${name}/auto_${Math.random().toString(36).slice(2, 10)}`;
    return {
      __path: path,
      id: path.split('/').pop(),
      get: async () => ({
        exists: fakeDocs.has(path),
        data: () => fakeDocs.get(path),
      }),
    };
  },
});

const fakeAdmin = {
  firestore: () => fakeFirestore,
  storage: () => ({
    bucket: () => ({
      file: () => ({
        exists: async () => [false],
        download: async () => [Buffer.alloc(0)],
      }),
    }),
  }),
};
fakeAdmin.firestore.Timestamp = {
  fromMillis: (ms) => ({ toMillis: () => ms, _ms: ms, _isTimestamp: true }),
};
fakeAdmin.firestore.FieldValue = {
  serverTimestamp: () => ({ _serverTs: true }),
};

const fakeLogger = { info: () => {}, warn: () => {}, error: () => {} };
const fakeOnCall = (_opts, handler) => handler; // identity — return raw handler so we can call it directly

const origResolve = Module._resolveFilename;
const intercepts = {
  'firebase-admin': fakeAdmin,
  'firebase-functions/v2/https': { onCall: fakeOnCall, HttpsError: class HttpsError extends Error {
    constructor(code, msg) { super(msg); this.code = code; this.httpErrorCode = code; }
  }},
  'firebase-functions/logger': fakeLogger,
};
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(intercepts, req)) return intercepts[req];
  return origLoad.apply(this, arguments);
};

// ── Now load submitDiveLog with the mocks in place ────────────────
const path = require('path');
const { submitDiveLog } = require(path.join(__dirname, '..', 'submitDiveLog.js'));

// ── Test fixtures ─────────────────────────────────────────────────

function reset() {
  fakeDocs.clear();
  fakeUploads.clear();
}

function seedSpot(spotId, extra = {}) {
  fakeDocs.set(`spots/${spotId}`, {
    id: spotId, name: 'Test Reef', lat: 21.27, lon: -157.69,
    coast: 'south', island: 'Oahu', ...extra,
  });
}

function seedKaicastReport(spotId, hourKeyMs, prediction) {
  const d = new Date(hourKeyMs);
  const hourKey =
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    String(d.getUTCHours()).padStart(2, '0');
  fakeDocs.set(`kaicast_reports/${spotId}_${hourKey}`, {
    spot: spotId,
    hourKey,
    generatedAt: new Date(hourKeyMs).toISOString(),
    sources: ['openweather', 'ndbc:51202'],
    qcFlags: [],
    now: {
      metrics: {
        airTempC: 25, windSpeedKts: 12, windGustKts: 14, windDeg: 60,
        waveHeightM: 0.6, wavePeriodS: 8, waterTempC: 26,
      },
      tide: { currentTideState: 'rising', currentTideHeight: 1.2 },
      visibility: {
        estimatedVisibilityMeters: 12,
        estimatedVisibilityFeet: 39,
        rating: 'Good',
        sun: { altitudeDeg: 50, azimuthDeg: 110 },
        shadow: { shadowed: false, horizonDeg: 0, marginDeg: 50 },
        light: { factor: 0.9 },
        wind: { relation: 'cross' },
        exposure: { swellFromDeg: 200 },
        waveImpact: { surgeRating: 20 },
      },
      confidenceScore: 0.8,
      ...prediction,
    },
  });
}

// ── Test 1: dive 30 minutes ago, snapshot in forecast doc ─────────

(async () => {
  console.log('--- Test 1: dive 30 minutes ago (live forecast resolution) ---');
  reset();
  seedSpot('hanauma-bay');
  const now = Date.now();
  const diveAt = now - 30 * 60 * 1000;
  // Seed a kaicast_reports doc at the SAME hour as dive_at.
  seedKaicastReport('hanauma-bay', diveAt, {});

  const result = await submitDiveLog({
    auth: { uid: 'test-user-1' },
    data: {
      spot_id: 'hanauma-bay',
      dive_at: diveAt,
      dive_type: 'scuba',
      privacy: 'public',
      observed: { visibility_ft: 25, overall_rating: 'fair', max_depth_ft: 30 },
    },
  });

  assert.strictEqual(result.snapshot_source, 'forecast', 'should resolve from forecast');
  assert.ok(result.resolved_within_min <= 30, 'should be within 30 min window');
  assert.ok(result.log_id, 'log_id returned');
  assert.strictEqual(result.community_overlay_updated, true, 'recent dive should update overlay');

  // Find the written dive log doc.
  const logPath = [...fakeDocs.keys()].find((k) => k.startsWith('diveLogs/'));
  assert.ok(logPath, 'a diveLogs doc was written');
  const log = fakeDocs.get(logPath);
  assert.strictEqual(log.spot_id, 'hanauma-bay');
  assert.strictEqual(log.predicted_at_time.snapshot_source, 'forecast');
  assert.strictEqual(log.predicted_at_time.visibility_ft, 39);
  // Signed delta: predicted (39) − observed (25) = +14
  assert.strictEqual(log.deltas.visibility_ft, 14, 'delta should be signed predicted−observed');
  assert.strictEqual(log.deltas.rating_mismatch, true, 'Good predicted vs fair observed → mismatch');

  // Overlay updated
  const overlay = fakeDocs.get('community_overlays/hanauma-bay');
  assert.ok(overlay, 'overlay written');
  assert.strictEqual(overlay.recent_log_count, 1);
  assert.strictEqual(overlay.avg_observed_visibility_ft, 25);
  assert.strictEqual(overlay.avg_observed_rating, 2);
  console.log('✓ Test 1 passed.');
})()
.then(async () => {

// ── Test 2: dive 10 days ago, cold storage empty → null snapshot ──

  console.log('--- Test 2: dive 10 days ago (cold storage empty, returns null snapshot) ---');
  reset();
  seedSpot('mokuleia');
  const diveAt = Date.now() - 10 * 24 * 3600 * 1000;
  const result = await submitDiveLog({
    auth: { uid: 'test-user-2' },
    data: {
      spot_id: 'mokuleia',
      dive_at: diveAt,
      dive_type: 'freedive',
      privacy: 'public',
      observed: { visibility_ft: 15 },
    },
  });

  assert.strictEqual(result.snapshot_source, null, 'no snapshot found');
  assert.strictEqual(result.community_overlay_updated, false, 'old dive should NOT update overlay');
  const logPath = [...fakeDocs.keys()].find((k) => k.startsWith('diveLogs/'));
  const log = fakeDocs.get(logPath);
  assert.strictEqual(log.predicted_at_time, null, 'predicted_at_time should be null for unresolved');
  assert.strictEqual(log.deltas, null, 'deltas should be null when predicted is null');
  assert.ok(!fakeDocs.has('community_overlays/mokuleia'), 'no overlay written for old dive');
  console.log('✓ Test 2 passed.');

// ── Test 3: invalid payload → HttpsError invalid-argument ─────────

  console.log('--- Test 3: invalid payload (missing spot_id, bad dive_at) ---');
  reset();
  let threw = false;
  try {
    await submitDiveLog({
      auth: { uid: 'test-user-3' },
      data: {
        // missing spot_id, dive_at, dive_type
        observed: {},
      },
    });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.code, 'invalid-argument', 'should throw invalid-argument');
  }
  assert.ok(threw, 'invalid payload must throw');

  // Future-bound dive_at
  threw = false;
  try {
    seedSpot('hanauma-bay');
    await submitDiveLog({
      auth: { uid: 'test-user-3' },
      data: {
        spot_id: 'hanauma-bay',
        dive_at: Date.now() + 365 * 24 * 3600 * 1000, // 1 yr future
        dive_type: 'scuba',
        observed: {},
      },
    });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.code, 'invalid-argument');
  }
  assert.ok(threw, 'future-bound dive_at must throw');

  // Unauthenticated
  threw = false;
  try {
    await submitDiveLog({
      auth: null,
      data: {
        spot_id: 'hanauma-bay', dive_at: Date.now(), dive_type: 'scuba', observed: {},
      },
    });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.code, 'unauthenticated');
  }
  assert.ok(threw, 'no auth + no claim token must throw');

  console.log('✓ Test 3 passed.');
  console.log('\nAll 3 tests passed.');
})
.catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
