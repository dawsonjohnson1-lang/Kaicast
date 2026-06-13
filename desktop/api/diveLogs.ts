// Dive log persistence (desktop) — mirror of the submit path in
// app/src/api/diveLogs.ts. Routes through the server-side
// `submitDiveLog` callable so the prediction snapshot is resolved
// server-trusted; clients can't write to `diveLogs/` directly (rules
// deny it). Unlike the mobile mirror there is no offline stub queue:
// when Firebase isn't configured we throw so the UI shows an error
// instead of a success screen for a dive that was never saved.

import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { app, db, firebaseConfigured } from '../firebase';

export type SubmitDiveLogResult = {
  logId: string;
  /** 'forecast' (live hourly report) | 'cold_storage' | null (unresolved). */
  snapshotSource: string | null;
  resolvedWithinMin: number | null;
  /** True when this log updated community_overlays/{spotId}. */
  communityOverlayUpdated: boolean;
};

export async function submitDiveLog(
  payload: Record<string, unknown>,
): Promise<SubmitDiveLogResult> {
  if (!firebaseConfigured || !app) {
    throw new Error(
      'this build is not connected to Firebase, so the dive cannot be saved',
    );
  }
  const fn = httpsCallable<Record<string, unknown>, {
    log_id: string;
    snapshot_source: string | null;
    resolved_within_min: number | null;
    community_overlay_updated: boolean;
  }>(
    getFunctions(app, 'us-central1'),
    'submitDiveLog',
  );
  // eslint-disable-next-line no-console
  console.log('[submitDiveLog] calling callable with payload', payload);
  let res;
  try {
    res = await fn(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[submitDiveLog] callable FAILED', err);
    throw err;
  }
  // eslint-disable-next-line no-console
  console.log('[submitDiveLog] callable returned', res.data);
  return {
    logId: res.data.log_id,
    snapshotSource: res.data.snapshot_source ?? null,
    resolvedWithinMin: res.data.resolved_within_min ?? null,
    communityOverlayUpdated: res.data.community_overlay_updated === true,
  };
}

/**
 * Count of all dive logs this user has on KaiCast. Uses the Firestore
 * aggregation endpoint so we never download the docs. Returns null
 * (rather than throwing) when unavailable — callers hide the count
 * instead of showing a made-up number.
 */
export async function countUserDiveLogs(uid: string): Promise<number | null> {
  if (!firebaseConfigured || !db) return null;
  try {
    const snap = await getCountFromServer(
      query(collection(db, 'diveLogs'), where('uid', '==', uid)),
    );
    return snap.data().count;
  } catch {
    return null;
  }
}
