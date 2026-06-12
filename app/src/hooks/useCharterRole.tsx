// useCharterRole — returns the signed-in user's charter role + their
// vessel + crew + trips.
//
// Stage 1 (current): returns mock data so the UI can be built and
// previewed in the simulator. The mutable role lives in
// CharterRoleContext so the dev role-switcher in CharterDashboard
// propagates to other screens (e.g. DailyLogScreen reads it to gate
// the read-only banner). Without the provider every consumer would
// have its own useState — flipping the switcher in one screen would
// silently no-op everywhere else.
//
// Stage 2 (TODO): replace mock data with Firestore reads:
//   /charter_vessels/{vesselId}
//   /charter_vessels/{vesselId}/crew/{userId}  ← carries role
//   /charter_trips where vesselId == vessel.id
// Plus an onSnapshot subscription on each so connection-state pings
// from the boat's mesh propagate within seconds. The context wrapper
// stays — Stage 2 just swaps the provider's internals from useState
// to onSnapshot subscriptions.

import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  type CharterRole,
  type CrewMember,
  type Trip,
  type Vessel,
} from '@/types/charter';

// ─── Mock data ───────────────────────────────────────────────────────────

const MOCK_CREW: CrewMember[] = [
  {
    id: 'u_kai',
    name: 'Kai Miyamoto',
    role: 'captain',
    connectionState: 'connected',
    lastSeen: new Date(),
    certificationLevel: 'PADI Master Scuba Diver Trainer',
  },
  {
    id: 'u_leilani',
    name: 'Leilani Souza',
    role: 'crew',
    connectionState: 'connected',
    lastSeen: new Date(),
    certificationLevel: 'PADI Divemaster',
  },
  {
    id: 'u_marcus',
    name: 'Marcus Heller',
    role: 'crew',
    connectionState: 'on_app',
    lastSeen: new Date(Date.now() - 14 * 60 * 1000),
    certificationLevel: 'PADI Rescue Diver',
  },
  {
    id: 'u_nora',
    name: 'Nora Aspinall',
    role: 'crew',
    connectionState: 'offline',
    lastSeen: new Date(Date.now() - 3 * 3600 * 1000),
    certificationLevel: 'PADI AOW',
  },
  {
    id: 'u_dani',
    name: 'Dani Park',
    role: 'manager',
    connectionState: 'on_app',
    lastSeen: new Date(Date.now() - 4 * 60 * 1000),
  },
];

const MOCK_VESSEL: Vessel = {
  id: 'v_hana_kai_ii',
  name: 'Hana Kai II',
  homePort: 'Lahaina Harbor, Maui',
  captainId: 'u_kai',
  crew: MOCK_CREW,
  // Stage 2 (real Firestore fleet) will carry the owner-set vesselType.
  // Until then the mock is a purpose-built dive platform so the two-day
  // forecast renders a real vessel-sensitive read instead of the
  // "set vessel type" prompt.
  vesselType: 'dive_boat',
};

function inHours(h: number): Date {
  return new Date(Date.now() + h * 3600 * 1000);
}
function inDays(d: number): Date {
  return new Date(Date.now() + d * 24 * 3600 * 1000);
}

const MOCK_TRIPS: Trip[] = [
  {
    id: 't_today_am',
    date: inHours(2),
    spotId: 'molokini-crater',
    spotName: 'Molokini Crater',
    conditionScore: 84,
    conditionLabel: 'excellent',
    guestCount: 12,
    status: 'scheduled',
    captainId: 'u_kai',
    crewIds: ['u_leilani', 'u_marcus'],
    notes: '2-tank charter. Manta sighting requested.',
  },
  {
    id: 't_today_pm',
    date: inHours(6),
    spotId: 'wailea-point-ulua-beach',
    spotName: 'Wailea Point / Ulua Beach',
    conditionScore: 68,
    conditionLabel: 'good',
    guestCount: 8,
    status: 'scheduled',
    captainId: 'u_kai',
    crewIds: ['u_leilani'],
  },
  {
    id: 't_tomorrow',
    date: inDays(1),
    spotId: 'honolua-bay',
    spotName: 'Honolua Bay',
    conditionScore: 52,
    conditionLabel: 'fair',
    guestCount: 6,
    status: 'scheduled',
    captainId: 'u_kai',
    crewIds: ['u_marcus', 'u_nora'],
  },
  {
    id: 't_d3',
    date: inDays(3),
    spotId: 'black-rock-kaanapali',
    spotName: 'Black Rock (Kaanapali)',
    conditionScore: 32,
    conditionLabel: 'poor',
    guestCount: 10,
    status: 'scheduled',
    captainId: 'u_kai',
    crewIds: ['u_leilani', 'u_marcus'],
  },
  {
    id: 't_d5',
    date: inDays(5),
    spotId: 'molokini-crater',
    spotName: 'Molokini Crater',
    conditionScore: 78,
    conditionLabel: 'excellent',
    guestCount: 14,
    status: 'scheduled',
    captainId: 'u_kai',
    crewIds: ['u_leilani', 'u_marcus', 'u_nora'],
  },
];

// ─── Context + provider ─────────────────────────────────────────────────

// Only the mutable role lives in the context value — the mock vessel /
// crew / trips are frozen constants that don't need to be re-rendered
// from. Keeping the value narrow means setRole stays the only
// invalidation source. Stage 2 will broaden this to carry the live
// Firestore data, at which point the provider becomes the snapshot
// subscriber.
type CharterRoleContextValue = {
  role: CharterRole;
  setRole: (r: CharterRole) => void;
};

const CharterRoleContext = createContext<CharterRoleContextValue | null>(null);

export function CharterRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<CharterRole>('captain');
  const value = useMemo<CharterRoleContextValue>(() => ({ role, setRole }), [role]);
  return (
    <CharterRoleContext.Provider value={value}>
      {children}
    </CharterRoleContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────

export type CharterRoleState = {
  role: CharterRole;
  vessel: Vessel;
  crew: CrewMember[];
  trips: Trip[];
  /** Dev override — lets the role-switcher in CharterDashboard cycle. */
  setRole: (r: CharterRole) => void;
};

export function useCharterRole(): CharterRoleState {
  const ctx = useContext(CharterRoleContext);
  if (!ctx) {
    throw new Error(
      'useCharterRole must be used inside <CharterRoleProvider>. Mount the provider around the main-phase navigator.',
    );
  }
  return {
    role: ctx.role,
    setRole: ctx.setRole,
    vessel: MOCK_VESSEL,
    crew: MOCK_CREW,
    trips: MOCK_TRIPS,
  };
}
