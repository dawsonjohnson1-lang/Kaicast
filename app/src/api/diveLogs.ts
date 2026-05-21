// Dive log persistence — writes to Firestore `diveLogs/{logId}` when
// configured, falls back to a local AsyncStorage queue otherwise so the
// LogDive form's "Save" still produces a record in demo mode.
//
// Schema:
//   diveLogs/{logId}: {
//     uid:         string                              // Firebase user id
//     spotId:      string                              // matches spots collection / SPOTS in functions
//     loggedAt:    Timestamp                           // set server-side on write
//     diveType:    'scuba' | 'freedive' | 'spear' | 'snorkel'
//     groupSize:   string                              // 'Solo' | 'With a buddy' | …
//     durationMin: number | null
//     depthFt:     number | null
//     surface:     'Calm' | 'Choppy' | 'Rough'
//     current:     'None' | 'Light' | 'Moderate' | 'Strong'
//     visibility:  'Crystal' | 'Clean' | 'Murky' | 'Green'
//     waterTempF:  number | null
//     notes:       string
//     privacy:     'public' | 'friends' | 'private'
//     photos:      string[]                            // Firebase Storage URLs
//     conditionsSnapshot?: BackendReport               // optional: report at log time, captured for cross-reference
//   }
//
// The `conditionsSnapshot` field is what makes this work as a
// cross-reference dataset: when a user saves a dive log, we capture the
// then-current BackendReport for that spot/hour. Later we can join logs
// back against the canonical reports/{spotId}/hourly/{hourKey} index
// without worrying about the report shape changing.

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as fbLimit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { app, db, firebaseConfigured } from '@/firebase';
import type { BackendReport } from '@/api/kaicast';
import type { DiveType } from '@/types';

const STUB_QUEUE_KEY = 'kaicast.diveLogs.stub.v1';

export type DiveLogPrivacy = 'public' | 'friends' | 'private';

export type DiveLogInput = {
  uid: string;
  spotId: string;
  /**
   * Unix ms when the dive actually happened. The LogDive form parses
   * its date + time fields into this; if both are unparseable we fall
   * back to "now" inside the submit pipeline. The server clamps
   * dive_at to [now − 1yr, now + 24h].
   */
  diveAt?: number;
  /**
   * Set when the user added an ad-hoc spot in the picker. Carries the
   * human-readable name and lat/lon inline so the log is meaningful
   * even though the backend has no canonical SPOTS entry. Known-spot
   * picks leave this undefined.
   */
  customSpot?: { name: string; lat: number; lon: number };
  diveType: DiveType;
  groupSize?: string;
  durationMin?: number | null;
  depthFt?: number | null;
  surface?: string;
  current?: string;
  visibility?: string;
  waterTempF?: number | null;
  notes?: string;
  privacy?: DiveLogPrivacy;
  photos?: string[];
  conditionsSnapshot?: BackendReport | null;
  /**
   * Diver-reported conditions captured in step 3 of LogDive. These are
   * the validation/ground-truth fields used to compare what divers
   * actually experienced against what KaiCast predicted in
   * conditionsSnapshot. Filled for all activities, not just scuba.
   */
  conditions?: {
    visibilityFt?: number;
    surfaceState?: 'glassy' | 'light_chop' | 'whitecaps' | 'breaking';
    currentStrength?: 'none' | 'light' | 'moderate' | 'strong';
    currentDirection?: 'with_shore' | 'against' | 'parallel' | 'variable' | 'reversing';
    waterColor?: 'blue' | 'green' | 'brown' | 'silty';
    particulate?: 'clean' | 'some' | 'heavy';
    surgeAtDepth?: 'none' | 'mild' | 'strong';
    marineLifeActivity?: 'low' | 'normal' | 'high';
    overallRating?: 'poor' | 'fair' | 'good' | 'excellent';
    forecastAccuracy?: 'much_worse' | 'worse' | 'as_predicted' | 'better' | 'much_better';
    notes?: string;
    /** Tier-3 hazards. Multi-select; `hazardsOther` carries the
     *  free-text detail when 'other' is among them. */
    hazards?: ('jellyfish' | 'rip_current' | 'boat_traffic' | 'discharge_plume' | 'wildlife' | 'gear_failure' | 'other')[];
    hazardsOther?: string;
  };
  /**
   * Scuba-only fields. All optional — present when diveType === 'scuba'
   * and the user filled the comprehensive step-2 form. Stored on the
   * same `diveLogs/{logId}` doc so listing/cross-reference still works.
   */
  scuba?: {
    diveSubType?: 'shore' | 'boat' | 'drift' | 'night' | 'wreck' | 'cave' | 'training';
    entryType?: 'giant_stride' | 'back_roll' | 'shore';
    maxDepthFt?: number;
    visibilityFt?: number;
    waterTempSurfaceF?: number;
    waterTempBottomF?: number;
    gasMix?: 'air' | 'eanx' | 'trimix';
    o2Percent?: number;
    hePercent?: number;
    tankStartPsi?: number;
    tankEndPsi?: number;
    tankSizeCuft?: number;
    safetyStopDepthFt?: number;
    safetyStopMin?: number;
    weightLbs?: number;
    suitType?: 'wetsuit' | 'drysuit' | 'skin';
    wetsuitThickness?: '3mm' | '5mm' | '7mm';
    buddyName?: string;
    // Calculated, stored for fast logbook queries.
    airUsedPsi?: number;
    sacRate?: number;
  };
};

export type DiveLogRecord = DiveLogInput & {
  id: string;
  loggedAt: Date | null;
};

/**
 * Persist a dive log. Returns the new record's id.
 *
 * Now routes through the server-side `submitDiveLog` callable so the
 * prediction snapshot is resolved server-trusted (not client-supplied).
 * The client never writes to `diveLogs/` directly anymore — rules deny it.
 *
 * - Firebase configured: invoke the callable; it returns { log_id }.
 * - Otherwise: append to local AsyncStorage queue (demo mode unchanged).
 */
export async function submitDiveLog(input: DiveLogInput): Promise<string> {
  if (firebaseConfigured && app) {
    const fn = httpsCallable<unknown, { log_id: string }>(
      getFunctions(app, 'us-central1'),
      'submitDiveLog',
    );
    const payload = toCallablePayload(input);
    const res = await fn(payload);
    return res.data.log_id;
  }
  // Stub fallback.
  const id = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: DiveLogRecord = { ...input, id, loggedAt: new Date() };
  const raw = await AsyncStorage.getItem(STUB_QUEUE_KEY);
  const queue: DiveLogRecord[] = raw ? JSON.parse(raw) : [];
  queue.unshift(record);
  await AsyncStorage.setItem(STUB_QUEUE_KEY, JSON.stringify(queue.slice(0, 200)));
  return id;
}

/**
 * Maps the legacy camelCase DiveLogInput shape (consumed by the
 * LogDive screens for years) onto the snake_case payload the
 * `submitDiveLog` callable expects. Keeps the rest of the app
 * unchanged — only this one mapper has to stay in sync with the
 * server schema in functions/types/schema.js.
 */
function toCallablePayload(input: DiveLogInput): Record<string, unknown> {
  const c = input.conditions ?? {};
  const s = input.scuba ?? {};
  const observed = {
    visibility_ft:        c.visibilityFt ?? s.visibilityFt ?? null,
    surface_state:        c.surfaceState ?? null,
    current_strength:     c.currentStrength ?? null,
    current_direction:    c.currentDirection ?? null,
    water_color:          c.waterColor ?? null,
    particulate:          c.particulate ?? null,
    surge_at_depth:       c.surgeAtDepth ?? null,
    marine_life_activity: c.marineLifeActivity ?? null,
    overall_rating:       c.overallRating ?? null,
    water_temp_surface_f: s.waterTempSurfaceF ?? input.waterTempF ?? null,
    water_temp_bottom_f:  s.waterTempBottomF ?? null,
    max_depth_ft:         s.maxDepthFt ?? input.depthFt ?? null,
    duration_min:         input.durationMin ?? null,
    hazards:              c.hazards ?? [],
    hazards_other_text:   c.hazardsOther ?? null,
  };
  return {
    spot_id:   input.spotId,
    dive_at:   Number.isFinite(input.diveAt) ? input.diveAt : Date.now(),
    dive_type: input.diveType,
    privacy:   input.privacy === 'private' ? 'private' : 'public',
    observed,
    scuba:     Object.keys(s).length ? s : null,
    photos:    input.photos ?? [],
    notes:     input.notes ?? null,
    client_platform:
      Platform.OS === 'ios'     ? 'ios'     :
      Platform.OS === 'android' ? 'android' :
      Platform.OS === 'web'     ? 'web'     : 'unknown',
    client_version: '1.0.0',
  };
}

/** List the most recent dive logs for a given user (newest first). */
export async function listDiveLogsForUser(uid: string, max = 50): Promise<DiveLogRecord[]> {
  if (firebaseConfigured && db) {
    const q = query(
      collection(db, 'diveLogs'),
      where('uid', '==', uid),
      orderBy('loggedAt', 'desc'),
      fbLimit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeRecord(d.id, d.data()));
  }
  return readStubQueue().filter((r) => r.uid === uid).slice(0, max);
}

/**
 * List the most recent dive logs at a given spot (newest first). Used
 * by Spot Detail "Friends' Reports" and the Hazards/Forecast tabs to
 * cross-reference user-reported observations against KaiCast's
 * predicted conditions.
 */
export async function listDiveLogsForSpot(spotId: string, max = 50): Promise<DiveLogRecord[]> {
  if (firebaseConfigured && db) {
    const q = query(
      collection(db, 'diveLogs'),
      where('spotId', '==', spotId),
      where('privacy', 'in', ['public', 'friends']),
      orderBy('loggedAt', 'desc'),
      fbLimit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeRecord(d.id, d.data()));
  }
  return readStubQueue().filter((r) => r.spotId === spotId).slice(0, max);
}

function normalizeRecord(id: string, data: any): DiveLogRecord {
  const ts: Timestamp | undefined = data.loggedAt;
  return {
    id,
    uid: data.uid,
    spotId: data.spotId,
    customSpot: data.customSpot ?? undefined,
    diveType: data.diveType,
    groupSize: data.groupSize,
    durationMin: data.durationMin ?? null,
    depthFt: data.depthFt ?? null,
    surface: data.surface,
    current: data.current,
    visibility: data.visibility,
    waterTempF: data.waterTempF ?? null,
    notes: data.notes,
    privacy: data.privacy,
    photos: data.photos ?? [],
    conditionsSnapshot: data.conditionsSnapshot ?? null,
    conditions: data.conditions ?? undefined,
    scuba: data.scuba ?? undefined,
    loggedAt: ts ? ts.toDate() : null,
  };
}

function readStubQueue(): DiveLogRecord[] {
  // AsyncStorage is async — but our public listDiveLogsFor* APIs are
  // also async, so callers handle the Promise. This sync helper is
  // safe because we always await it via the async wrappers above.
  // Falling back to an empty array on parse failure.
  return _readStubSync();
}

let _stubCache: DiveLogRecord[] | null = null;
function _readStubSync(): DiveLogRecord[] {
  if (_stubCache) return _stubCache;
  return [];
}

// Hydrate the in-memory stub cache from AsyncStorage on app boot.
// Called once from the AuthProvider so screens see prior logs after
// a cold start in stub mode.
export async function hydrateStubLogs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STUB_QUEUE_KEY);
    _stubCache = raw ? JSON.parse(raw) : [];
  } catch {
    _stubCache = [];
  }
}
