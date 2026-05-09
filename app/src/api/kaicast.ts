import Constants from 'expo-constants';

const API_BASE: string =
  (Constants.expoConfig?.extra as { kaicastApiBase?: string } | undefined)?.kaicastApiBase ??
  'https://us-central1-kaicast-207dc.cloudfunctions.net';

export type BackendReport = {
  spot: string;
  spotName: string;
  spotLat: number;
  spotLon: number;
  spotCoast: string;
  generatedAt: string;
  hourKey: string;
  sources: string[];
  qcFlags: string[];
  tide: any;
  now: {
    metrics: {
      airTempC: number | null;
      windSpeedKts: number | null;
      windGustKts: number | null;
      windDeg: number | null;
      cloudCoverPercent: number | null;
      rainLast1hMM: number | null;
      waveHeightM: number | null;
      wavePeriodS: number | null;
      waterTempC: number | null;
    };
    confidenceScore: number;
    tide: any;
    analysis: { moon: any; jellyfish: any; runoff: any };
    visibility: { estimatedVisibilityMeters: number; rationale?: string[] };
    rating: { score: number; label: string; rationale?: string[] };
  };
  windows: any[];
};

export type FetchNowResponse = {
  ok: boolean;
  reports: number;
  generatedAt: string;
};

export async function triggerFetchNow(publish = false): Promise<FetchNowResponse> {
  const url = `${API_BASE}/fetchKaiCastNow${publish ? '?publish=1' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KaiCast API error ${res.status}`);
  return (await res.json()) as FetchNowResponse;
}

/**
 * Fetch the latest BackendReport for one spot from the Firebase
 * `getReport` endpoint. Throws on non-2xx so callers (the
 * useSpotReport hook) can fall back to mock data when the function
 * isn't deployed yet.
 */
export async function fetchSpotReport(spotId: string, signal?: AbortSignal): Promise<BackendReport> {
  // Backend reads `req.query.spotId` (NOT `spot`). Earlier the client
  // sent `?spot=…`, which the backend ignored and defaulted to the
  // first spot in its SPOTS object — every spot screen silently
  // rendered Electric Beach's report. Fixed now.
  const url = `${API_BASE}/getReport?spotId=${encodeURIComponent(spotId)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`KaiCast API error ${res.status} for ${spotId}`);
  return (await res.json()) as BackendReport;
}

export const kaicastApi = {
  base: API_BASE,
  triggerFetchNow,
  fetchSpotReport,
};
