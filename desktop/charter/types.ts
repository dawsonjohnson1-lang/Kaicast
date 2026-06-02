// Charter dashboard types — mirrors the Firestore schema documented in
// the original prompt. These types are the single source of truth for
// the shape of every charter doc on both reads (screens) and writes
// (forms / future Cloud Functions). When you change a field here,
// change firestore.rules + any seed scripts in lockstep.
//
// All `Date` fields are deserialized via the FirestoreTimestamp helper
// (charter/serialize.ts) — Firestore returns Timestamp objects, JS
// code wants Date, and the helper handles both forward and back.

export type ConditionTier = 'excellent' | 'good' | 'fair' | 'poor' | 'no-go';

export type TripType = 'dive' | 'snorkel' | 'spearfishing' | 'freedive';

export type TripStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export type CrewRole = 'owner' | 'captain' | 'divemaster' | 'deckhand';

export type CertType = 'USCG' | 'DiveMaster' | 'Instructor' | 'CPR' | 'O2Provider';

export interface Cert {
  type: CertType;
  issuedBy: string;
  expiresAt: Date;
}

export interface Harbor {
  name: string;
  lat: number;
  lng: number;
}

/** charter_accounts/{orgId} */
export interface CharterAccount {
  orgId: string;
  name: string;
  homeHarbor: Harbor;
  tripTypes: TripType[];
  createdAt: Date | null;
}

/** charter_accounts/{orgId}/crew/{crewId} */
export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  certs: Cert[];
  /** Linked KaiCast user account uid, or null if this crew member
   *  doesn't have a consumer app account. */
  uid: string | null;
}

/** charter_accounts/{orgId}/spots/{spotId}
 *
 *  A charter's private spot library entry. `linkedPublicSpotId` is
 *  the join key into the canonical KaiCast spot list (desktop/data/
 *  spots.ts + the live `spots` collection) — when set, the trip
 *  planner pulls forecast conditions from the same kaicast_reports
 *  docs the consumer dashboard reads. */
export interface CharterSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Hidden from any future "share my spot list" feature when true. */
  isPrivate: boolean;
  linkedPublicSpotId: string | null;
  tripTypes: TripType[];
  maxGroupSize: number;
  depthFt: number;
  tidePreference: 'low' | 'high' | 'slack' | 'any';
  notes: string;
  /** Good Window alert — when true, the alerts Cloud Function pushes
   *  a notification whenever this spot's forecast crosses up from
   *  Fair/Poor into Good or better. */
  goodWindowAlertsEnabled?: boolean;
}

export interface ManifestEntry {
  name: string;
  certLevel: string;
  certAgency: string;
  certExpiry: Date;
  /** Last logged dive — used by the form to flag "diver hasn't been
   *  in the water in >6 months → recommend a refresher". */
  lastDiveDate: Date;
  emergencyContact: string;
  /** Free text — DAN form fields, e.g. "diabetic, insulin-controlled". */
  medicalFlags: string;
}

export interface CaptainsLogSurface {
  swellHtActual: number;
  swellDirActual: string;
  windActual: string;
  chopRating: 1 | 2 | 3 | 4 | 5;
  surfaceVisActual: string;
}

export interface CaptainsLogUnderwater {
  visFt: number;
  tempAtDepthF: number;
  thermoclineNoted: boolean;
  thermoclineDepthFt: number | null;
  currentDir: string;
  currentStrength: 'none' | 'mild' | 'moderate' | 'strong';
  surge: boolean;
}

export interface CaptainsLogSpotNote {
  spotId: string;
  entryDifficulty: 'easy' | 'moderate' | 'difficult';
  /** Free text — captures things the marine-life chip set doesn't:
   *  "manta in shallows, 1.5m wingspan; pod of 6 spinner dolphins at
   *  start of dive". */
  marineLifeHighlights: string;
  hazardsNoted: string;
  wouldReturn: boolean;
}

export interface CaptainsLog {
  surfaceConditions: CaptainsLogSurface;
  underwaterConditions: CaptainsLogUnderwater;
  spotNotes: CaptainsLogSpotNote[];
  forecastAccuracy: 'matched' | 'better' | 'worse';
  freeText: string;
  /** Dive boats only — null for snorkel/freedive/spearfishing trips. */
  customerSatisfaction: 1 | 2 | 3 | 4 | 5 | null;
  incidentFlag: 'none' | 'minor' | 'serious';
  mediaUrls: string[];
}

/** charter_accounts/{orgId}/trips/{tripId} */
export interface Trip {
  id: string;
  date: Date;
  departureTime: string; // 'HH:mm' local
  returnTime: string;
  departureHarbor: Harbor;
  /** Ordered list of spot ids — multi-stop trips supported. Each entry
   *  is a CharterSpot.id from the same org's spots subcollection. */
  spots: string[];
  /** CrewMember.id references — strings, not refs, so denormalization
   *  later (e.g. showing crew avatars on a trip card) is a one-shot
   *  lookup rather than a join. */
  crew: string[];
  headcount: number;
  tripType: TripType;
  status: TripStatus;
  /** Only populated when tripType === 'dive'. Empty array otherwise. */
  manifest: ManifestEntry[];
  floatPlanFiled: boolean;
  /** Random ~30-char token. When present, /charter/brief/:tripId?t=…
   *  renders the read-only briefing publicly. Null to revoke. */
  briefingShareToken: string | null;
  /** Snapshot of pipeline conditions at trip creation time (NOT at log
   *  filing time) so the forecast-vs-reality delta is honest about
   *  what was predicted at the time the captain committed. */
  conditionsSnapshot: Record<string, unknown> | null;
  captainsLog: CaptainsLog | null;
}

// ─── Hazard types for the home page's hazard strip ────────────────────

export type HazardKind =
  | 'box-jelly'        // moon-phase derived
  | 'nws-marine'       // National Weather Service marine alert
  | 'doh-runoff'       // Department of Health brown-water advisory
  | 'shark'            // shark report from the agency feed
  | 'vog';             // air-quality (volcanic smog index)

export interface HazardChip {
  kind: HazardKind;
  label: string;
  /** Short detail shown when the chip expands. */
  detail: string;
  severity: 'info' | 'warn' | 'danger';
}
