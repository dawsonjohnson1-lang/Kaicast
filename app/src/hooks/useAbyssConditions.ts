// useAbyssConditions — pull the conditions snapshot closest to a given
// trip's departure time, from kaicast_reports/{spotId}_{hourKey}.
//
// Used by TripLogScreen's ConditionsPanel (left/blue column) to
// auto-fill the read-only Abyss side. Captain edits the right/green
// column manually.
//
// Hour key format: compact YYYYMMDDHH in UTC — must mirror
// buildHourKey() in functions/index.js, which names the docs. We try
// ±1 hour around the requested time and pick whichever doc exists.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db, firebaseConfigured } from '@/firebase';
import {
  type AbyssConditions,
  emptyAbyssConditions,
} from '@/types/charterLog';

const HOUR_MS = 60 * 60 * 1000;

function hourKeyUtc(epochMs: number): string {
  const d = new Date(epochMs);
  return (
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0') +
    String(d.getUTCHours()).padStart(2, '0')
  );
}

// Shape of the fields we read from a kaicast_reports doc's `now`
// block — mirrors what buildSpotReport writes (functions/index.js)
// and what extractPredictionFields reads (functions/snapshotResolver.js).
type ReportSnapshot = {
  now?: {
    metrics?: {
      waterTempC?: number | null;
      waveHeightM?: number | null;
      wavePeriodS?: number | null;
      windSpeedKts?: number | null;
      windDeg?: number | null;
    } | null;
    visibility?: {
      estimatedVisibilityFeet?: number | null;
      estimatedVisibilityMeters?: number | null;
      exposure?: { swellFromDeg?: number | null } | null;
    } | null;
  } | null;
};

const M_TO_FT = 3.28084;

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

function degToCompass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/**
 * Map a kaicast_reports doc's `now` block to the log's AbyssConditions
 * shape, stringifying with a sensible unit suffix so the log displays
 * cleanly without each call site re-formatting. Fields the report
 * doesn't carry (surface current, alerts) stay blank.
 */
function mapReportToAbyss(data: ReportSnapshot | null): AbyssConditions {
  if (!data?.now) return emptyAbyssConditions();
  const m = data.now.metrics ?? {};
  const v = data.now.visibility ?? {};
  const fmt = (val: number | null | undefined, unit: string): string =>
    Number.isFinite(val as number) ? `${val} ${unit}` : '';
  const visFt = Number.isFinite(v.estimatedVisibilityFeet as number)
    ? (v.estimatedVisibilityFeet as number)
    : Number.isFinite(v.estimatedVisibilityMeters as number)
      ? Math.round((v.estimatedVisibilityMeters as number) * M_TO_FT)
      : null;
  const swellFt = Number.isFinite(m.waveHeightM as number)
    ? Math.round((m.waveHeightM as number) * M_TO_FT * 10) / 10
    : null;
  const waterF = Number.isFinite(m.waterTempC as number)
    ? Math.round(((m.waterTempC as number) * 9) / 5 + 32)
    : null;
  const swellDeg = v.exposure?.swellFromDeg;
  const windDeg = m.windDeg;
  const wind = Number.isFinite(m.windSpeedKts as number)
    ? `${m.windSpeedKts} kt${Number.isFinite(windDeg as number) ? ` ${degToCompass(windDeg as number)}` : ''}`
    : '';
  return {
    visibility:       fmt(visFt,          'ft'),
    waterTemp:        fmt(waterF,         '°F'),
    swellHeight:      fmt(swellFt,        'ft'),
    swellPeriod:      fmt(m.wavePeriodS,  's'),
    swellDirection:   Number.isFinite(swellDeg as number) ? degToCompass(swellDeg as number) : '',
    surfaceCurrent:   '',
    currentDirection: '',
    windForecast:     wind,
    alerts:           '',
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
        const key = hourKeyUtc(ms);
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
