// Onboarding persistence — writes the full operations profile to
// charter_accounts/{orgId} in one upsert. The wizard saves on Launch
// only (no partial saves between steps for v1; if the captain
// abandons we just discard).
//
// IDs (vesselId, harborId, profileId) are generated client-side from
// crypto.randomUUID-style entropy. Stable across renders so cross-
// references between vessels ↔ harbors ↔ operations profiles survive.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type {
  CharterAccount, OperationsProfile, OrgHarbor, Vessel,
} from './types';

/** Full onboarding payload — every field that the 5-step wizard
 *  produces. */
export interface OnboardingInput {
  name: string;
  contactEmail: string;
  contactPhone: string;
  description: string | null;
  fleet: Vessel[];
  harbors: OrgHarbor[];
  operationsProfile: OperationsProfile[];
}

/** Set `setupComplete: true` on the charter_accounts doc and persist
 *  the full onboarding payload. Idempotent — uses setDoc with merge.
 *  Also writes back a v1-compat `homeHarbor` synthesized from the
 *  first home/both harbor so the existing CreateTripWizard's "Use org
 *  home harbor" button keeps working until that flow is rewritten to
 *  read from the harbors array. */
export async function saveOnboarding(orgId: string, input: OnboardingInput): Promise<void> {
  if (!db || !firebaseConfigured) {
    throw new Error('Firebase not configured');
  }
  const ref = doc(db, 'charter_accounts', orgId);

  // Pick the first home/both harbor as the legacy homeHarbor — the
  // trip-create wizard reads this field for its "Use org home harbor"
  // one-tap fill until it's rewritten to read from harbors[].
  const homeHarborCandidate =
    input.harbors.find((h) => h.role === 'home' || h.role === 'both') ??
    input.harbors[0] ??
    null;
  const legacyHomeHarbor = homeHarborCandidate
    ? { name: homeHarborCandidate.name, lat: homeHarborCandidate.lat, lng: homeHarborCandidate.lng }
    : { name: '', lat: 0, lng: 0 };

  // Distinct trip-type set derived from operationsProfile — keeps the
  // legacy tripTypes field useful for any code that still reads it.
  const legacyTripTypesSet = new Set<string>();
  for (const p of input.operationsProfile) {
    legacyTripTypesSet.add(
      p.tripType === 'dive_charter' ? 'dive' :
      p.tripType === 'freedive'    ? 'freedive' :
      p.tripType === 'snorkel'     ? 'snorkel' :
      p.tripType === 'spearfishing' ? 'spearfishing' :
      'dive',
    );
  }

  const payload: Partial<CharterAccount> & Record<string, unknown> = {
    name: input.name,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    description: input.description,
    fleet: input.fleet,
    harbors: input.harbors,
    operationsProfile: input.operationsProfile,
    setupComplete: true,
    // v1 back-compat
    homeHarbor: legacyHomeHarbor,
    tripTypes: Array.from(legacyTripTypesSet) as CharterAccount['tripTypes'],
    updatedAt: serverTimestamp() as unknown as Date,
  };

  await setDoc(ref, payload, { merge: true });
}

// ─── ID generators ──────────────────────────────────────────────────

const RAND_ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';

function shortId(prefix: string): string {
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (const b of bytes) rand += RAND_ALPHA[b % RAND_ALPHA.length];
  } else {
    while (rand.length < 12) rand += Math.random().toString(36).slice(2);
    rand = rand.slice(0, 12);
  }
  return `${prefix}_${rand}`;
}

export const newVesselId  = (): string => shortId('vsl');
export const newHarborId  = (): string => shortId('hrb');
export const newProfileId = (): string => shortId('prf');

// ─── Per-section partial save helpers ───────────────────────────────
//
// Used by the /charter/settings tabbed editor — each tab's Save
// button persists ONLY its slice of charter_accounts/{orgId} via
// setDoc({merge:true}). setupComplete is intentionally NOT touched
// here (the wizard's "Launch" is the only thing that flips that).
// Every helper updates the same `updatedAt` server timestamp so the
// settings screen can show "saved 5s ago".

export interface OrgBasicsPatch {
  name: string;
  contactEmail: string;
  contactPhone: string;
  description: string | null;
}

export async function updateOrgBasics(orgId: string, patch: OrgBasicsPatch): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  await setDoc(
    doc(db, 'charter_accounts', orgId),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateOrgFleet(orgId: string, fleet: Vessel[]): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  await setDoc(
    doc(db, 'charter_accounts', orgId),
    { fleet, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateOrgHarbors(orgId: string, harbors: OrgHarbor[]): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  // Keep the legacy single-field homeHarbor in sync — the trip-create
  // wizard still reads it for its "Use org home harbor" one-tap fill.
  const homeCandidate = harbors.find((h) => h.role === 'home' || h.role === 'both') ?? harbors[0];
  const legacy = homeCandidate
    ? { name: homeCandidate.name, lat: homeCandidate.lat, lng: homeCandidate.lng }
    : { name: '', lat: 0, lng: 0 };
  await setDoc(
    doc(db, 'charter_accounts', orgId),
    { harbors, homeHarbor: legacy, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateOrgOperations(orgId: string, operationsProfile: OperationsProfile[]): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  // Mirror operationsProfile.tripType[] into the legacy tripTypes
  // string array so any code still reading that field gets the same
  // set the operationsProfile expresses.
  const legacyTripTypesSet = new Set<string>();
  for (const p of operationsProfile) {
    legacyTripTypesSet.add(
      p.tripType === 'dive_charter' ? 'dive' :
      p.tripType === 'freedive'    ? 'freedive' :
      p.tripType === 'snorkel'     ? 'snorkel' :
      p.tripType === 'spearfishing' ? 'spearfishing' :
      'dive',
    );
  }
  await setDoc(
    doc(db, 'charter_accounts', orgId),
    {
      operationsProfile,
      tripTypes: Array.from(legacyTripTypesSet),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
