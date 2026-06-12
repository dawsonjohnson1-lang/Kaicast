/* eslint-env node */
'use strict';

/**
 * KaiCast Firestore schema — JSDoc type definitions.
 *
 * This file is reference-only. It documents the shape of every
 * collection the server reads / writes so contributors don't have to
 * grep across handlers to discover field names. No runtime code lives
 * here; the canonical writers live in submitDiveLog.js, archiveHourly.js,
 * index.js, nightlyCalibration.js.
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
 *   calibration              → abyss_calibration/{spotId} + …/buckets/{bucketKey} (populated by nightlyCalibration)
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
 * // Signed rating-level delta on the shared 4-level scale
 * // (1=poor … 4=excellent): predicted level − observed level, −3..+3.
 * // Positive = model rated conditions better than the diver did.
 * // Used by the nightly calibration job to detect systematic
 * // over/under-prediction (replaced the old boolean rating_mismatch,
 * // which discarded direction and magnitude).
 * @property {number|null} rating_delta
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
// Per-spot bias offsets, recomputed nightly by nightlyCalibration.js
// from the last 60 days of diveLogs deltas (recency-half-life and
// observation-quality weighted). Applied by buildSpotReport via
// abyss/calibrate.js before reports land in kaicast_reports.
//
/**
 * @typedef {Object} SpotCalibration
 * @property {string} spot_id
 * @property {string} schema                'calibration-v2'
 *
 * @property {Object} bias_offsets          All signed; SUBTRACT from predictions to correct.
 * @property {number} bias_offsets.visibility_ft
 * @property {number|null} bias_offsets.water_temp_f
 * @property {number|null} bias_offsets.rating_level   Mean signed rating_delta (−3..+3).
 *
 * @property {number} mae_visibility_ft     Mean absolute error.
 * @property {number|null} r2_visibility    1 − SSres/SStot; null when observations had no variance.
 * @property {number} sample_count
 * @property {number} effective_sample_count  Kish effective N under weighting.
 * @property {number} confidence_score      0..1. Saturates with effective N.
 * @property {number} window_days
 * @property {Object} observed_aggregates   { thermocline_rate, thermocline_reports }
 * @property {FirebaseFirestore.Timestamp} last_updated_at
 */

// ─── abyss_calibration/{spotId}/buckets/{bucketKey} ──────────────────
//
// Condition-stratified visibility bias. bucketKey is one of:
//   swell_{calm|small|moderate|large}      from predicted wave_height_ft
//   tide_{rising|falling|slack|high|low}   from predicted tide_state
//   tod_{dawn|morning|midday|afternoon|dusk|night}  dive hour (HST)
//   runoff_{none|low|moderate|high|extreme}
// Only buckets with ≥3 samples are written; stale buckets are deleted
// on the next nightly run.
//
/**
 * @typedef {Object} SpotCalibrationBucket
 * @property {string} spot_id
 * @property {string} bucket_key
 * @property {string} dimension             'swell' | 'tide' | 'tod' | 'runoff'
 * @property {number} bias_visibility_ft    Signed; SUBTRACT to correct.
 * @property {number} mae_visibility_ft
 * @property {number|null} r2_visibility
 * @property {number} sample_count
 * @property {number} effective_sample_count
 * @property {number} confidence            0..1
 * @property {FirebaseFirestore.Timestamp} last_updated_at
 */

// ─── spot_stats/{spotId}/daily/{yyyy-mm-dd} ──────────────────────────
//
// Daily descriptive rollup of dives at a spot, written by
// nightlyCalibration (computeDailyRollups in abyss/calibrate.js).
// Unweighted, unlike calibration — these describe what happened that
// day, not how much to trust it. Recomputed for the whole 60-day
// window nightly, so late backdated logs self-heal.
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
