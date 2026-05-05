import { useEffect, useState } from 'react';

import { BackendReport, fetchSpotReport } from '@/api/kaicast';
import { electricBeachReport } from '@/api/mockData';
import type { ConditionRating, Spot, SpotReport } from '@/types';

/**
 * Live spot report state. The `source` field tells the UI whether the
 * data came from the deployed Firebase Function (`live`) or the local
 * mock (`mock`) — useful for showing a "DEMO" badge until the backend
 * goes live.
 */
export type SpotReportState = {
  data: SpotReport;
  source: 'live' | 'mock';
  loading: boolean;
  error: string | null;
};

/**
 * useSpotReport(spotId)
 *
 * Calls the Firebase getReport endpoint and translates the
 * BackendReport into the SpotReport shape the screens already render.
 * If the endpoint 404s (functions not deployed) or any other failure
 * happens, returns the mock electricBeachReport so the UI keeps
 * working in development. Once the backend is deployed, the same hook
 * starts returning live data with no caller change required.
 */
export function useSpotReport(spot: Spot): SpotReportState {
  const [state, setState] = useState<SpotReportState>({
    data: electricBeachReport,
    source: 'mock',
    loading: true,
    error: null,
  });

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchSpotReport(spot.id, ctrl.signal)
      .then((backend) => {
        if (cancelled) return;
        const merged = mergeBackendIntoReport(backend, spot);
        setState({ data: merged, source: 'live', loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Fall back to the mock so the UI doesn't go blank. `source` =
        // 'mock' so screens can show a DEMO badge.
        setState({ data: electricBeachReport, source: 'mock', loading: false, error: msg });
      });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [spot.id]);

  return state;
}

// ─── unit conversions ───────────────────────────────────────────────
const M_TO_FT = 3.28084;
const KTS_TO_MPH = 1.15078;
const C_TO_F = (c: number) => c * 1.8 + 32;

function fromMaybe<T>(value: T | null | undefined, fallback: T): T {
  return value === null || value === undefined ? fallback : value;
}

function toRating(label: string | undefined): ConditionRating {
  const l = (label ?? '').toLowerCase();
  if (l.includes('excellent')) return 'excellent';
  if (l.includes('good')) return 'good';
  if (l.includes('caution') || l.includes('fair')) return 'caution';
  return 'hazard';
}

function mergeBackendIntoReport(backend: BackendReport, spot: Spot): SpotReport {
  const m = backend.now.metrics;
  const visMeters = backend.now.visibility?.estimatedVisibilityMeters;
  const ratingLabel = backend.now.rating?.label ?? electricBeachReport.ratingLabel;

  // Tide, moon, runoff, and forecast may not all be present yet — start
  // from the mock and override what we DO have. This way every screen
  // sees a fully-populated SpotReport even when the backend is
  // partially implemented.
  const fallback = electricBeachReport;

  return {
    ...fallback,
    spot,
    rating: toRating(ratingLabel),
    ratingLabel,
    isLive: true,
    visibilityFt:
      visMeters != null
        ? Math.round(visMeters * M_TO_FT)
        : fallback.visibilityFt,
    swellHeightFt:
      m.waveHeightM != null
        ? Math.round(m.waveHeightM * M_TO_FT)
        : fallback.swellHeightFt,
    waterTempF:
      m.waterTempC != null
        ? Math.round(C_TO_F(m.waterTempC))
        : fallback.waterTempF,
    airTempF:
      m.airTempC != null
        ? Math.round(C_TO_F(m.airTempC))
        : fallback.airTempF,
    windMph:
      m.windSpeedKts != null
        ? Math.round(m.windSpeedKts * KTS_TO_MPH)
        : fallback.windMph,
    gustMph:
      m.windGustKts != null
        ? Math.round(m.windGustKts * KTS_TO_MPH)
        : fallback.gustMph,
    // currentMph + uvIndex aren't in the backend yet — keep the mock.
    currentMph: fallback.currentMph,
    uvIndex: fallback.uvIndex,
    tide: fromMaybe(coerceTide(backend.tide ?? backend.now.tide), fallback.tide),
    moon: fromMaybe(coerceMoon(backend.now.analysis?.moon), fallback.moon),
  };
}

// Tide / moon shapes from the backend are typed `any` — coerce
// defensively. If anything is malformed we return undefined and the
// caller falls back to the mock value.
function coerceTide(raw: any): SpotReport['tide'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const trend = raw.trend === 'rising' || raw.trend === 'falling' ? raw.trend : 'rising';
  const nowFt = typeof raw.nowFt === 'number' ? raw.nowFt : undefined;
  const nextFt = typeof raw.nextFt === 'number' ? raw.nextFt : undefined;
  const nextLabel = typeof raw.nextLabel === 'string' ? raw.nextLabel : undefined;
  const series = Array.isArray(raw.series) ? raw.series : undefined;
  if (nowFt === undefined || nextFt === undefined || !nextLabel || !series) return undefined;
  return { trend, nowFt, nextFt, nextLabel, series };
}

function coerceMoon(raw: any): SpotReport['moon'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const phase = typeof raw.phase === 'string' ? raw.phase : undefined;
  const illumination = typeof raw.illumination === 'number' ? raw.illumination : undefined;
  const daysSinceFullMoon =
    typeof raw.daysSinceFullMoon === 'number' ? raw.daysSinceFullMoon : undefined;
  if (!phase || illumination === undefined || daysSinceFullMoon === undefined) return undefined;
  return { phase, illumination, daysSinceFullMoon };
}
