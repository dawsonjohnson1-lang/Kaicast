/* eslint-env node */
'use strict';

/**
 * KaiCast Firestore schema — JSDoc type definitions.
 *
 * This file is reference-only. It documents the shape of every
 * collection the server reads / writes so contributors don't have to
 * grep across handlers to discover field names. No runtime code lives
 * here; the canonical writers live in submitDiveLog.js, archiveHourly.js,
 * index.js, abyss/calibration.js.
 *
 * Naming conventions (NEW collections + sub-objects added in the
 * snapshot-on-submit pipeline):
 *   - snake_case keys
 *   - Units suffixed in the field name: _ft, _f, _kt, _s, _deg, _ms, _m,
 *     _mi, _percent
 *   - Deltas are SIGNED (predicted − observed). Negative = model under-
 *     predicted the observed quantity.
 *
 * Legacy collections (diveLogs created via the old client `addDoc`
 * path) retain their original camelCase fields. New fields on those
 * docs follow the new convention. See submitDiveLog.js for the
 * normalization that handles both.
 *
 * Path-B collection mapping (see CLAUDE.md for context):
 *
 *   PROMPT NAME              → ACTUAL FIRESTORE PATH
 *   ──────────────────────────────────────────────────────
 *   dive_observations        → diveLogs/{logId}                  (existing, schema extended)
 *   current_conditions       → kaicast_reports/{spotId}_{hourKey}.now (existing)
 *   forecast                 → kaicast_reports/{spotId}_{hourKey}.windows + .days (existing)
 *   community_overlay        → community_overlays/{spotId}       (NEW separate doc — survives hourly rewrites)
 *   calibration              → abyss_calibration/{spotId}        (existing — populated by future nightly job)
 *   spot_stats               → spot_stats/{spotId}/daily/{yyyy-mm-dd} (NEW — populated by future nightly job)
 */

// ─── community_overlays/{spotId} ─────────────────────────────────────
//
// Rolling community-observed conditions snapshot per spot. Updated by
// `submitDiveLog` when the user logs a dive within the last 6 hours.
// Stored as a separate top-level doc so the hourly rewrite of
// `kaicast_reports` doesn't wipe the community signal every hour.
//
/**
 * @typedef {Object} CommunityOverlay
 * @property {number}        recent_log_count           Count of dives logged within window_h.
 * @property {number}        window_h                   Rolling window size in hours (default 6).
 * @property {number|null}   avg_observed_visibility_ft Linear mean of observed visibility_ft across the window.
 * @property {number|null}   avg_observed_rating        Numeric mean of observed rating (1=poor, 4=excellent).
 * @property {FirebaseFirestore.Timestamp|null} last_log_at  Timestamp of most-recent log in the window.
 * @property {FirebaseFirestore.Timestamp}      updated_at   serverTimestamp at write.
 */

// ─── diveLogs/{logId}  (the dive_observation in path-B mapping) ──────
//
// The new `submitDiveLog` callable writes documents in this shape.
// Legacy fields from the previous `addDoc` path (visibilityFt nested
// under .conditions, conditionsSnapshot blob, etc.) are still accepted
// as input and normalized into the canonical fields below before write.
//
/**
 * @typedef {Object} DiveObservation
 *
 * @property {string}  uid                    Firebase Auth uid OR anonymous claim token id.
 * @property {string}  spot_id                FK into spots/{spot_id}.
 * @property {FirebaseFirestore.Timestamp} dive_at   When the dive actually happened (user-provided).
 * @property {FirebaseFirestore.Timestamp} logged_at serverTimestamp at write.
 * @property {string}  dive_type              'scuba' | 'freedive' | 'spear' | 'snorkel'.
 * @property {string}  privacy                'public' | 'private'.
 * @property {string|null}  verified_by_guide null until a moderation flow flags it as verified.
 *
 * @property {DiveObserved}   observed         What the diver actually reported.
 * @property {DivePredicted|null} predicted_at_time  Server-resolved prediction snapshot at dive_at.
 *                                            null when neither forecast nor cold-storage could resolve.
 * @property {DiveDeltas|null}    deltas       Signed deltas (predicted − observed). null when
 *                                            predicted_at_time is null.
 * @property {DiveContext}        context      Denormalized at write time — spot coords, sources, qc flags.
 *
 * @property {Object|null}   scuba             Activity-specific block; null for non-scuba dives.
 * @property {Array<string>} photos            Storage paths.
 * @property {string|null}   notes
 *
 * // Legacy fields preserved for client backwards-compat:
 * @property {number|null}   visibilityFt      Legacy mirror of observed.visibility_ft.
 * @property {Object|null}   conditions        Legacy nested observed-conditions block.
 * @property {Object|null}   conditionsSnapshot Legacy denormalized prediction blob (deprecated; use predicted_at_time).
 */

/**
 * @typedef {Object} DiveObserved
 * @property {number|null} visibility_ft
 * @property {string|null} surface_state         'glassy' | 'light_chop' | 'whitecaps' | 'breaking'
 * @property {string|null} current_strength      'none' | 'light' | 'moderate' | 'strong'
 * @property {string|null} current_direction     'with_shore' | 'against' | 'parallel' | 'variable' | 'reversing'
 * @property {string|null} water_color           'blue' | 'green' | 'brown' | 'silty'
 * @property {string|null} particulate           'clean' | 'some' | 'heavy'
 * @property {string|null} surge_at_depth        'none' | 'mild' | 'strong'
 * @property {string|null} marine_life_activity  'low' | 'normal' | 'high'
 * @property {string|null} overall_rating        'poor' | 'fair' | 'good' | 'excellent'
 * @property {number|null} water_temp_surface_f
 * @property {number|null} water_temp_bottom_f
 * @property {number|null} max_depth_ft
 * @property {number|null} duration_min
 * @property {Array<string>} hazards
 * @property {string|null} hazards_other_text
 */

/**
 * @typedef {Object} DivePredicted
 * @property {'forecast'|'cold_storage'} snapshot_source
 * @property {string} snapshot_at_iso     ISO 8601 of when this prediction was generated.
 * @property {number} resolved_within_min Minutes between dive_at and the chosen snapshot's generatedAt.
 * @property {string} hour_key            Pipeline hourKey (YYYYMMDDHH) of the resolved snapshot.
 *
 * @property {number|null} visibility_ft
 * @property {string|null} visibility_rating   'Poor' | 'Fair' | 'Good' | 'Excellent'
 * @property {number|null} wave_height_ft
 * @property {number|null} wave_period_s
 * @property {number|null} wave_direction_deg
 * @property {number|null} wind_speed_kt
 * @property {number|null} wind_gust_kt
 * @property {number|null} wind_direction_deg
 * @property {string|null} wind_relation       'onshore' | 'offshore' | 'cross' | 'unknown'
 * @property {string|null} tide_state          'rising' | 'falling' | 'high' | 'low' | 'unknown'
 * @property {number|null} tide_height_ft
 * @property {number|null} water_temp_f
 * @property {number|null} air_temp_f
 * @property {number|null} surge_rating        0..100 from abyss.wave_impact.surgeRating
 * @property {number|null} sun_altitude_deg
 * @property {number|null} sun_azimuth_deg
 * @property {boolean|null} in_shadow
 * @property {number|null} light_factor        0..1
 * @property {number|null} confidence_score    0..1
 */

/**
 * @typedef {Object} DiveDeltas
 *
 * Each delta is SIGNED: predicted − observed.
 *   Positive → model over-predicted (predicted higher than reality)
 *   Negative → model under-predicted
 *   null     → either side missing for this dive
 *
 * @property {number|null} visibility_ft
 * @property {number|null} water_temp_f
 *
 * // Categorical mismatch flags — true when predicted vs observed
 * // differ on rating-level enums. Used by the nightly calibration job.
 * @property {boolean|null} rating_mismatch     predicted.visibility_rating !== observed.overall_rating
 */

/**
 * @typedef {Object} DiveContext
 * @property {number} spot_lat
 * @property {number} spot_lon
 * @property {string} coast              'north' | 'south' | 'east' | 'west'
 * @property {string|null} island
 * @property {Array<string>} sources     ['openweather', 'ndbc:51201', 'noaa-tides:1612340', 'open-meteo-marine']
 * @property {Array<string>} qc_flags    From the underlying kaicast_reports doc.
 * @property {string} client_platform    'ios' | 'android' | 'web' | 'unknown'
 * @property {string} client_version
 */

// ─── abyss_calibration/{spotId}  (the calibration in path-B mapping) ─
//
// Per-spot bias offsets, populated by a future nightly job (not in scope
// of this commit). Existing helpers in abyss/calibration.js already
// read this shape — extending here for documentation only.
//
/**
 * @typedef {Object} SpotCalibration
 * @property {string} spot_id
 *
 * @property {Object} bias_offsets
 * @property {number} bias_offsets.visibility_ft   Signed; SUBTRACT from predictions to correct.
 *
 * @property {Object<string, Object>} conditional_biases
 *           Conditional bias offsets keyed by context bucket — e.g.
 *           { 'low_light':            { visibility_ft: 4.2 },
 *             'onshore_trades_15kt+': { visibility_ft: 6.1 } }
 *
 * @property {number} sample_count
 * @property {number} confidence_score     0..1. Grows with sample_count.
 * @property {FirebaseFirestore.Timestamp} last_updated_at
 */

// ─── spot_stats/{spotId}/daily/{yyyy-mm-dd} ──────────────────────────
//
// Daily rollup of dives at a spot. Populated by the same future
// nightly job that updates calibration. NOT WRITTEN IN THIS COMMIT.
//
/**
 * @typedef {Object} SpotDailyStats
 * @property {string} date                  YYYY-MM-DD (HST).
 * @property {string} spot_id
 * @property {number} dive_count
 * @property {number|null} avg_observed_visibility_ft
 * @property {number|null} avg_predicted_visibility_ft
 * @property {number|null} mae_visibility_ft           Mean absolute error: avg(|delta|).
 * @property {number|null} mean_signed_delta_visibility_ft
 * @property {FirebaseFirestore.Timestamp} computed_at
 */

module.exports = {};
