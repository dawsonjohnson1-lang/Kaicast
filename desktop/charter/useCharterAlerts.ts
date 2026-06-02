// useCharterAlerts — live subscription to
// charter_accounts/{orgId}/alerts/{alertId}, ordered newest first.
// Only the charterGoodWindowAlerter Cloud Function writes here; the
// dashboard reads + flips the `read` field via markAlertRead().

import React from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { CharterAlert } from './types';

export type CharterAlertsState = {
  alerts: CharterAlert[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
};

export function useCharterAlerts(orgId: string | null | undefined): CharterAlertsState {
  const [state, setState] = React.useState<CharterAlertsState>({
    alerts: [], unreadCount: 0, loading: !!orgId, error: null,
  });
  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ alerts: [], unreadCount: 0, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      query(
        collection(db, 'charter_accounts', orgId, 'alerts'),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        const alerts = snap.docs.map((d) => parseAlert(d.id, d.data() as Record<string, unknown>));
        const unreadCount = alerts.filter((a) => !a.read).length;
        setState({ alerts, unreadCount, loading: false, error: null });
      },
      (err) => setState({ alerts: [], unreadCount: 0, loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);
  return state;
}

export async function markAlertRead(orgId: string, alertId: string): Promise<void> {
  if (!db || !firebaseConfigured) throw new Error('Firebase not configured');
  const ref = doc(db, 'charter_accounts', orgId, 'alerts', alertId);
  await updateDoc(ref, { read: true, readAt: serverTimestamp() });
}

function parseAlert(id: string, data: Record<string, unknown>): CharterAlert {
  const createdRaw = data.createdAt as { toDate?: () => Date } | undefined;
  const readAtRaw  = data.readAt    as { toDate?: () => Date } | undefined;
  return {
    id,
    kind: data.kind === 'good-window' ? 'good-window' : 'good-window',
    charterSpotId:   String(data.charterSpotId ?? ''),
    charterSpotName: String(data.charterSpotName ?? '—'),
    publicSpotId:    String(data.publicSpotId ?? ''),
    previousTier:    prevTier(data.previousTier),
    newTier:         newTier(data.newTier),
    createdAt:       createdRaw?.toDate?.() ?? null,
    read:            data.read === true,
    readAt:          readAtRaw?.toDate?.() ?? null,
  };
}

function prevTier(v: unknown): CharterAlert['previousTier'] {
  if (v === 'fair' || v === 'no-go') return v;
  return 'unknown';
}
function newTier(v: unknown): CharterAlert['newTier'] {
  if (v === 'excellent' || v === 'great' || v === 'good') return v;
  return 'good';
}
