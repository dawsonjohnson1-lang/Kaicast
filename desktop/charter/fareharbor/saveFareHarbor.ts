// Write-side helpers for the FareHarbor surface:
//
//   callValidateFareHarbor   — server-side cred check via callable
//   saveFareHarborConnection — write the integration doc
//   disconnectFareHarbor     — delete the integration doc
//   saveItemEnrichment       — patch one fh_items doc with the
//                              tripType / harborId / boatIds / spots
//                              chosen in the drawer
//
// Rules-side: the security rules in firestore.rules whitelist the
// fields a client can write to integrations/fareharbor; this file
// only writes within that whitelist.

import {
  deleteDoc, doc, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app as firebaseApp, db, firebaseConfigured } from '../../firebase';
import type { FhItemEnrichment } from './types';

// ─── Callable wrapper ───────────────────────────────────────────────

export interface ValidateRequest { shortname: string; userApiKey: string }
export type ValidateResponse =
  | { valid: true; itemCount: number; companyName: string }
  | { valid: false; kind?: string; status?: number; error: string };

/** Pre-flight check the Connection UI calls before saving the
 *  credentials. Wraps the validateFareHarborCredentials callable. */
export async function callValidateFareHarbor(input: ValidateRequest): Promise<ValidateResponse> {
  if (!firebaseApp) {
    return { valid: false, error: 'Firebase not configured in this build.' };
  }
  const fns = getFunctions(firebaseApp, 'us-central1');
  const fn = httpsCallable<ValidateRequest, ValidateResponse>(fns, 'validateFareHarborCredentials');
  try {
    const res = await fn(input);
    return res.data;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { valid: false, kind: e.code ?? 'callable-error', error: e.message ?? String(err) };
  }
}

// ─── Connection persistence ──────────────────────────────────────────

export interface FhConnectionInput {
  shortname: string;
  userApiKey: string;
}

/** Write the integration doc after validation passes. We set
 *  connectedAt to a server timestamp and reset syncStatus to 'pending'
 *  so the UI shows "Sync queued" until the next 30-min run picks it
 *  up. The fields here are deliberately the subset the security
 *  rules allow a client to write — adding any other key would fail
 *  the diff().affectedKeys().hasOnly([...]) check. */
export async function saveFareHarborConnection(
  orgId: string,
  input: FhConnectionInput,
): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  const ref = doc(db, 'charter_accounts', orgId, 'integrations', 'fareharbor');
  await setDoc(ref, {
    shortname: input.shortname.trim(),
    userApiKey: input.userApiKey.trim(),
    connectedAt: serverTimestamp(),
    syncStatus: 'pending',
    errorMsg: null,
  }, { merge: true });
}

export async function disconnectFareHarbor(orgId: string): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  await deleteDoc(doc(db, 'charter_accounts', orgId, 'integrations', 'fareharbor'));
}

// ─── Item enrichment ─────────────────────────────────────────────────

export interface SaveEnrichmentInput extends FhItemEnrichment {
  /** PK of the fh_items doc to patch. */
  fhItemPk: number;
}

/** Patch one fh_items doc with the enrichment fields from the drawer.
 *  `enriched` is computed here: true when tripType + harborId + at
 *  least one boat + at least one spot are all set. The sync function
 *  uses merge:true so this enrichment survives the next sync pass. */
export async function saveItemEnrichment(
  orgId: string,
  input: SaveEnrichmentInput,
): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  const ref = doc(db, 'charter_accounts', orgId, 'fh_items', String(input.fhItemPk));
  const enriched =
    input.tripType != null
    && !!input.harborId
    && input.boatIds.length > 0
    && input.kaicastSpotIds.length > 0;
  await setDoc(ref, {
    tripType:       input.tripType,
    boatIds:        input.boatIds,
    harborId:       input.harborId,
    kaicastSpotIds: input.kaicastSpotIds,
    notes:          input.notes,
    enriched,
  }, { merge: true });
}
