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

export interface Vessel {
  id: string;
  name: string;         // "Hana Kai II"
  homePort: string;     // "Lahaina Harbor, Maui"
  captainId: string;
  crew: CrewMember[];
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
  cancelTrips:         (r: CharterRole) => r === 'owner' || r === 'manager',
  manageCrewRoster:    (r: CharterRole) => r === 'owner' || r === 'manager',
  viewCrewConnection:  (r: CharterRole) => r !== 'crew',
  assignCaptain:       (r: CharterRole) => r === 'owner' || r === 'manager',
  viewBilling:         (r: CharterRole) => r === 'owner',
  fileConditionReport: (_r: CharterRole) => true,
  viewHazardAlerts:    (_r: CharterRole) => true,
  editVesselProfile:   (r: CharterRole) => r === 'owner',
} as const;

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
