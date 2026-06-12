// useCharterLog — the data hook backing the Captain's Log screens.
//
// One document per (operatorId, date, vesselId) at
// charter_logs/{logDocId}. Subscribes via onSnapshot so cross-device
// edits (captain on the bridge, manager on shore) converge.
//
// Autosave: every mutation updates local state immediately and queues
// a Firestore write debounced 2 seconds. Multiple rapid mutations
// coalesce — only the final state is written. The pending write is
// also flushed on unmount so closing the screen doesn't lose typing.
//
// Hydration on first open: if the doc doesn't yet exist, we create
// it from the FareHarbor trip stubs + the operator's crew defaults
// passed in by the screen, then start subscribing.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';

import { db, firebaseConfigured, app as firebaseApp } from '@/firebase';
import {
  type CharterLog,
  type CharterLogTrip,
  type CharterLogCrew,
  type CharterLogStatus,
  buildLogIdLabel,
  charterLogDocId,
  emptyAbyssConditions,
  emptyObservedConditions,
  emptyIncident,
} from '@/types/charterLog';

const AUTOSAVE_DEBOUNCE_MS = 2000;

type HydrationSeed = {
  operatorId: string;
  /** uid of the creating member — recorded as the log author. */
  authorId: string;
  vesselId: string;
  vesselName: string;
  captainName: string;
  captainLicense: string;
  harborDeparture: string;
  dailyAlerts: string;
  /** Operating spot for the conditions snapshot (captain's home spot).
   *  null lets the server fall back to the org's first operating spot. */
  primarySpotId: string | null;
  trips: CharterLogTrip[];
  crew: CharterLogCrew[];
};

function totalGuestsOf(trips: CharterLogTrip[]): number {
  // New flow stores guestCount; legacy fhTrips stored passengerCount.
  // Sum whichever is present so the totals stay coherent across both.
  return trips.reduce((acc, t) => acc + (t.guestCount ?? t.passengerCount ?? 0), 0);
}
function incidentsOf(log: CharterLog): number {
  // Day-level incident is the new source of truth. Legacy per-trip
  // incidents still count if no day-level incident was logged — keeps
  // archived rows readable without a migration.
  if (log.incident?.occurred) return 1;
  return (log.trips || []).reduce(
    (acc, t) => acc + (t.incident && t.incident !== 'None' ? 1 : 0),
    0,
  );
}

function buildEmptyLog(dateMs: number, seed: HydrationSeed): CharterLog {
  const trips = seed.trips ?? [];
  return {
    logId: buildLogIdLabel(dateMs, seed.vesselId),
    date: dateMs,
    operatorId: seed.operatorId,
    authorId: seed.authorId,
    authorName: seed.captainName,
    vesselId: seed.vesselId,
    vesselName: seed.vesselName,
    captainName: seed.captainName,
    captainLicense: seed.captainLicense,
    harborDeparture: seed.harborDeparture,
    status: 'draft',
    submittedAt: null,
    trips,
    crew: seed.crew,
    dailyAlerts: seed.dailyAlerts,
    // Snapshot fields — primarySpotId is seeded; conditionsSnapshot is
    // resolved server-side at finalize (generateCaptainsLog), never here.
    primarySpotId: seed.primarySpotId,
    conditionsSnapshot: null,
    zeroTripDay: trips.length === 0,
    // Day-level Phase 1 fields seeded empty — captain fills in.
    conditions: {
      abyss:    emptyAbyssConditions(),
      observed: emptyObservedConditions(),
    },
    dayNotes: '',
    incident: emptyIncident(),
    signOff: null,
    tripCount: trips.length,
    totalGuests: totalGuestsOf(trips),
    totalTrips: trips.length,
    incidents: 0,
  };
}

/**
 * Strip server-owned snapshot fields before a client merge-write.
 *
 * `conditionsSnapshot` (and the `primarySpotId` it's anchored to) are
 * resolved + written server-side at finalize and are immutable / locked
 * in firestore.rules. They're seeded once on create; the debounced
 * autosaves must NOT echo them back — if onSnapshot hasn't yet delivered
 * the server-set snapshot, a stale value would be rejected by the rules
 * and surface as a spurious save error. merge:true leaves the existing
 * server values untouched when the keys are absent.
 */
function toWritablePatch(log: CharterLog): Record<string, unknown> {
  const { conditionsSnapshot: _s, primarySpotId: _p, ...rest } = log;
  return rest;
}

type State = {
  log: CharterLog | null;
  loading: boolean;
  /** True while a debounced write is queued. */
  saving: boolean;
  error: string | null;
};

export function useCharterLog(
  dateMs: number,
  seed: HydrationSeed | null,
): {
  log: CharterLog | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Mutate the in-memory log; triggers a debounced Firestore write. */
  patch: (mutator: (prev: CharterLog) => CharterLog) => void;
  patchTrip: (tripId: string, mutator: (prev: CharterLogTrip) => CharterLogTrip) => void;
  setCrew: (crew: CharterLogCrew[]) => void;
  addManualTrip: (trip: CharterLogTrip) => void;
  removeTrip: (tripId: string) => void;
  /** Flush a queued write immediately and resolve. */
  flush: () => Promise<void>;
  /** Submit the log: status → submitted, generate PDF, return result. */
  /** Submit the log. Returns dark + light HTML URLs from
   *  generateCaptainsLog. `pdfUrl` is kept as an alias of `darkPdfUrl`
   *  for back-compat with screens that haven't moved off it yet. */
  submit: () => Promise<{
    pdfUrl: string | null;
    darkPdfUrl: string | null;
    lightPdfUrl: string | null;
  }>;
} {
  const docIdRef = useRef<string | null>(null);
  const logRef = useRef<CharterLog | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<State>({
    log: null,
    loading: !!seed,
    saving: false,
    error: null,
  });

  // ── Hydrate / subscribe ─────────────────────────────────────────────
  useEffect(() => {
    if (!seed || !firebaseConfigured || !db) {
      setState({ log: null, loading: false, saving: false, error: null });
      return;
    }
    const id = charterLogDocId(seed.operatorId, dateMs, seed.vesselId);
    docIdRef.current = id;
    const ref = doc(db, 'charter_logs', id);

    let cancelled = false;
    (async () => {
      try {
        const initial = await getDoc(ref);
        if (cancelled) return;
        if (!initial.exists()) {
          // First open of the day — seed the doc.
          const seeded = buildEmptyLog(dateMs, seed);
          await setDoc(ref, {
            ...seeded,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load log',
          }));
        }
      }
    })();

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // Doc may not exist yet on first onSnapshot tick — wait for the
          // setDoc above to land. Don't surface "missing" as an error.
          return;
        }
        const next = snap.data() as CharterLog;
        logRef.current = next;
        setState((s) => ({ ...s, log: next, loading: false, error: null }));
      },
      (err) => setState((s) => ({ ...s, loading: false, error: err.message })),
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [seed, dateMs]);

  // ── Debounced writer ────────────────────────────────────────────────
  const scheduleWrite = useCallback(() => {
    if (!firebaseConfigured || !db) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState((s) => ({ ...s, saving: true }));
    timerRef.current = setTimeout(async () => {
      const id = docIdRef.current;
      const next = logRef.current;
      if (!id || !next || !db) {
        setState((s) => ({ ...s, saving: false }));
        return;
      }
      try {
        await setDoc(
          doc(db, 'charter_logs', id),
          { ...toWritablePatch(next), updatedAt: serverTimestamp() },
          { merge: true },
        );
        setState((s) => ({ ...s, saving: false }));
      } catch (err) {
        setState((s) => ({
          ...s,
          saving: false,
          error: err instanceof Error ? err.message : 'Save failed',
        }));
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  // Flush on unmount so a half-typed field never disappears when the
  // screen closes between debounce ticks.
  useEffect(() => {
    return () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const id = docIdRef.current;
      const next = logRef.current;
      if (!id || !next || !db) return;
      void setDoc(
        doc(db, 'charter_logs', id),
        { ...toWritablePatch(next), updatedAt: serverTimestamp() },
        { merge: true },
      );
    };
  }, []);

  // ── Public mutators ─────────────────────────────────────────────────
  const patch = useCallback((mutator: (prev: CharterLog) => CharterLog) => {
    if (!logRef.current) return;
    const next = mutator(logRef.current);
    // Re-derive summary counters so the home screen stays accurate.
    next.tripCount   = next.trips.length;
    next.totalGuests = totalGuestsOf(next.trips);
    next.totalTrips  = next.trips.length;
    next.incidents   = incidentsOf(next);
    next.zeroTripDay = next.trips.length === 0;
    logRef.current = next;
    setState((s) => ({ ...s, log: next }));
    scheduleWrite();
  }, [scheduleWrite]);

  const patchTrip = useCallback(
    (tripId: string, mutator: (prev: CharterLogTrip) => CharterLogTrip) => {
      patch((prev) => ({
        ...prev,
        trips: prev.trips.map((t) => (t.tripId === tripId ? mutator(t) : t)),
      }));
    },
    [patch],
  );

  const setCrew = useCallback(
    (crew: CharterLogCrew[]) => patch((prev) => ({ ...prev, crew })),
    [patch],
  );

  const addManualTrip = useCallback(
    (trip: CharterLogTrip) => patch((prev) => ({ ...prev, trips: [...prev.trips, trip] })),
    [patch],
  );

  const removeTrip = useCallback(
    (tripId: string) =>
      patch((prev) => ({ ...prev, trips: prev.trips.filter((t) => t.tripId !== tripId) })),
    [patch],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const id = docIdRef.current;
    const next = logRef.current;
    if (!id || !next || !db) return;
    setState((s) => ({ ...s, saving: true }));
    await setDoc(
      doc(db, 'charter_logs', id),
      { ...toWritablePatch(next), updatedAt: serverTimestamp() },
      { merge: true },
    );
    setState((s) => ({ ...s, saving: false }));
  }, []);

  const submit = useCallback(async (): Promise<{
    pdfUrl: string | null;
    darkPdfUrl: string | null;
    lightPdfUrl: string | null;
  }> => {
    await flush();
    const id = docIdRef.current;
    const cur = logRef.current;
    if (!id || !cur || !db) return { pdfUrl: null, darkPdfUrl: null, lightPdfUrl: null };
    // Status flip happens server-side so the PDF render sees the final
    // state. Falls back to a local flip if the callable is unavailable.
    let darkPdfUrl: string | null = null;
    let lightPdfUrl: string | null = null;
    if (firebaseApp) {
      try {
        const fns = getFunctions(firebaseApp, 'us-central1');
        const fn = httpsCallable<
          { logDocId: string },
          {
            pdfUrl: string | null;
            darkPdfUrl?: string | null;
            lightPdfUrl?: string | null;
          }
        >(fns, 'generateCaptainsLog');
        const res = await fn({ logDocId: id });
        // darkPdfUrl is the modern key; pdfUrl is the legacy alias.
        darkPdfUrl  = res.data?.darkPdfUrl  ?? res.data?.pdfUrl ?? null;
        lightPdfUrl = res.data?.lightPdfUrl ?? null;
      } catch {
        // The callable will also flip status; if it failed, we still
        // mark locally so the captain can't get stuck.
      }
    }
    const submittedAt = Date.now();
    const next: CharterLog = { ...cur, status: 'submitted' as CharterLogStatus, submittedAt };
    logRef.current = next;
    await setDoc(doc(db, 'charter_logs', id), { status: 'submitted', submittedAt }, { merge: true });
    setState((s) => ({ ...s, log: next }));
    return { pdfUrl: darkPdfUrl, darkPdfUrl, lightPdfUrl };
  }, [flush]);

  return {
    log: state.log,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    patch,
    patchTrip,
    setCrew,
    addManualTrip,
    removeTrip,
    flush,
    submit,
  };
}
