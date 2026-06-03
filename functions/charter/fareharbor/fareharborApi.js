// Shared FareHarbor partner-API client. Centralizes:
//   - the two required auth headers (app key + user key)
//   - timeout + retry (one transient retry on 5xx / network)
//   - error mapping into typed { kind, status, body } objects so
//     callers can branch without parsing fetch internals
//
// Auth model — FH partner API requires BOTH:
//   x-fareharbor-api-app   — set once per integration (shared across
//                            every KaiCast charter); read from
//                            process.env.FAREHARBOR_APP_KEY at
//                            cold-start time.
//   x-fareharbor-api-user  — per-charter; passed by callers.
//
// Provisioning the app key:
//   firebase functions:secrets:set FAREHARBOR_APP_KEY
// (or for local dev: set in functions/.env, which firebase-functions
// loads automatically when the emulator runs).

const logger = require('firebase-functions/logger');

const FH_BASE = 'https://fareharbor.com/api/external/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = 500;

function appKey() {
  const k = process.env.FAREHARBOR_APP_KEY;
  if (!k) {
    throw new FhError('app-key-missing', 0, 'FAREHARBOR_APP_KEY not set in functions env. Run firebase functions:secrets:set FAREHARBOR_APP_KEY.');
  }
  return k;
}

/** Typed FH error. `kind` is a coarse category callers can switch on
 *  without parsing HTTP details. */
class FhError extends Error {
  constructor(kind, status, message, body) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

/** GET against a FH endpoint with both auth headers. `userKey` is the
 *  per-charter key from charter_accounts/{orgId}/integrations/fareharbor.
 *  `path` is the API path WITHOUT the leading slash — e.g.
 *  `companies/blue-ocean-hawaii/items/`. */
async function fhGet(path, userKey, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = {}) {
  if (!userKey || typeof userKey !== 'string') {
    throw new FhError('user-key-missing', 0, 'userKey is required');
  }
  const url = `${FH_BASE}/${path.replace(/^\/+/, '')}`;
  const headers = {
    'x-fareharbor-api-app':  appKey(),
    'x-fareharbor-api-user': userKey,
    'Accept': 'application/json',
  };

  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    attempt += 1;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        // Don't echo the user key back in the log; the URL doesn't
        // contain it but the headers object would if logged.
        logger.warn('[fh] non-2xx', { path, status: res.status, attempt });
        if (res.status === 401 || res.status === 403) {
          throw new FhError('auth', res.status, text || 'FareHarbor rejected the credentials', text);
        }
        if (res.status === 404) {
          throw new FhError('not-found', 404, text || 'No such company / item', text);
        }
        if (res.status >= 500 && attempt <= retries) {
          // Transient — back off and retry.
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        throw new FhError('http', res.status, text || `HTTP ${res.status}`, text);
      }
      // 2xx — parse JSON. FH always returns JSON for the partner API.
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        throw new FhError('parse', res.status, 'FareHarbor returned non-JSON', text);
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof FhError) throw err;
      // Network / abort. Retry once if we have budget.
      if (attempt <= retries) {
        await sleep(RETRY_BACKOFF_MS);
        lastErr = err;
        continue;
      }
      throw new FhError('network', 0, (err && err.message) || 'Network error');
    }
  }
  throw new FhError('network', 0, (lastErr && lastErr.message) || 'Network error after retries');
}

// ─── Endpoint helpers ───────────────────────────────────────────────

/** GET /companies/{shortname}/items/ — every item the company sells. */
async function listItems(shortname, userKey) {
  return fhGet(`companies/${encodeURIComponent(shortname)}/items/`, userKey);
}

/** GET /companies/{shortname}/availabilities/date-range/{from}/{to}/
 *  Date strings are 'YYYY-MM-DD' in the company's local timezone (FH
 *  handles the time-zone math server-side). */
async function listAvailabilities(shortname, userKey, fromDate, toDate) {
  return fhGet(
    `companies/${encodeURIComponent(shortname)}/availabilities/date-range/${fromDate}/${toDate}/`,
    userKey,
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  FhError,
  fhGet,
  listItems,
  listAvailabilities,
};
