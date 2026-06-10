// Charter subscription tier — shared types across role dashboards.
//
// Mirrors the spec the team agreed on for the charter feature. When
// the Firestore-backed data model lands (currently `useCharterRole`
// returns mocks), the same shape should round-trip through Firestore
// without remapping.

export type CharterRole = 'owner' | 'captain' | 'manager' | 'crew';

/**
 * `connected` — at the vessel, joined the boat's bluetooth/wifi mesh.
 * `on_app`   — opened KaiCast remotely (data over cell/wifi from shore).
 * `offline`  — dark (no recent ping; last_seen carries the timestamp).
 */
export type ConnectionState = 'connected' | 'on_app' | 'offline';

export type TripConditionLabel =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'no_go';

export type TripStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface CrewMember {
  id: string;
  name: string;
  role: CharterRole;
  avatarUrl?: string;
  connectionState: ConnectionState;
  lastSeen?: Date;
  /** e.g. "PADI Divemaster" — shown in Manager's crew list. */
  certificationLevel?: string;
}

// Vessel hull-behavior profile — drives the seasickness modifier + the
// max-operable thresholds in @/charter/vesselFactors. Mirrors the
// desktop VesselType (desktop/charter/types.ts): nine canonical classes
// plus legacy values folded by normalizeVesselType().
export type VesselType =
  | 'catamaran'
  | 'sailing_catamaran'
  | 'monohull'
  | 'sailing_monohull'
  | 'adventure_small'
  | 'sportfishing'
  | 'dive_boat'
  | 'pontoon'
  | 'fishing_rib'
  // legacy
  | 'mono_sail'
  | 'center_console'
  | 'rib_inflatable'
  | 'cabin_cruiser'
  | 'other';

export interface Vessel {
  id: string;
  name: string;         // "Hana Kai II"
  homePort: string;     // "Lahaina Harbor, Maui"
  captainId: string;
  crew: CrewMember[];
  /** Hull behavior class — null/undefined on legacy mock vessels until
   *  the org owner sets it. The dashboard prompts rather than guessing. */
  vesselType?: VesselType;
}

export interface Trip {
  id: string;
  date: Date;
  spotId: string;
  spotName: string;
  conditionScore: number;             // 0–100
  conditionLabel: TripConditionLabel;
  guestCount: number;
  status: TripStatus;
  captainId: string;
  crewIds: string[];
  notes?: string;
}

// ─── Permission matrix ───────────────────────────────────────────────────
// Mirrors the table in the spec. Functions accept the viewer's role and
// return a boolean — gate UI on these so the rules live in one place.

export const CHARTER_PERMS = {
  viewAllTrips:        (r: CharterRole) => r !== 'crew',
  viewOwnTripsOnly:    (r: CharterRole) => r === 'crew',
  createOrEditTrips:   (r: CharterRole) => r === 'owner' || r === 'manager' || r === 'captain',
  /** Create or submit a captain's daily log. Managers and crew get
   *  read-only access — the day-of record belongs to whoever ran the
   *  trips, not back-office or deckhands. */
  createDailyLog:      (r: CharterRole) => r === 'owner' || r === 'captain',
  cancelTrips:         (r: CharterRole) => r === 'owner' || r === 'manager',
  manageCrewRoster:    (r: CharterRole) => r === 'owner' || r === 'manager',
  viewCrewConnection:  (r: CharterRole) => r !== 'crew',
  assignCaptain:       (r: CharterRole) => r === 'owner' || r === 'manager',
  viewBilling:         (r: CharterRole) => r === 'owner',
  fileConditionReport: (_r: CharterRole) => true,
  viewHazardAlerts:    (_r: CharterRole) => true,
  editVesselProfile:   (r: CharterRole) => r === 'owner',
} as const;

// ─── Captain's-log permission ────────────────────────────────────────
//
// Filling out / submitting a captain's log is gated on a license, NOT a
// role: the org owner can always file, and anyone else (captain,
// manager, crew, deckhand) can file ONLY if they have a captain's
// license number recorded on their account. Mirrored server-side in
// firestore.rules (hasCaptainsLicense) so UI hiding isn't the only gate.

/** True when the user has a non-empty captain's license on file. */
export function hasCaptainsLicense(license: string | null | undefined): boolean {
  return typeof license === 'string' && license.trim().length > 0;
}

/** canFillCaptainLog = owner OR has a captain's license. */
export function canFillCaptainLog(
  role: CharterRole,
  license: string | null | undefined,
): boolean {
  return role === 'owner' || hasCaptainsLicense(license);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Map a charter trip's conditionLabel to the app's existing RatingTier
 * so it inherits the same color treatment used everywhere else
 * (ConditionPill, day cards, map markers).
 *
 *   excellent → excellent (blue)
 *   good      → great     (green)
 *   fair      → good      (yellow)
 *   poor      → fair      (orange)
 *   no_go     → no-go     (red)
 */
import type { RatingTier } from '@/theme/ratingColors';

export const TRIP_CONDITION_TO_TIER: Record<TripConditionLabel, RatingTier> = {
  excellent: 'excellent',
  good:      'great',
  fair:      'good',
  poor:      'fair',
  no_go:     'no-go',
};

export const TRIP_CONDITION_LABEL: Record<TripConditionLabel, string> = {
  excellent: 'Excellent',
  good:      'Good',
  fair:      'Fair',
  poor:      'Poor',
  no_go:     'No-Go',
};

export const ROLE_LABEL: Record<CharterRole, string> = {
  owner:   'OWNER',
  captain: 'CAPTAIN',
  manager: 'MANAGER',
  crew:    'CREW',
};

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: 'Connected',
  on_app:    'On the App',
  offline:   'Offline',
};
