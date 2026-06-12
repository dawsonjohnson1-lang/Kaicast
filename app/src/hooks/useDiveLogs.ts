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
      // The submitDiveLog callable writes snake_case docs ordered by
      // logged_at; pre-path-B client writes used camelCase loggedAt.
      // orderBy silently drops docs missing its field, so a single
      // query can only ever see one generation — subscribe to both
      // shapes and merge until the legacy docs are migrated.
      const col = collection(db, 'diveLogs');
      const queries = [
        query(col, where('uid', '==', uid), orderBy('logged_at', 'desc'), fbLimit(max)),
        query(col, where('uid', '==', uid), orderBy('loggedAt', 'desc'), fbLimit(max)),
      ];
      const buckets: DiveLogRecord[][] = [[], []];
      const publish = () => {
        const seen = new Set<string>();
        const merged = buckets
          .flat()
          .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
          .sort((a, b) => (b.loggedAt?.getTime() ?? 0) - (a.loggedAt?.getTime() ?? 0))
          .slice(0, max);
        setState({ logs: merged, loading: false });
      };
      const unsubs = queries.map((q, i) =>
        onSnapshot(
          q,
          (snap) => {
            buckets[i] = snap.docs.map((d) => normalize(d.id, d.data()));
            publish();
          },
          () => {
            buckets[i] = [];
            publish();
          },
        ),
      );
      return () => unsubs.forEach((u) => u());
    }
    // Stub fallback.
    listDiveLogsForUser(uid, max).then((logs) => setState({ logs, loading: false }));
  }, [uid, max]);

  return state;
}

/**
 * Live dive-log subscription scoped to a set of author UIDs (typically
 * the people the viewer follows). Returns an empty list when no
 * followed UIDs are passed — the home feed shows an empty state in
 * that case rather than falling back to mock data.
 *
 * Firestore's `in` operator caps at 30 values, so we slice the
 * followed list when needed; the older entries are dropped, which
 * matches the "newest reports first" UX the home feed wants anyway.
 */
export function useFriendsDiveLogs(authorUids: string[], max = 30): State {
  // Memoize the input key so the effect re-subscribes only when the
  // actual set of UIDs changes, not on every render.
  const key = authorUids.slice().sort().join('|');
  const [state, setState] = useState<State>({ logs: [], loading: authorUids.length > 0 });

  useEffect(() => {
    if (!authorUids.length) {
      setState({ logs: [], loading: false });
      return;
    }
    if (!(firebaseConfigured && db)) {
      setState({ logs: [], loading: false });
      return;
    }
    const slice = authorUids.slice(0, 30);
    const q = query(
      collection(db, 'diveLogs'),
      where('uid', 'in', slice),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, max]);

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

// Server (snake_case) → legacy card vocab. surface_state and
// water_color are the structured fields; the cards still speak
// safe/choppy/rough and clean/green/murky.
const SURFACE_FROM_STATE: Record<string, string> = {
  glassy: 'safe', light_chop: 'choppy', whitecaps: 'rough', breaking: 'rough',
};
const VIS_FROM_COLOR: Record<string, string> = {
  blue: 'clean', green: 'green', brown: 'murky', silty: 'murky',
};

function normalize(id: string, data: any): DiveLogRecord {
  if (data.spot_id != null) {
    // Path-B doc written by the submitDiveLog callable.
    const o = data.observed ?? {};
    return {
      id,
      uid: data.uid,
      spotId: data.spot_id,
      customSpot: data.custom_spot ?? undefined,
      diveType: data.dive_type,
      groupSize: data.group_size ?? undefined,
      durationMin: o.duration_min ?? null,
      depthFt: o.max_depth_ft ?? null,
      surface: SURFACE_FROM_STATE[o.surface_state] ?? undefined,
      current: o.current_strength ?? undefined,
      visibility: VIS_FROM_COLOR[o.water_color] ?? undefined,
      waterTempF: o.water_temp_surface_f ?? o.water_temp_bottom_f ?? null,
      notes: data.notes ?? undefined,
      privacy: data.privacy,
      photos: data.photos ?? [],
      conditionsSnapshot: data.conditionsSnapshot ?? null,
      // logged_at is a serverTimestamp — null on the local latency
      // snapshot until the write commits; dive_at stands in.
      loggedAt: data.logged_at?.toDate?.() ?? data.dive_at?.toDate?.() ?? null,
    };
  }
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
