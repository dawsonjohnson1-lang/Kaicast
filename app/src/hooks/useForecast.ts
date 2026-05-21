// Forecast data hook for the Spot Detail Forecast tab.
//
// Fetches the live BackendReport for the given spot and replaces day
// 0 of the synthetic mock forecast with it. Days 1–9 keep coming
// from buildMockForecast() until the backend grows a multi-day
// endpoint. Source flag tells the caller whether today's data is
// 'live' or fell back to 'mock' (e.g. backend failed / no SPOTS
// entry for this spot — common pre-#4-fix).

import { useEffect, useMemo, useState } from 'react';

import { fetchSpotReport, type BackendReport } from '@/api/kaicast';
import { buildMockForecast, type ForecastDay } from '@/api/forecast-mock';
import { backendReportToForecastDay, backendDaysToForecastDays } from '@/api/forecast-live';
import type { Spot } from '@/types';

type State = {
  days: ForecastDay[];
  source: 'live' | 'mock';
  loading: boolean;
};

export function useForecast(spot: Spot | undefined): State {
  // Build the mock baseline once per mount so the synthetic days
  // 1–9 are stable across re-renders.
  const baseline = useMemo(() => buildMockForecast(), []);
  const [state, setState] = useState<State>({
    days: baseline,
    source: 'mock',
    loading: !!spot,
  });

  useEffect(() => {
    if (!spot) {
      setState({ days: baseline, source: 'mock', loading: false });
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    fetchSpotReport(spot.id, ctrl.signal)
      .then((report: BackendReport) => {
        if (cancelled) return;
        const today = backendReportToForecastDay(report, baseline[0].id);
        // Backend now ships a 7-day daily aggregate from Open-Meteo
        // Marine. Replace the rest of the strip with real days when
        // present; pad with mock to keep the 10-day strip length.
        const liveDays = backendDaysToForecastDays(report.days);
        const merged: ForecastDay[] = liveDays.length
          ? [today, ...liveDays, ...baseline.slice(1 + liveDays.length)]
          : [today, ...baseline.slice(1)];
        setState({ days: merged, source: 'live', loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        // Backend hadn't generated a report (spot not in SPOTS), or
        // the fetch failed. Stay on the mock so the tab renders
        // something useful; caller can show a DEMO badge.
        setState({ days: baseline, source: 'mock', loading: false });
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [spot?.id, baseline]);

  return state;
}
