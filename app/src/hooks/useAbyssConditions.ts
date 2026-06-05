// useAbyssConditions — pull the conditions snapshot closest to a given
// trip's departure time, from kaicast_reports/{spotId}_{hourKey}.
//
// Used by TripLogScreen's ConditionsPanel (left/blue column) to
// auto-fill the read-only Abyss side. Captain edits the right/green
// column manually.
//
// Hour key format: YYYY-MM-DD-HH in HST. We try ±1 hour around the
// requested time and pick whichever doc exists and is closest.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import {
  type AbyssConditions,
  emptyAbyssConditions,
} from '@/types/charterLog';

const HST_OFFSET_MS = -10 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function hourKeyHst(epochMs: number): string {
  const shifted = new Date(epochMs + HST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const h = String(shifted.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

type ReportSnapshot = {
  now?: {
    visibility_ft?: number | string;
    water_temp_f?: number | string;
    swell_height_ft?: number | string;
    swell_period_s?: number | string;
    swell_direction?: string;
    surface_current_kt?: number | string;
    current_direction?: string;
    wind_forecast?: string;
    wind_kt?: number | string;
    wind_direction?: string;
    alerts?: string;
  };
};

/**
 * Map a kaicast_reports doc's `now` block to the log's AbyssConditions
 * shape. We accept either pre-formatted strings or raw numbers and
 * stringify with a sensible unit suffix so the log displays cleanly
 * without each call site re-formatting.
 */
function mapReportToAbyss(data: ReportSnapshot | null): AbyssConditions {
  if (!data?.now) return emptyAbyssConditions();
  const n = data.now;
  const fmt = (v: unknown, unit: string): string => {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return v;
    return `${v} ${unit}`;
  };
  const wind = n.wind_forecast
    ? n.wind_forecast
    : n.wind_kt != null
      ? `${n.wind_kt} kt${n.wind_direction ? ` ${n.wind_direction}` : ''}`
      : '';
  return {
    visibility:       fmt(n.visibility_ft,      'ft'),
    waterTemp:        fmt(n.water_temp_f,       '°F'),
    swellHeight:      fmt(n.swell_height_ft,    'ft'),
    swellPeriod:      fmt(n.swell_period_s,     's'),
    swellDirection:   n.swell_direction ?? '',
    surfaceCurrent:   fmt(n.surface_current_kt, 'kt'),
    currentDirection: n.current_direction ?? '',
    windForecast:     wind,
    alerts:           n.alerts ?? '',
  };
}

type State = {
  conditions: AbyssConditions;
  loading: boolean;
  source: 'live' | 'none';
};

/**
 * Read the conditions block for `spotId` closest to `departureMs`. We
 * probe the exact hour, then -1h, then +1h. Whichever exists wins.
 * If nothing is available the captain still sees the form — they just
 * fill in the observed column from memory.
 */
export function useAbyssConditions(
  spotId: string | undefined,
  departureMs: number | undefined,
): State {
  const [state, setState] = useState<State>({
    conditions: emptyAbyssConditions(),
    loading: !!(spotId && departureMs),
    source: 'none',
  });

  useEffect(() => {
    if (!spotId || !departureMs || !firebaseConfigured || !db) {
      setState({ conditions: emptyAbyssConditions(), loading: false, source: 'none' });
      return;
    }
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      const candidates = [departureMs, departureMs - HOUR_MS, departureMs + HOUR_MS];
      for (const ms of candidates) {
        const key = hourKeyHst(ms);
        try {
          const snap = await getDoc(doc(db!, 'kaicast_reports', `${spotId}_${key}`));
          if (cancelled) return;
          if (snap.exists()) {
            setState({
              conditions: mapReportToAbyss(snap.data() as ReportSnapshot),
              loading: false,
              source: 'live',
            });
            return;
          }
        } catch {
          // try next candidate
        }
      }
      if (!cancelled) {
        setState({ conditions: emptyAbyssConditions(), loading: false, source: 'none' });
      }
    })();
    return () => { cancelled = true; };
  }, [spotId, departureMs]);

  return state;
}
