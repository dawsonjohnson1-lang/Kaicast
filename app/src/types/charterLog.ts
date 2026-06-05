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
  | 'sunset'
  | 'whale_watch'
  | 'other';

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

export interface CharterLogTrip {
  /** FareHarbor booking pk, or `manual_{uuid}` for ad-hoc trips. */
  tripId: string;
  /** Display index within the day, 1-based. */
  tripNum: number;
  title: string;
  type: TripType;
  /** HH:MM in HST. */
  departureTime: string;
  returnTime: string;
  passengerCount: number;
  /** KaiCast spot id (primary dive site). */
  primarySite: string;
  secondarySite: string;
  /** Free-text coordinate string for log display, e.g. "21.355,-158.140". */
  coordinates: string;
  maxDepth: string;
  duration: string;
  siteNotes: string;
  /** Original FareHarbor booking id (mirror of tripId when synced). */
  fareharborBookingId: string;
  guests: GuestStatus[];
  abyssConditions: AbyssConditions;
  observedConditions: ObservedConditions;
  speciesObserved: SpeciesObservation[];
  /** 'None' or free-text description. */
  incident: string;
  incidentSeverity?: IncidentSeverity;
  coastGuardNotification: boolean;
  dlnrNotification: boolean;
  insuranceClaim?: boolean;
  equipmentNotes: string;
  /** Captain flips this when the trip section is fully filled in. */
  complete: boolean;
}

export interface CharterLogCrew {
  id: string;
  name: string;
  role: string;
  license: string;
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
  snorkel:     'Snorkel',
  freedive:    'Freedive',
  scuba:       'Scuba',
  sunset:      'Sunset',
  whale_watch: 'Whale watch',
  other:       'Other',
};

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
