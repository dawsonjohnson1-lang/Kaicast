// Live Firestore report shape — mirrors what `buildSpotReport` writes
// in functions/index.js. All numeric metrics may be `null` when the
// underlying data source (buoy / OpenWeather) didn't return a value
// for the closest hour.

export type Severity = 'none' | 'low' | 'moderate' | 'high' | 'extreme';

export type Metrics = {
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

export type RainRollups = {
  rain3hMM: number;
  rain6hMM: number;
  rain12hMM: number;
  rain24hMM: number;
  rain48hMM: number;
  rain72hMM: number;
};

export type TideCycle = {
  currentTideState: 'rising' | 'falling' | 'high' | 'low' | string;
  currentTideHeight: number;
  highTideTime?: string;
  highTideHeight?: number;
  lowTide1Time?: string;
  lowTide1Height?: number;
  lowTide2Time?: string;
  lowTide2Height?: number;
  series?: { tsMs: number; heightFt: number }[];
};

export type RunoffAnalysis = {
  severity: Severity;
  healthRisk: string;
  safeToEnter: boolean;
  waterQualityFeel: string;
  scorePenalty: number;
  drivers: string[];
  confidence: number;
};

export type MoonAnalysis = {
  moonPhase: string;
  moonIllumination: number;
  daysSinceFullMoon: number;
};

export type JellyfishAnalysis = {
  jellyfishWarning: boolean;
  nightDivingOk: boolean;
  jellyfishNote?: string;
  nightDiveNote?: string;
};

export type Visibility = {
  estimatedVisibilityMeters: number;
  estimatedVisibilityFeet: number;
  rating?: string;
  rationale?: string[];
};

export type Rating = {
  rating: string;        // "Excellent" / "Great" / "Good" / "Fair" / "No-Go"
  score: number;         // 0–100
  reason?: string;
  cautionNote?: string;
};

export type ForecastWindow = {
  startIso: string;
  endIso: string;
  avg: Metrics;
  tide: { tideState: string | null; tideHeight: number | null };
  rainRollups?: RainRollups;
  runoff: RunoffAnalysis;
  visibility: Visibility;
  rating: Rating;
};

export type SpotReportDoc = {
  spot: string;
  spotName: string;
  spotLat: number;
  spotLon: number;
  spotCoast: string;
  generatedAt: string;
  hourKey: string;
  sources: string[];
  qcFlags: string[];
  tide: TideCycle | null;
  now: {
    metrics: Metrics;
    rainRollups: RainRollups;
    confidenceScore: number;
    tide: TideCycle | null;
    analysis: {
      moon: MoonAnalysis;
      jellyfish: JellyfishAnalysis;
      runoff: RunoffAnalysis;
    };
    visibility: Visibility;
    rating: Rating;
  };
  windows: ForecastWindow[];
};

// Static spot metadata — seeded once into /spots/{spotId}.
export type SpotDoc = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  island?: string;
  coast?: string;
  heroImageUrl?: string;
  mapPreviewUrl?: string;
  googleMapsUrl?: string;
  guideText?: string;
  idealConditionsText?: string;
  abilityLevel?: string;
  abilityLevelScore?: number;
  entryType?: 'Shore' | 'Boat' | 'Kayak' | string;
  maxDepthFt?: number;
  bestTimeOfDay?: string;
  parkingNotes?: string;
  maxCleanSwellFt?: number;
  hardNoGoSwellFt?: number;
  runoffSensitivity?: 'low' | 'medium' | 'high';
  nearStreamMouth?: boolean;
  nearDrainage?: boolean;
};

export type CommunityReport = {
  id?: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  spotId: string;
  spotName: string;
  loggedAt: string;       // ISO
  diveType: 'scuba' | 'freedive' | 'spear' | 'snorkel';
  overallRating: string;
  depthFt?: number;
  reportedVisibilityFt?: number;
  reportedCurrent?: 'NONE' | 'LIGHT' | 'MODERATE' | 'STRONG';
  reportedEntryCondition?: 'SAFE' | 'CHOPPY' | 'ROUGH';
  waterQuality?: 'CLEAN' | 'MURKY' | 'GREEN' | 'BROWN';
  notes?: string;
  likesCount?: number;
  commentsCount?: number;
  hazardFlags?: string[];
};

export type AlertSeverity = 'info' | 'warn' | 'hazard';

export type ConditionAlertDoc = {
  id?: string;
  spotId: string;
  spotName: string;
  message: string;
  severity: AlertSeverity;
  generatedAt: string;
  expiresAt?: string;
};
