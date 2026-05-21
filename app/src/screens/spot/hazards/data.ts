import { colors } from '@/theme';
import { electricBeachReport } from '@/api/mockData';
import type { BackendReport, BackendRunoff } from '@/api/kaicast';
import type { Spot } from '@/types';
import type { HazardsReport, MarineSpecies, SeverityValue } from './types';

/**
 * Build the Hazards-tab UI shape from the live BackendReport's `now`
 * snapshot. Falls back to the local mock when no live report is
 * passed (e.g. spot has no backend SPOTS entry yet, or the fetch
 * failed). Every consumer below the data layer is a pure function of
 * HazardsReport, so swapping data sources doesn't ripple.
 */
export function getHazardsReport(_spot: Spot | undefined, report: BackendReport | null): HazardsReport {
  const r = electricBeachReport;
  const now = report?.now;
  // BackendReport doesn't yet emit a UV index; until it does, use
  // the mock value so the gradient bar still renders.
  const uv = r.uvIndex ?? 0;
  const moonIllumPct =
    now?.analysis?.moon?.moonIllumination ?? (r.moon?.illumination ?? 0) * 100;

  const runoff = now?.analysis?.runoff ?? null;
  const jelly = now?.analysis?.jellyfish ?? null;
  const fallbackConfidence = now?.confidenceScore ?? 0.5;

  return {
    status: deriveStatus(runoff, jelly),
    uv: { value: uv, severity: uvSeverityLabel(uv) },
    runoff: runoffCards(runoff),
    runoffNote: runoffNote(runoff, fallbackConfidence),
    marineLife: [jellyfishCard(moonIllumPct, jelly)],
    safety: [
      { label: 'ENTRY & EXIT', value: 'easy', color: colors.excellent },
      {
        label: 'UV INDEX',
        value: uvSeverityLabel(uv).split(' ')[0].toLowerCase(),
        color: uvColor(uv),
      },
    ],
  };
}

// ── status banner ────────────────────────────────────────────────────

function deriveStatus(
  runoff: BackendRunoff | null,
  jelly: { jellyfishWarning: boolean } | null,
): HazardsReport['status'] {
  if (jelly?.jellyfishWarning) {
    return { level: 'hazard', text: 'Jellyfish warning — avoid the water if possible.' };
  }
  if (runoff?.severity === 'extreme' || runoff?.severity === 'high') {
    return { level: 'hazard', text: 'Heavy runoff — water quality is poor right now.' };
  }
  if (runoff?.severity === 'moderate') {
    return { level: 'caution', text: 'Some runoff in the area — proceed with care.' };
  }
  return { level: 'clear', text: 'All Clear — No major hazards detected' };
}

// ── runoff 2x2 grid ──────────────────────────────────────────────────

function runoffCards(runoff: BackendRunoff | null): SeverityValue[] {
  // Mock-style fallback when no live report.
  if (!runoff) {
    return [
      { label: 'RUNOFF SEVERITY',     value: 'none',  color: colors.excellent },
      { label: 'RUNOFF HEALTH RISK',  value: 'low',   color: colors.warn },
      { label: 'WATER QUALITY',       value: 'clean', color: colors.accent },
      { label: 'SAFE TO ENTER',       value: 'safe',  color: colors.excellent },
    ];
  }
  return [
    {
      label: 'RUNOFF SEVERITY',
      value: runoff.severity,
      color: severityColor(runoff.severity),
    },
    {
      label: 'RUNOFF HEALTH RISK',
      value: runoff.healthRisk,
      color: healthRiskColor(runoff.healthRisk),
    },
    {
      label: 'WATER QUALITY',
      value: runoff.waterQualityFeel,
      color: waterQualityColor(runoff.waterQualityFeel),
    },
    {
      label: 'SAFE TO ENTER',
      value: runoff.safeToEnter ? 'safe' : 'avoid',
      color: runoff.safeToEnter ? colors.excellent : colors.hazard,
    },
  ];
}

function runoffNote(runoff: BackendRunoff | null, fallbackConfidence: number): string | undefined {
  if (!runoff) {
    return 'Estimated from satellite turbidity + last 24 h rainfall. Confidence may be low after storm events.';
  }
  if (runoff.drivers.length === 0) return undefined;
  const conf = Math.round((runoff.confidence ?? fallbackConfidence) * 100);
  return `${runoff.drivers[0]} (confidence ${conf}%)`;
}

function severityColor(s: BackendRunoff['severity']): string {
  switch (s) {
    case 'none':     return colors.excellent;
    case 'low':      return colors.good;
    case 'moderate': return colors.warn;
    case 'high':     return colors.hazard;
    case 'extreme':  return colors.hazard;
  }
}

function healthRiskColor(r: BackendRunoff['healthRisk']): string {
  switch (r) {
    case 'low':      return colors.warn;
    case 'moderate': return colors.warn;
    case 'high':     return colors.hazard;
  }
}

function waterQualityColor(q: BackendRunoff['waterQualityFeel']): string {
  switch (q) {
    case 'clean':            return colors.accent;
    case 'slightly-stained': return colors.warn;
    case 'murky':            return colors.warn;
    case 'brown':            return colors.hazard;
  }
}

// ── UV ───────────────────────────────────────────────────────────────

function uvSeverityLabel(uv: number): string {
  if (uv <= 2) return 'LOW';
  if (uv <= 5) return 'MODERATE';
  if (uv <= 7) return 'HIGH';
  if (uv <= 10) return 'VERY HIGH';
  return 'EXTREME';
}

function uvColor(uv: number): string {
  if (uv <= 2) return colors.accent;
  if (uv <= 5) return colors.excellent;
  if (uv <= 7) return colors.warn;
  return colors.hazard;
}

// ── marine life — jellyfish card ─────────────────────────────────────

function jellyfishCard(
  moonIllumPct: number,
  jelly: { jellyfishWarning: boolean; jellyfishNote?: string } | null,
): MarineSpecies {
  // Server-emitted warning wins when set.
  if (jelly?.jellyfishWarning) {
    return {
      name: 'Jellyfish',
      likelihood: 'LIKELY',
      note: jelly.jellyfishNote || 'Box jellyfish swarms reported in the area.',
    };
  }
  // Lunar-phase heuristic (8–10 days post-full moon = peak south-shore
  // Hawaii). Without backend hints we infer likelihood from
  // illumination drift.
  if (moonIllumPct > 60 && moonIllumPct < 95) {
    return {
      name: 'Jellyfish',
      likelihood: 'POSSIBLE',
      note:
        'Box jellyfish swarms typically arrive 8–10 days after a full moon ' +
        'on south-facing Oahu shores. Watch for clear, golf-ball-sized bodies ' +
        'in the surf zone.',
    };
  }
  return {
    name: 'Jellyfish',
    likelihood: 'UNLIKELY',
    note: 'Lunar timing currently outside the typical jellyfish window for south-facing shores.',
  };
}
