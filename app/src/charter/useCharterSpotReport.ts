// useCharterSpotReport — fetch the raw BackendReport for a spot so the
// charter two-day forecast can slice real today/tomorrow conditions. The
// consumer forecast tab uses useForecast() (which maps to ForecastDay[]);
// the charter view needs the raw report, so it calls fetchSpotReport
// directly with a small in-memory cache (re-navigating between dashboards
// shouldn't re-fetch every spot).

import { useEffect, useState } from 'react';
import { fetchSpotReport, type BackendReport } from '@/api/kaicast';

const cache = new Map<string, { at: number; data: BackendReport }>();
const inflight = new Map<string, Promise<BackendReport>>();
const CACHE_MS = 5 * 60 * 1000;

function load(spotId: string): Promise<BackendReport> {
  const hit = cache.get(spotId);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
  const existing = inflight.get(spotId);
  if (existing) return existing;
  const p = fetchSpotReport(spotId)
    .then((data) => {
      cache.set(spotId, { at: Date.now(), data });
      return data;
    })
    // Clear on both settle paths — a rejected promise left in `inflight`
    // would be returned to every future caller, permanently breaking the spot.
    .finally(() => { inflight.delete(spotId); });
  inflight.set(spotId, p);
  return p;
}

export type CharterSpotReportState = {
  data: BackendReport | null;
  loading: boolean;
  error: string | null;
};

export function useCharterSpotReport(spotId: string | undefined): CharterSpotReportState {
  const [state, setState] = useState<CharterSpotReportState>({
    data: spotId ? cache.get(spotId)?.data ?? null : null,
    loading: !!spotId,
    error: null,
  });

  useEffect(() => {
    if (!spotId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load(spotId)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((err: Error) => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [spotId]);

  return state;
}
