// Live dive-log subscriptions.
//
// useUserDiveLogs(uid)    — every log a given user has written.
// useSpotDiveLogs(spotId) — every public/friends log at a given spot.
//
// In Firebase mode both use Firestore `onSnapshot` so the screens
// re-render as soon as a new log lands (e.g. you just submitted one
// from LogDive). In stub mode we one-shot read the AsyncStorage
// queue that submitDiveLog writes to.

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import { listDiveLogsForUser, listDiveLogsForSpot, type DiveLogRecord } from '@/api/diveLogs';
import type { DiveReport, DiveType } from '@/types';

type State = {
  logs: DiveLogRecord[];
  loading: boolean;
};

export function useUserDiveLogs(uid: string | undefined, max = 50): State {
  const [state, setState] = useState<State>({ logs: [], loading: !!uid });

  useEffect(() => {
    if (!uid) {
      setState({ logs: [], loading: false });
      return;
    }
    if (firebaseConfigured && db) {
      const q = query(
        collection(db, 'diveLogs'),
        where('uid', '==', uid),
        orderBy('loggedAt', 'desc'),
        fbLimit(max),
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          setState({
            loading: false,
            logs: snap.docs.map((d) => normalize(d.id, d.data())),
          });
        },
        () => setState({ logs: [], loading: false }),
      );
      return unsub;
    }
    // Stub fallback.
    listDiveLogsForUser(uid, max).then((logs) => setState({ logs, loading: false }));
  }, [uid, max]);

  return state;
}

export function useSpotDiveLogs(spotId: string | undefined, max = 50): State {
  const [state, setState] = useState<State>({ logs: [], loading: !!spotId });

  useEffect(() => {
    if (!spotId) {
      setState({ logs: [], loading: false });
      return;
    }
    if (firebaseConfigured && db) {
      // privacy in ('public','friends') — exclude private logs from
      // the spot-wide "Friends' Reports" feed.
      const q = query(
        collection(db, 'diveLogs'),
        where('spotId', '==', spotId),
        where('privacy', 'in', ['public', 'friends']),
        orderBy('loggedAt', 'desc'),
        fbLimit(max),
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          setState({
            loading: false,
            logs: snap.docs.map((d) => normalize(d.id, d.data())),
          });
        },
        () => setState({ logs: [], loading: false }),
      );
      return unsub;
    }
    listDiveLogsForSpot(spotId, max).then((logs) => setState({ logs, loading: false }));
  }, [spotId, max]);

  return state;
}

function normalize(id: string, data: any): DiveLogRecord {
  const ts = data.loggedAt;
  return {
    id,
    uid: data.uid,
    spotId: data.spotId,
    customSpot: data.customSpot ?? undefined,
    diveType: data.diveType,
    groupSize: data.groupSize,
    durationMin: data.durationMin ?? null,
    depthFt: data.depthFt ?? null,
    surface: data.surface,
    current: data.current,
    visibility: data.visibility,
    waterTempF: data.waterTempF ?? null,
    notes: data.notes,
    privacy: data.privacy,
    photos: data.photos ?? [],
    conditionsSnapshot: data.conditionsSnapshot ?? null,
    loggedAt: ts?.toDate?.() ?? null,
  };
}

/**
 * Adapt a Firestore DiveLogRecord to the DiveReport shape that
 * <DiveReportCard /> consumes. The card pre-dates the structured
 * dive-log schema, so we map fields and pick reasonable defaults
 * for the parts the card expects but our schema doesn't carry yet.
 */
export function diveLogToReport(
  log: DiveLogRecord,
  authorName: string,
  spotName: string,
): DiveReport {
  const initials = authorName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || 'KC';
  const surface = ((log.surface ?? 'SAFE').toUpperCase() as DiveReport['surface']);
  const current = ((log.current ?? 'NONE').toUpperCase() as DiveReport['current']);
  const visibility = ((log.visibility ?? 'CLEAN').toUpperCase() as DiveReport['visibility']);
  // Custom-spot logs win over the caller's spotName so user-typed
  // names show up correctly in feeds even when the caller doesn't
  // know how to resolve the synthetic spotId.
  const resolvedName = log.customSpot?.name ?? spotName;
  return {
    id: log.id,
    authorInitials: initials || 'KC',
    authorName,
    spotName: resolvedName,
    postedAgo: relativeTime(log.loggedAt),
    diveType: (log.diveType as DiveType) ?? 'freedive',
    depthFt: log.depthFt ?? 0,
    current: ['STRONG', 'MODERATE', 'LIGHT', 'NONE'].includes(current) ? current : 'NONE',
    surface: ['SAFE', 'CHOPPY', 'ROUGH'].includes(surface) ? surface : 'SAFE',
    visibility: ['CLEAN', 'MURKY', 'GREEN'].includes(visibility) ? visibility : 'CLEAN',
    comment: log.notes ?? '',
    likes: 0,
    replies: 0,
  };
}

function relativeTime(d: Date | null): string {
  if (!d) return 'just now';
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 4) return `${w}w ago`;
  return d.toLocaleDateString();
}
