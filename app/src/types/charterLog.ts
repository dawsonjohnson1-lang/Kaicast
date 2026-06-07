// Charter Captain's Log — the per-day, per-vessel record of trips run.
// One document per (operatorId, date, vesselId) at
// charter_logs/{orgId}_{YYYY-MM-DD}_{vesselId}. Drafts autosave on
// every field change; submission flips status and triggers the PDF
// render via the generateCaptainsLog callable.

export type CharterLogStatus = 'draft' | 'submitted' | 'archived';

export type TripType =
  | 'snorkel'
  | 'freedive'
  | 'scuba'
  | 'spearfishing'
  | 'fishing'
  | 'private'
  | 'ash_scattering'
  | 'sunset'
  | 'whale_watch'
  | 'other';

/** Where the trip came from. 'fareharbor' = synced from a FareHarbor
 *  booking (Phase 2). 'manual' = captain added the row by hand. Legacy
 *  logs that pre-date the field default to 'manual' on read. */
export type TripSource = 'fareharbor' | 'manual';

export type IncidentSeverity = 'Minor' | 'Major' | 'Critical';

// Read-only block populated from kaicast_reports closest to each
// trip's departure. Captain's observed counterpart lives in
// ObservedConditions below.
export interface AbyssConditions {
  visibility: string;
  waterTemp: string;
  swellHeight: string;
  swellPeriod: string;
  swellDirection: string;
  surfaceCurrent: string;
  currentDirection: string;
  windForecast: string;
  alerts: string;
}

// Captain's-eye view filled in on the right column of the
// side-by-side conditions panel.
export interface ObservedConditions {
  visibility: string;
  feltTemp: string;
  seaState: string;
  swellDirObserved: string;
  windObserved: string;
  currentObserved: string;
  currentDirObserved: string;
  captainNote: string;
}

export interface SpeciesObservation {
  species: string;
  count: number;
}

export interface GuestStatus {
  /** FareHarbor contact id or generated stable id. */
  id: string;
  name: string;
  phone?: string;
  waiverSigned: boolean;
  /** Only relevant when trip.type === 'scuba'. */
  certLevel?: string;
  status: 'checked_in' | 'no_show' | 'pending';
}

/**
 * A single trip row in the lightweight daily log.
 *
 * The standalone (Phase 1) flow only writes `type` (required) plus
 * any of the lightweight optional fields below. All FareHarbor-derived
 * fields (passengerCount, guests[], booking id, abyss/observed
 * conditions per-trip, etc.) are kept on the type as OPTIONAL so the
 * legacy per-trip TripLogScreen + future FareHarbor sync don't break.
 * The Phase 2 work that re-enables FareHarbor can populate them
 * without a migration.
 *
 * `complete` is intentionally kept optional — the new flow no longer
 * gates submit on it, but old saved logs may still carry the field.
 */
export interface CharterLogTrip {
  /** FareHarbor booking pk, or `manual_{uuid}` for ad-hoc trips. */
  tripId: string;
  /** Display index within the day, 1-based. */
  tripNum: number;
  /** Trip type — the ONLY required field in the new lightweight flow. */
  type: TripType;
  /** Where the row came from. Manual rows are captain-entered; the
   *  FareHarbor path is reserved for Phase 2 sync. Legacy rows that
   *  pre-date the field are treated as 'manual' on read. */
  tripSource?: TripSource;
  /** Free-text label used only when type === 'other'. Lets a captain
   *  log a one-off trip type ("Photoshoot charter") without expanding
   *  the enum. Ignored for non-'other' types. */
  tripTypeCustom?: string | null;

  // ── New lightweight fields (Phase 1) ──
  /** Short text — e.g. "3:00 PM Snorkel", "Morning private". Optional. */
  label?: string;
  /** Hours, decimals allowed (2.5 = 2h 30m). Optional. */
  durationHours?: number;
  /** Total guests on this trip. Optional. */
  guestCount?: number;
  /** Free-text notes for the trip. Optional. */
  notes?: string;
  /** Type-conditional, tucked behind the "More" toggle in the trip row:
   *  Free-text species tally — only meaningful for spearfishing + scuba.
   *  e.g. "1 ono, 2 papio" or "3 turtles, 1 whitetip". */
  speciesNotes?: string;
  /** Free-text cert-level summary — only meaningful for scuba.
   *  e.g. "2× OW, 1× AOW, 1× Rescue". */
  certLevelNotes?: string;

  // ── Legacy fields kept optional for Phase 2 (FareHarbor sync) ──
  title?: string;
  /** HH:MM in HST. */
  departureTime?: string;
  returnTime?: string;
  passengerCount?: number;
  /** KaiCast spot id (primary dive site). */
  primarySite?: string;
  secondarySite?: string;
  coordinates?: string;
  maxDepth?: string;
  duration?: string;
  siteNotes?: string;
  /** Original FareHarbor booking id. Empty / unset on Phase 1 manual rows. */
  fareharborBookingId?: string;
  guests?: GuestStatus[];
  /** Per-trip conditions — only populated by legacy TripLogScreen.
   *  The new flow uses day-level CharterLog.conditions instead. */
  abyssConditions?: AbyssConditions;
  observedConditions?: ObservedConditions;
  speciesObserved?: SpeciesObservation[];
  /** Per-trip incident — only populated by legacy TripLogScreen.
   *  The new flow uses day-level CharterLog.incident instead. */
  incident?: string;
  incidentSeverity?: IncidentSeverity;
  coastGuardNotification?: boolean;
  dlnrNotification?: boolean;
  insuranceClaim?: boolean;
  equipmentNotes?: string;
  /** Per-trip "I'm done with this row" flag from the old flow. The
   *  new flow doesn't read it — submission is no longer gated on
   *  every trip being marked complete. */
  complete?: boolean;
}

export interface CharterLogCrew {
  id: string;
  name: string;
  role: string;
  license: string;
}

/** Day-level incident block. Replaces the per-trip incident /
 *  coastGuardNotification / dlnrNotification trio. Captain flips
 *  `occurred`; the rest is only meaningful when it's true. */
export interface CharterLogIncident {
  occurred: boolean;
  summary: string;
  uscgFlag: boolean;
  dlnrFlag: boolean;
}

/** Day-level sign-off. Set when the captain explicitly hits the
 *  "Sign log" button at the bottom of the screen. Submission is no
 *  longer gated on every trip being marked complete — see the spec. */
export interface CharterLogSignOff {
  signedBy: string;   // captain name (display)
  signedAt: number;   // epoch ms
}

export interface CharterLog {
  logId: string;
  date: number;          // epoch ms — start-of-day in HST
  operatorId: string;
  vesselId: string;
  vesselName: string;
  captainName: string;
  captainLicense: string;
  harborDeparture: string;
  status: CharterLogStatus;
  submittedAt: number | null;
  trips: CharterLogTrip[];
  crew: CharterLogCrew[];
  dailyAlerts: string;

  // ── New Phase 1 day-level fields ──
  /** Side-by-side conditions matrix — Abyss auto-fill on the left,
   *  captain-observed on the right. Moved from per-trip to day-level
   *  in the standalone log rework. */
  conditions: {
    abyss: AbyssConditions;
    observed: ObservedConditions;
  };
  /** Free-form notes for the day. Below the trips list. */
  dayNotes: string;
  /** Day-level incident block (occurred toggle + summary + flags). */
  incident: CharterLogIncident;
  /** Captain sign-off — present once the captain explicitly signs. */
  signOff: CharterLogSignOff | null;

  // ── Counters / derived ──
  /** Number of trips logged today — derived from trips.length on save. */
  tripCount: number;
  totalGuests: number;
  totalTrips: number;
  incidents: number;
  updatedAt?: number;
}

// ── Static option banks ─────────────────────────────────────────────

/** Quick-select list for the SpeciesPicker. */
export const COMMON_HAWAII_SPECIES: string[] = [
  'Hawaiian green sea turtle',
  'Hawaiian monk seal',
  'Humpback whale',
  'Whitetip reef shark',
  'Hammerhead shark',
  'Spinner dolphin',
  'Manta ray',
];

export const INCIDENT_TYPES: string[] = [
  'Medical',
  'Equipment failure',
  'Marine life encounter',
  'Lost diver',
  'Vessel issue',
  'Guest behavior',
  'Other',
];

export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  snorkel:        'Snorkel Tour',
  scuba:          'Scuba Dive',
  freedive:       'Freedive',
  spearfishing:   'Spearfishing Charter',
  fishing:        'Fishing Charter',
  private:        'Private Charter',
  ash_scattering: 'Ash Scattering / Memorial',
  sunset:         'Sunset / Sightseeing Cruise',
  whale_watch:    'Whale Watch',
  other:          'Custom',
};

/** Picker order for the new lightweight trip-row Type select.
 *  Edit this list to add/remove options without touching code in
 *  DailyLogScreen. The order here is the order rendered in the chip
 *  list.
 *
 *  Legacy types (e.g. `ash_scattering`) stay in the TripType union and
 *  in TRIP_TYPE_LABEL so old logs render — but are intentionally absent
 *  from the picker. Niche one-offs go through `other` + `tripTypeCustom`. */
export const TRIP_TYPE_OPTIONS: ReadonlyArray<{ id: TripType; label: string }> = [
  { id: 'snorkel',        label: 'Snorkel Tour' },
  { id: 'scuba',          label: 'Scuba Dive' },
  { id: 'freedive',       label: 'Freedive' },
  { id: 'spearfishing',   label: 'Spearfishing Charter' },
  { id: 'fishing',        label: 'Fishing Charter' },
  { id: 'whale_watch',    label: 'Whale Watch' },
  { id: 'sunset',         label: 'Sunset / Sightseeing Cruise' },
  { id: 'private',        label: 'Private Charter' },
  { id: 'other',          label: 'Custom' },
];

// ── Defaults / factories ────────────────────────────────────────────

export function emptyAbyssConditions(): AbyssConditions {
  return {
    visibility: '', waterTemp: '', swellHeight: '', swellPeriod: '',
    swellDirection: '', surfaceCurrent: '', currentDirection: '',
    windForecast: '', alerts: '',
  };
}

export function emptyObservedConditions(): ObservedConditions {
  return {
    visibility: '', feltTemp: '', seaState: '', swellDirObserved: '',
    windObserved: '', currentObserved: '', currentDirObserved: '',
    captainNote: '',
  };
}

export function emptyIncident(): CharterLogIncident {
  return { occurred: false, summary: '', uscgFlag: false, dlnrFlag: false };
}

/** Make a new lightweight trip row for the standalone log flow.
 *  Type is required at the UI level (the spec says it's the ONLY
 *  required field per row), but we seed with a benign default so
 *  the row is in a renderable shape on creation. */
export function emptyLightweightTrip(tripNum: number): CharterLogTrip {
  return {
    tripId: `manual_${Date.now().toString(36)}_${tripNum}`,
    tripNum,
    type: 'snorkel',
    tripSource: 'manual',
    tripTypeCustom: null,
    label: '',
    durationHours: undefined,
    guestCount: undefined,
    notes: '',
  };
}

/** HST date key (YYYY-MM-DD) for an epoch ms. UTC−10, no DST. */
export function hstDateKey(epochMs: number): string {
  const HST_OFFSET_MS = -10 * 60 * 60 * 1000;
  const shifted = new Date(epochMs + HST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Build the canonical doc id: {orgId}_{YYYY-MM-DD}_{vesselId}. */
export function charterLogDocId(
  operatorId: string,
  dateMs: number,
  vesselId: string,
): string {
  return `${operatorId}_${hstDateKey(dateMs)}_${vesselId}`;
}

/** Build the human-facing log id printed at the top of the PDF. */
export function buildLogIdLabel(dateMs: number, vesselId: string): string {
  const HST_OFFSET_MS = -10 * 60 * 60 * 1000;
  const shifted = new Date(dateMs + HST_OFFSET_MS);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `KC-LOG-${yyyy}-${mm}${dd}-${vesselId}`;
}
