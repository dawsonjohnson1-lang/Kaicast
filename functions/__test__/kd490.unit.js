/* eslint-env node */
'use strict';

/**
 * Unit tests for abyss/kd490.js reliability behavior:
 *   - soft-failure cache marker short-circuits ERDDAP re-fetch
 *   - network-failure circuit breaker opens after N consecutive
 *     failures and resets on success
 *
 * Run: node functions/__test__/kd490.unit.js
 */

const assert = require('assert');

const {
  fetchOceanColor,
  fetchErddapPoint,
  erddapBreakerOpen,
  _resetErddapBreaker,
} = require('../abyss/kd490');

// ── helpers ──────────────────────────────────────────────────────────

// Fake Firestore exposing just the get/set surface kd490.js touches.
function fakeDb(cachedData) {
  const writes = [];
  return {
    writes,
    collection() {
      return {
        doc() {
          return {
            async get() {
              return {
                exists: cachedData != null,
                data: () => cachedData,
              };
            },
            async set(payload) {
              writes.push(payload);
            },
          };
        },
      };
    },
  };
}

function mockFetch(impl) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(url);
    return impl(url, opts);
  };
  return calls;
}

const OK_CSV =
  'time,altitude,latitude,longitude,kd_490\n' +
  'UTC,m,degrees_north,degrees_east,m-1\n' +
  '2026-05-04T12:00:00Z,0.0,21.26,-157.69,0.05\n';

function okResponse() {
  return { ok: true, status: 200, text: async () => OK_CSV };
}

const realFetch = globalThis.fetch;

// ── failure-marker short-circuit ─────────────────────────────────────

(async () => {
  {
    _resetErddapBreaker();
    // Fresh soft-failure marker (kd490: null) — fetchOceanColor must
    // return null WITHOUT touching ERDDAP.
    const db = fakeDb({ kd490: null, fetchedAt: Date.now(), source: 'erddap-unavailable' });
    const calls = mockFetch(() => {
      throw new Error('should not be called');
    });
    const res = await fetchOceanColor({ lat: 21.26, lon: -157.69, nowMs: Date.now(), db });
    assert.strictEqual(res, null);
    assert.strictEqual(calls.length, 0, 'failure marker must short-circuit ERDDAP fetch');
    console.log('✓ failure marker short-circuits ERDDAP re-fetch');
  }

  {
    _resetErddapBreaker();
    // Expired marker (older than the 30-min fail TTL) falls through to
    // a real fetch attempt.
    const db = fakeDb({ kd490: null, fetchedAt: Date.now() - 31 * 60 * 1000 });
    const calls = mockFetch(okResponse);
    const res = await fetchOceanColor({ lat: 21.26, lon: -157.69, nowMs: Date.now(), db });
    assert.ok(calls.length > 0, 'expired marker must allow a re-fetch');
    assert.strictEqual(res.kd490, 0.05);
    console.log('✓ expired failure marker allows re-fetch');
  }

  // ── circuit breaker ─────────────────────────────────────────────────

  {
    _resetErddapBreaker();
    mockFetch(() => {
      throw new Error('ETIMEDOUT');
    });
    assert.strictEqual(erddapBreakerOpen(), false);
    for (let i = 0; i < 3; i++) {
      await fetchErddapPoint({ dataset: 'd', varname: 'kd_490', lat: 21.26, lon: -157.69, nowMs: Date.now() });
    }
    assert.strictEqual(erddapBreakerOpen(), true, 'breaker opens after 3 consecutive network failures');

    // Open breaker → fetchOceanColor skips ERDDAP entirely and writes
    // a soft-failure marker for the spot.
    const db = fakeDb(null);
    const calls = mockFetch(() => {
      throw new Error('should not be called');
    });
    const res = await fetchOceanColor({ lat: 21.26, lon: -157.69, nowMs: Date.now(), db });
    assert.strictEqual(res, null);
    assert.strictEqual(calls.length, 0, 'open breaker must skip ERDDAP');
    assert.strictEqual(db.writes.length, 1);
    assert.strictEqual(db.writes[0].kd490, null, 'open breaker still writes the failure marker');
    console.log('✓ breaker opens after consecutive failures and skips ERDDAP');
  }

  {
    _resetErddapBreaker();
    // Two failures, then a success — the success must reset the count
    // so the breaker stays closed.
    let fail = 2;
    mockFetch(() => {
      if (fail-- > 0) throw new Error('ETIMEDOUT');
      return okResponse();
    });
    await fetchErddapPoint({ dataset: 'd', varname: 'kd_490', lat: 21.26, lon: -157.69, nowMs: Date.now() });
    await fetchErddapPoint({ dataset: 'd', varname: 'kd_490', lat: 21.26, lon: -157.69, nowMs: Date.now() });
    assert.strictEqual(erddapBreakerOpen(), false);
    const res = await fetchErddapPoint({ dataset: 'd', varname: 'kd_490', lat: 21.26, lon: -157.69, nowMs: Date.now() });
    assert.strictEqual(res.value, 0.05);
    assert.strictEqual(erddapBreakerOpen(), false, 'success must reset the failure count');
    console.log('✓ breaker resets on success');
  }

  _resetErddapBreaker();
  globalThis.fetch = realFetch;
  console.log('\nkd490.unit.js — all tests passed');
})().catch((err) => {
  globalThis.fetch = realFetch;
  console.error(err);
  process.exit(1);
});
