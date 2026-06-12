// useCharterLogs — live subscription to this org's standalone captain's
// logs in the top-level `charter_logs` collection. We filter by
// `operatorId` (a single equality — no composite index needed) and the
// `standalone-v1` schema marker, then sort newest-first client-side so
// the mobile rich-log docs that share the collection don't show here.
// Powers the Archive tab on the Captain's Log screen.

import React from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, firebaseConfigured } from '../firebase';
import type { StandaloneLog } from './standaloneLog';

export type CharterLogsState = {
  logs: StandaloneLog[];
  loading: boolean;
  error: string | null;
};

export function useCharterLogs(orgId: string | null | undefined): CharterLogsState {
  const [state, setState] = React.useState<CharterLogsState>({
    logs: [],
    loading: !!orgId,
    error: null,
  });

  React.useEffect(() => {
    if (!orgId || !db || !firebaseConfigured) {
      setState({ logs: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const unsub = onSnapshot(
      query(collection(db, 'charter_logs'), where('operatorId', '==', orgId)),
      (snap) => {
        const logs = snap.docs
          .filter((d) => (d.data() as Record<string, unknown>).schema === 'standalone-v1')
          .map((d) => logFromDoc(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.date - a.date);
        setState({ logs, loading: false, error: null });
      },
      (err) => setState({ logs: [], loading: false, error: err.message }),
    );
    return unsub;
  }, [orgId]);

  return state;
}

function logFromDoc(id: string, data: Record<string, unknown>): StandaloneLog {
  return {
    logId: id,
    operatorId: String(data.operatorId ?? ''),
    schema: 'standalone-v1',
    date: typeof data.date === 'number' ? data.date : 0,
    vesselId: String(data.vesselId ?? ''),
    vesselName: String(data.vesselName ?? ''),
    spotIds: Array.isArray(data.spotIds) ? (data.spotIds as string[]) : [],
    weather: typeof data.weather === 'string' ? data.weather : '',
    seaState: (data.seaState as StandaloneLog['seaState']) ?? '',
    visibilityFt: typeof data.visibilityFt === 'number' ? data.visibilityFt : null,
    windObserved: (data.windObserved as StandaloneLog['windObserved']) ?? '',
    incident: (data.incident as StandaloneLog['incident']) ?? 'none',
    incidentDetail: typeof data.incidentDetail === 'string' ? data.incidentDetail : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    crew: Array.isArray(data.crew) ? (data.crew as StandaloneLog['crew']) : [],
    durationHours: typeof data.durationHours === 'number' ? data.durationHours : null,
    tripCount: typeof data.tripCount === 'number' ? data.tripCount : null,
    trips: Array.isArray(data.trips) ? (data.trips as StandaloneLog['trips']) : [],
    tripId: typeof data.tripId === 'string' && data.tripId.length > 0 ? data.tripId : null,
    primarySpotId: typeof data.primarySpotId === 'string' ? data.primarySpotId : null,
    conditionsSnapshot: (data.conditionsSnapshot as StandaloneLog['conditionsSnapshot']) ?? null,
    zeroTripDay: typeof data.zeroTripDay === 'boolean' ? data.zeroTripDay : undefined,
    filedByUid: String(data.filedByUid ?? ''),
    filedByName: String(data.filedByName ?? ''),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  };
}
