/* eslint-env node */
'use strict';

/**
 * Tier 2 notification source stubs.
 *
 * Each Tier 2 source follows the same interface:
 *
 *   {
 *     id:        string,                      // stable identifier
 *     category:  string,                      // matches schema CATEGORIES
 *     scheduleCron: string,                   // e.g. '0 * * * *'
 *     scheduleTz:   string,                   // 'Pacific/Honolulu' usually
 *     fetch():   Promise<RawSourceData>,      // pull from upstream
 *     transform(raw): AlertCandidate[],       // raw → alert candidates
 *     autoResolve?(currentSnapshot): Promise<{ predicate, category }>
 *                                             // optional early-resolve rule
 *   }
 *
 * Once `fetch` is implemented, the source registers itself with the
 * scheduler (see notifications/index.js → registerTier2Source) and
 * it slots into the same dispatcher pipeline the Tier 1 detectors use.
 *
 * Stubs below define the interface but throw on fetch() — the
 * scheduler skips any source whose fetch() throws "Not implemented".
 */

class NotImplementedError extends Error {
  constructor(source) {
    super(`Tier 2 source not yet implemented: ${source}`);
    this.notImplemented = true;
  }
}

// ─── Brown water (HI DOH) ───────────────────────────────────────────
//
// DATA SOURCE: Hawaii Department of Health Beach Monitoring Program.
//   Public endpoint: https://eha-cloud.doh.hawaii.gov/cwb/api/v1/...
//   Posts brown-water advisories per beach with start/end timestamps.
//
// AUTO-RESOLVE: 48 hrs after last rainfall reading > 0.5 in/hr at
//   the nearest NWS gauge OR the DOH endpoint clears the advisory,
//   whichever comes later. Gauge mapping uses spot.coast + lat band.
//
// TODO(launch): implement fetch() against the DOH endpoint. Beach
//   names there are inconsistent — will need a name → spotId alias
//   table similar to desktop/data/spots.ts SPOT_ALIASES.

const brownWaterSource = {
  id: 'hi-doh-brown-water',
  category: 'brown_water',
  scheduleCron: '0 * * * *', // hourly
  scheduleTz: 'Pacific/Honolulu',
  fetch: async () => { throw new NotImplementedError('hi-doh-brown-water'); },
  transform: () => [],
};

// ─── High Surf / Small Craft Advisory (NWS Honolulu) ───────────────
//
// DATA SOURCE: api.weather.gov — NWS public API. Marine zones:
//   PHZ110 Oʻahu Windward Waters, PHZ111 Oʻahu Leeward Waters, etc.
//   Endpoint: https://api.weather.gov/alerts/active?zone=PHZ110
//
// MAPPING: each spot has a `marineZone` field (need to add to spots
//   metadata). One alert per active advisory, affectedSpotIds = every
//   spot whose marineZone matches.
//
// PUSH-ELIGIBLE for High Surf only (timing matters); Small Craft is
// in-app only (recreational divers don't pilot small craft).

const surfAdvisorySource = {
  id: 'nws-honolulu-advisories',
  category: 'high_surf',
  scheduleCron: '*/30 * * * *', // every 30 min — NWS updates often
  scheduleTz: 'Pacific/Honolulu',
  fetch: async () => { throw new NotImplementedError('nws-honolulu-advisories'); },
  transform: () => [],
};

// ─── Tsunami (PTWC) ─────────────────────────────────────────────────
//
// DATA SOURCE: Pacific Tsunami Warning Center XML/CAP feed:
//   https://www.tsunami.gov/events/xml/PAAQAtom.xml
//   Atom feed of active products. Filter for Hawaii-relevant zones.
//
// CRITICAL: this is the only category that should bypass quiet hours.
// Push-eligible by default. Triggers a SITE-WIDE banner regardless of
// the user's saved-spot list (geographic = entire archipelago).
//
// CADENCE: every 5 min during an active event, every 30 min otherwise.
// We'd need conditional cron support to do this — for v1, just always
// poll every 5 min and accept the cost.

const tsunamiSource = {
  id: 'ptwc-tsunami',
  category: 'tsunami',
  scheduleCron: '*/5 * * * *',
  scheduleTz: 'Etc/UTC',
  fetch: async () => { throw new NotImplementedError('ptwc-tsunami'); },
  transform: () => [],
};

// ─── Shark incident (HI DLNR) ──────────────────────────────────────
//
// DATA SOURCE: HI DLNR shark sightings/incidents log. Scraped from
//   https://dlnr.hawaii.gov/sharks/recent-incidents/ — no API, HTML
//   parse required. Records date, location (free-text), incident type.
//
// MATCHING: geocode the free-text location → lat/lon, find any spot
// within 5 mi. Within-14-days filter applied on the read path.
//
// PUSH-ELIGIBLE — time-sensitive but rare. Quiet-hours respected
// (incidents older than 12 hrs don't need to wake people up).

const sharkSource = {
  id: 'hi-dlnr-sharks',
  category: 'shark_incident',
  scheduleCron: '0 */6 * * *', // every 6 hrs — incidents are rare
  scheduleTz: 'Pacific/Honolulu',
  fetch: async () => { throw new NotImplementedError('hi-dlnr-sharks'); },
  transform: () => [],
};

// ─── Vog (AirNow API, SO2) ──────────────────────────────────────────
//
// DATA SOURCE: AirNow API — https://docs.airnowapi.org/
//   Needs API key (free for non-commercial). Endpoint:
//   /aq/observation/latLong/current/?latitude=...&longitude=...
//
// SO2 is the relevant pollutant for vog (volcanic gas). Threshold:
// AQI > 100 → advisory; AQI > 150 → warning. Big Island spots
// (kaiwi-point, kealakekua-bay, manta-heaven) are the primary
// affected zone, but vog can reach all islands on south winds.

const vogSource = {
  id: 'airnow-vog',
  category: 'vog',
  scheduleCron: '15 * * * *', // hourly, offset to avoid the scheduler peak
  scheduleTz: 'Pacific/Honolulu',
  fetch: async () => { throw new NotImplementedError('airnow-vog'); },
  transform: () => [],
};

// ─── Registry ───────────────────────────────────────────────────────
//
// scheduler/index reads ALL_SOURCES and registers a cron per source.
// Sources whose fetch() throws NotImplementedError are silently
// skipped — they sit dormant until the fetcher is filled in.

const ALL_SOURCES = [
  brownWaterSource,
  surfAdvisorySource,
  tsunamiSource,
  sharkSource,
  vogSource,
];

module.exports = {
  ALL_SOURCES,
  NotImplementedError,
};
