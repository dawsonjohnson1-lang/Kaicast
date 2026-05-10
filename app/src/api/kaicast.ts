import Constants from 'expo-constants';

const API_BASE: string =
  (Constants.expoConfig?.extra as { kaicastApiBase?: string } | undefined)?.kaicastApiBase ??
  'https://us-central1-kaicast-207dc.cloudfunctions.net';

// Mirrors the shape produced by `analysis.fetchMoonPhase` on the
// server. moonIllumination is a percentage (0–100), not a 0–1
// fraction — divide by 100 if you need that.
export type BackendMoon = {
  moonPhase: string;          // "Waning Crescent", "Full Moon", …
  moonIllumination: number;   // 0–100 %
  daysSinceFullMoon: number;
  tz?: string;
  lat?: number;
  lon?: number;
};

// `analysis.evaluateJellyfishAndNightDive` output. The server is
// currently conservative — both flags are false in baseline — but
// the schema is here for the day it starts emitting real signals.
export type BackendJellyfish = {
  jellyfishWarning: boolean;
  nightDivingOk: boolean;
  jellyfishNote: string;
  nightDiveNote: string;
};

// `analysis.assessRunoffRisk` → `estimateRunoffRisk` output.
export type BackendRunoffSeverity = 'none' | 'low' | 'moderate' | 'high' | 'extreme';
export type BackendRunoff = {
  severity: BackendRunoffSeverity;
  healthRisk: 'low' | 'moderate' | 'high';
  safeToEnter: boolean;
  waterQualityFeel: 'clean' | 'slightly-stained' | 'murky' | 'brown';
  scorePenalty: number;
  drivers: string[];
  confidence: number;     // 0–1
};

export type BackendAnalysis = {
  moon: BackendMoon;
  jellyfish: BackendJellyfish;
  runoff: BackendRunoff;
};

export type BackendSun = {
  altitudeDeg: number | null;
  azimuthDeg: number | null;
};

export type BackendShadow = {
  shadowed: boolean;
  reason?: 'night' | 'terrain' | 'unknown' | null;
  horizonDeg?: number | null;
  marginDeg?: number | null;
};

export type BackendLight = {
  factor: number;
  direct?: number;
  diffuse?: number;
  reason?: string | null;
};

export type BackendExposure = {
  factor: number;
  swellFromDeg: number | null;
  rawWaveHeightM: number | null;
  effectiveWaveHeightM: number | null;
};

export type BackendWindRel = {
  relation: 'onshore' | 'offshore' | 'cross' | 'unknown';
  openOceanBearingDeg: number | null;
  angleFromOpenDeg: number | null;
  chopMultiplier: number;
};

export type BackendVisibility = {
  estimatedVisibilityMeters: number;
  estimatedVisibilityFeet?: number;
  rating?: string;
  source?: 'satellite' | 'heuristic' | 'cache';
  confidence?: number;
  rationale?: string[];
  sun?: BackendSun;
  shadow?: BackendShadow;
  light?: BackendLight;
  exposure?: BackendExposure;
  wind?: BackendWindRel;
  layers?: Record<string, number | null>;
};

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
    analysis: BackendAnalysis;
    visibility: BackendVisibility;
    rating: { score: number; label: string; rationale?: string[] };
  };
  windows: any[];
  days?: BackendDay[];
};

export type BackendDay = {
  date: string;              // YYYY-MM-DD in spot's local tz
  waveMinM: number | null;
  waveMaxM: number | null;
  waveAvgM: number | null;
  wavePeriodS: number | null;
  waveDirDeg: number | null;
  airTempCAvg: number | null;
  rainTotalMM: number | null;
  windAvgKts: number | null;
  windMaxKts: number | null;
  tideEvents?: BackendDayTide[];
  solar?: BackendDaySolar;
};

export type BackendDaySolar = {
  firstLightMs: number | null;  // first moment sun above local terrain horizon
  lastLightMs:  number | null;  // last moment sun above local terrain horizon
  solarNoonMs:  number | null;  // time of peak altitude
  peakAltDeg:   number | null;
};

export type BackendDayTide = {
  type: 'high' | 'low';
  tsMs: number;
  heightFt: number;
  hour24: number;            // 0-23 in spot-local tz
  timeLabel: string;         // e.g. "8:42am"
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
