import Constants from 'expo-constants';

const API_BASE: string =
  (Constants.expoConfig?.extra as { kaicastApiBase?: string } | undefined)?.kaicastApiBase ??
  'https://us-central1-kaicast.cloudfunctions.net';

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

export const kaicastApi = {
  base: API_BASE,
  triggerFetchNow,
};
