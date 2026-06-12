// Standalone captain's log — Phase 1 of the log rework. A log entry is
// now its OWN document in the top-level `charter_logs/{logId}` collection
// (the same collection the mobile app's Phase-1 path uses, gated by the
// existing firestore.rules charter_logs rule) and does NOT require a trip
// to exist (FareHarbor trip sync is Phase 2).
//
// This replaces the old trip-coupled flow where saveCaptainsLog() wrote
// the log onto a trip doc and you had to pick a departed trip first.
// `tripId` is kept as an OPTIONAL link (set it if a trip happens to
// exist for that day) but it is not a foreign-key constraint — a log is
// valid with tripId === null.
//
// `operatorId` (the org id) is carried on every doc — the charter_logs
// rules filter reads/writes on it. `schema: 'standalone-v1'` marks docs
// authored by this desktop flow so the archive can distinguish them from
// the mobile rich-log shape that shares the collection.

export type LogIncidentLevel = 'none' | 'minor' | 'serious';

/** Sea-state observed by the captain — mirrors the CHOP_LABELS scale the
 *  legacy filer used so the archive reads consistently. */
export type ObservedSeaState = 'Glass' | 'Light' | 'Moderate' | 'Rough' | 'Very rough';

export type ObservedWind = 'Calm' | 'Light' | 'Moderate' | 'Fresh' | 'Strong';

export interface StandaloneLogCrew {
  id: string;
  name: string;
  role: string;
}

/**
 * Immutable conditions snapshot — the SAME shape the dive-log pipeline
 * stores at `diveLogs.predicted_at_time` (functions DivePredicted) and
 * the mobile rich-log stores at `CharterLog.conditionsSnapshot`. Resolved
 * SERVER-SIDE — for standalone logs, by the `captureStandaloneLogSnapshot`
 * Firestore onCreate trigger — for `primarySpotId` on the log's date, then
 * never mutated. Feeds the bias-calibration flywheel exactly like dive
 * logs. `null` is valid (nothing resolved); the calibration job skips it.
 */
export interface ConditionsSnapshot {
  snapshot_source: 'forecast' | 'cold_storage';
  snapshot_at_iso: string;
  resolved_within_min: number;
  hour_key: string;
  sources: string[];
  qc_flags: string[];
  visibility_ft: number | null;
  visibility_rating: 'Poor' | 'Fair' | 'Good' | 'Excellent' | null;
  wave_height_ft: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
  wind_direction_deg: number | null;
  wind_relation: 'onshore' | 'offshore' | 'cross' | 'unknown' | null;
  tide_state: 'rising' | 'falling' | 'high' | 'low' | 'unknown' | null;
  tide_height_ft: number | null;
  water_temp_f: number | null;
  air_temp_f: number | null;
  surge_rating: number | null;
  sun_altitude_deg: number | null;
  sun_azimuth_deg: number | null;
  in_shadow: boolean | null;
  light_factor: number | null;
  confidence_score: number | null;
}

export interface StandaloneLog {
  logId: string;
  /** Org id — the charter_logs rules filter reads/writes on this. */
  operatorId: string;
  /** Marks this as a desktop standalone-flow doc (vs the mobile rich
   *  CharterLog shape that shares the collection). */
  schema: 'standalone-v1';
  /** Epoch ms — start-of-day HST for the day being logged. */
  date: number;

  // What ran.
  vesselId: string;
  vesselName: string;
  /** Charter spot ids visited. At least one required at the UI level. */
  spotIds: string[];

  // Observed conditions (captain's eye — distinct from the Abyss forecast).
  weather: string;
  seaState: ObservedSeaState | '';
  visibilityFt: number | null;
  windObserved: ObservedWind | '';

  // Notes / incidents.
  incident: LogIncidentLevel;
  incidentDetail: string;
  notes: string;

  // Crew + counters.
  crew: StandaloneLogCrew[];
  durationHours: number | null;
  /** Optional "ran N trips today, one log entry" counter. */
  tripCount: number | null;

  /** Optional link to a trip doc if one exists for the day. NOT required. */
  tripId: string | null;

  // ── Paper-form parity (MANA Cruises daily log). CAPTURE-AND-STORE
  //    ONLY: nothing reads these back — no runtime/fuel-rate math, no
  //    prior-log lookups, no dashboard surface. They exist so the form
  //    matches the paper log captains already fill out. Optional so
  //    pre-existing docs without them stay valid reads. ──
  portEngineHours?: number | null;
  /** Hidden in the UI for single-engine vessels (engineConfig). */
  stbdEngineHours?: number | null;
  /** Gallons added today. */
  fuelAdded?: number | null;
  /** Stored exactly as entered — the field is labeled gal / % and we do
   *  no unit interpretation. */
  fuelRemaining?: number | null;
  /** Boat condition / maintenance comments — distinct from tripComments. */
  boatComments?: string;
  inventoryNeeded?: string;
  /** Trip-level comments — distinct from boatComments AND from `notes`. */
  tripComments?: string;
  /** Snorkel site as written on the paper form — free text, NOT a spot id. */
  snorkelSite?: string;

  // ── Server-resolved snapshot (filled by the captureStandaloneLogSnapshot
  //    trigger; clients never write these — locked in firestore.rules). ──
  /** Operating spot used for the snapshot — the first spot visited
   *  (`spotIds[0]`). Canonical KaiCast spot id. */
  primarySpotId?: string | null;
  /** Immutable conditions snapshot for primarySpotId on `date`. */
  conditionsSnapshot?: ConditionsSnapshot | null;
  /** True when the day ran no trips (tripCount null/0). */
  zeroTripDay?: boolean;

  // Meta.
  filedByUid: string;
  filedByName: string;
  createdAt: number;
  updatedAt: number;
}

/** Draft shape the filer edits — everything the server/meta fields fill
 *  in is omitted (including the server-resolved snapshot fields). */
export type StandaloneLogDraft = Omit<
  StandaloneLog,
  | 'logId' | 'operatorId' | 'schema' | 'filedByUid' | 'filedByName'
  | 'createdAt' | 'updatedAt'
  | 'primarySpotId' | 'conditionsSnapshot' | 'zeroTripDay'
>;

/** Start-of-day HST (UTC−10, no DST) for an epoch ms. */
export function hstStartOfDay(epochMs: number): number {
  const HST_OFFSET_MS = -10 * 60 * 60 * 1000;
  const shifted = new Date(epochMs + HST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - HST_OFFSET_MS;
}

export function emptyLogDraft(): StandaloneLogDraft {
  return {
    date: hstStartOfDay(Date.now()),
    vesselId: '',
    vesselName: '',
    spotIds: [],
    weather: '',
    seaState: '',
    visibilityFt: null,
    windObserved: '',
    incident: 'none',
    incidentDetail: '',
    notes: '',
    crew: [],
    durationHours: null,
    tripCount: null,
    tripId: null,
    portEngineHours: null,
    stbdEngineHours: null,
    fuelAdded: null,
    fuelRemaining: null,
    boatComments: '',
    inventoryNeeded: '',
    tripComments: '',
    snorkelSite: '',
  };
}
