/* eslint-env node */
'use strict';

/**
 * KaiCast notification engine — schema definitions.
 *
 * Single source of truth for alert categories, severities, and the
 * shape of /spot_alerts docs and /users/{uid}/notification_prefs docs.
 * Every emitter goes through `validateAlert()` before write so we
 * can't accidentally ship malformed docs to production.
 */

// ─── Categories ──────────────────────────────────────────────────────
//
// Tier 1 — derived from data already in the abyss pipeline.
// Tier 2 — needs one external fetcher per category.
// Tier 3 — needs user-generated data / friend graph (deferred).
//
// Push-eligible categories are gated by user prefs AND a hard list in
// `notifications/dispatcher.js` — anything not on the list is in-app
// only regardless of user choice. This prevents an accidental
// "promote spot_of_day to push" change from spamming everyone.

const CATEGORIES = {
  // ── Tier 1 ─────────────────────────────────────────
  vis_spike:       { tier: 1, defaultInApp: true,  pushEligible: false, label: 'Visibility spike' },
  wind_drop:       { tier: 1, defaultInApp: true,  pushEligible: false, label: 'Wind dropping' },
  window_open:     { tier: 1, defaultInApp: true,  pushEligible: false, label: 'Window opening' },
  streak_start:    { tier: 1, defaultInApp: true,  pushEligible: false, label: 'New streak' },
  streak_end:      { tier: 1, defaultInApp: true,  pushEligible: false, label: 'Streak ending' },
  tide_alignment:  { tier: 1, defaultInApp: true,  pushEligible: false, label: 'Tide alignment' },
  spot_of_day:     { tier: 1, defaultInApp: true,  pushEligible: false, label: 'Spot of the day' },

  // ── Tier 2 ─────────────────────────────────────────
  brown_water:     { tier: 2, defaultInApp: true,  pushEligible: false, label: 'Brown water advisory', source: 'hi-doh' },
  high_surf:       { tier: 2, defaultInApp: true,  pushEligible: true,  label: 'High Surf Advisory',   source: 'nws-honolulu' },
  small_craft:     { tier: 2, defaultInApp: true,  pushEligible: false, label: 'Small Craft Advisory', source: 'nws-honolulu' },
  box_jelly:       { tier: 2, defaultInApp: true,  pushEligible: true,  label: 'Box jellyfish window', source: 'kaicast-lunar' },
  tsunami:         { tier: 2, defaultInApp: true,  pushEligible: true,  label: 'Tsunami advisory',     source: 'ptwc' },
  shark_incident:  { tier: 2, defaultInApp: true,  pushEligible: true,  label: 'Shark incident',       source: 'hi-dlnr' },
  vog:             { tier: 2, defaultInApp: true,  pushEligible: false, label: 'Vog / air quality',    source: 'airnow' },
};

const ALL_CATEGORIES = Object.keys(CATEGORIES);

const SEVERITIES = ['info', 'advisory', 'warning', 'urgent'];

// ─── Alert object shape ─────────────────────────────────────────────
//
// /spot_alerts/{alertId}
//   {
//     alertId:        string  (Firestore doc id)
//     category:       string  (one of CATEGORIES)
//     severity:       'info' | 'advisory' | 'warning' | 'urgent'
//     affectedSpotIds: string[]   (canonical spot ids; empty array =
//                                  archipelago-wide, e.g. tsunami)
//     affectedIslands: string[]   (denormalized for cheap island-level
//                                  queries — e.g. when a user has zero
//                                  saved spots on the affected island
//                                  we can still surface)
//     title:          string  (5–8 words, sentence case, no trailing period)
//     body:           string  (1–2 sentences, conversational, links inline ok)
//     startMs:        number  (when the condition begins)
//     endMs:          number  (when it auto-resolves; alerts past their
//                              endMs are filtered out at read time)
//     source:         string  (provenance — 'kaicast-derived',
//                              'hi-doh', 'nws-honolulu', etc.)
//     sourceUrl:      string?  (upstream link for the user to verify)
//     createdAt:      Timestamp
//     resolvedAt:     Timestamp?  (when an auto-resolve fires early —
//                                  e.g. brown water cleared by gauge)
//     metadata:       object  (category-specific payload, see emitters)
//   }
//
// Indexing:
//   Composite: (affectedSpotIds array-contains-any, endMs DESC) — the
//   per-spot feed query.
//   Composite: (affectedIslands array-contains, endMs DESC) —
//   island-level fallback.
//   Composite: (category, endMs DESC) — admin/category browsing.
//   Single field on endMs is auto-indexed; we never need a "before"
//   query so no extra index.
//
// TTL:
//   Native Firestore TTL on endMs. Alerts auto-delete 7 days past
//   their endMs (a long-enough tail that "spot of day" history is
//   still browsable for a week without storage bloat).

function validateAlert(a) {
  const errs = [];
  if (!a || typeof a !== 'object') return ['alert must be an object'];
  if (!ALL_CATEGORIES.includes(a.category)) errs.push(`category invalid: ${a.category}`);
  if (!SEVERITIES.includes(a.severity)) errs.push(`severity invalid: ${a.severity}`);
  if (!Array.isArray(a.affectedSpotIds)) errs.push('affectedSpotIds must be array');
  if (!Array.isArray(a.affectedIslands)) errs.push('affectedIslands must be array');
  if (typeof a.title !== 'string' || a.title.length < 4 || a.title.length > 120) errs.push('title length 4-120');
  if (typeof a.body !== 'string' || a.body.length < 6 || a.body.length > 280) errs.push('body length 6-280');
  if (!Number.isFinite(a.startMs)) errs.push('startMs must be a finite number');
  if (!Number.isFinite(a.endMs) || a.endMs <= a.startMs) errs.push('endMs must be > startMs');
  if (typeof a.source !== 'string') errs.push('source required');
  return errs;
}

// ─── User prefs shape ───────────────────────────────────────────────
//
// /users/{uid}/notification_prefs (single doc, id 'default')
//   {
//     push:   { [category]: boolean }   // defaults applied at read time
//     inApp:  { [category]: boolean }
//     pushDeviceTokens: string[]         // FCM tokens (mirrored from
//                                        // users/{uid}/devices/*)
//     quietHours: { startHour: number, endHour: number } | null
//                                        // 24-h local Hawaii time; if
//                                        // set, suppresses non-urgent
//                                        // pushes inside the window
//   }

function defaultUserPrefs() {
  const push = {};
  const inApp = {};
  for (const [cat, def] of Object.entries(CATEGORIES)) {
    push[cat]  = false;          // default OFF for everything — opt-in
    inApp[cat] = def.defaultInApp;
  }
  // Life-safety categories default ON for push
  push.tsunami       = true;
  push.shark_incident = true;
  push.box_jelly     = true;
  push.high_surf     = true;
  return { push, inApp, pushDeviceTokens: [], quietHours: null };
}

module.exports = {
  CATEGORIES,
  ALL_CATEGORIES,
  SEVERITIES,
  validateAlert,
  defaultUserPrefs,
};
