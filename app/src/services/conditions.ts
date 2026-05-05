// Real-time subscribers over /spots_latest, /kaicast_reports, /spots,
// /community_reports, /condition_alerts, /meta/best_conditions.
//
// All `subscribeX` helpers return an unsubscribe function. If Firestore
// isn't configured (no Firebase web config), the helpers no-op and call
// the callback with `null` so screens can render their mock fallback.

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';

import { getDb } from './firebase';
import type {
  CommunityReport,
  ConditionAlertDoc,
  SpotDoc,
  SpotReportDoc,
} from '@/types/report';

const noop: Unsubscribe = () => undefined;

// ── Spot reports ─────────────────────────────────────────────────────────────

export function subscribeToSpotReport(
  spotId: string,
  cb: (r: SpotReportDoc | null) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    cb(null);
    return noop;
  }
  return onSnapshot(
    doc(db, 'spots_latest', spotId),
    (snap) => cb(snap.exists() ? (snap.data() as SpotReportDoc) : null),
    () => cb(null),
  );
}

export function subscribeToAllSpotReports(
  cb: (reports: SpotReportDoc[]) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    cb([]);
    return noop;
  }
  return onSnapshot(
    query(collection(db, 'spots_latest'), orderBy('generatedAt', 'desc'), limit(50)),
    (snap) => cb(snap.docs.map((d) => d.data() as SpotReportDoc)),
    () => cb([]),
  );
}

// ── Best conditions (homepage hero) ──────────────────────────────────────────

export type BestConditionsDoc = {
  generatedAt: string;
  top: Array<{
    spot: string;
    spotName: string;
    spotLat: number;
    spotLon: number;
    visibilityFeet: number | null;
    windKts: number | null;
    airTempC: number | null;
    waveHeightM: number | null;
    rating: string | null;
    score: number | null;
    generatedAt: string;
  }>;
};

export function subscribeToBestConditions(
  cb: (doc: BestConditionsDoc | null) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    cb(null);
    return noop;
  }
  return onSnapshot(
    doc(db, 'meta', 'best_conditions'),
    (snap) => cb(snap.exists() ? (snap.data() as BestConditionsDoc) : null),
    () => cb(null),
  );
}

// ── Static spot metadata ─────────────────────────────────────────────────────

export function subscribeToSpot(
  spotId: string,
  cb: (s: SpotDoc | null) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    cb(null);
    return noop;
  }
  return onSnapshot(
    doc(db, 'spots', spotId),
    (snap) => cb(snap.exists() ? (snap.data() as SpotDoc) : null),
    () => cb(null),
  );
}

// ── Community reports ────────────────────────────────────────────────────────

export function subscribeToCommunityReports(
  spotId: string | null,
  cb: (reports: CommunityReport[]) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    cb([]);
    return noop;
  }
  const baseRef = collection(db, 'community_reports');
  const q = spotId
    ? query(baseRef, where('spotId', '==', spotId), orderBy('loggedAt', 'desc'), limit(20))
    : query(baseRef, orderBy('loggedAt', 'desc'), limit(20));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CommunityReport) }))),
    () => cb([]),
  );
}

// ── Condition alerts ─────────────────────────────────────────────────────────

export function subscribeToAlerts(
  spotId: string | null,
  cb: (alerts: ConditionAlertDoc[]) => void,
): Unsubscribe {
  const db = getDb();
  if (!db) {
    cb([]);
    return noop;
  }
  const baseRef = collection(db, 'condition_alerts');
  const q = spotId
    ? query(baseRef, where('spotId', '==', spotId), orderBy('generatedAt', 'desc'), limit(10))
    : query(baseRef, orderBy('generatedAt', 'desc'), limit(20));
  return onSnapshot(
    q,
    (snap) => {
      const nowIso = new Date().toISOString();
      const fresh = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as ConditionAlertDoc) }))
        .filter((a) => !a.expiresAt || a.expiresAt > nowIso);
      cb(fresh);
    },
    () => cb([]),
  );
}
