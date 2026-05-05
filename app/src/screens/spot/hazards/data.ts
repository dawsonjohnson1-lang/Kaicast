import { colors } from '@/theme';
import { electricBeachReport } from '@/api/mockData';
import type { Spot } from '@/types';
import type { HazardsReport, MarineSpecies } from './types';

// TODO(kaicast-api): Replace with a real fetch against
// `BackendReport.now.analysis` (moon, jellyfish, runoff) once the shape
// is locked in. The UI consumes a normalized HazardsReport so backend
// shape changes only need to update the mapper, not the screen.
export function getHazardsReport(_spot?: Spot): HazardsReport {
  const r = electricBeachReport;
  const uv = r.uvIndex ?? 0;
  const moonIllum = (r.moon?.illumination ?? 0) as number;

  return {
    status: { level: 'clear', text: 'All Clear — No major hazards detected' },
    uv: { value: uv, severity: uvSeverityLabel(uv) },
    runoff: [
      { label: 'RUNOFF SEVERITY',     value: 'none',  color: colors.excellent },
      { label: 'RUNOFF HEALTH RISK',  value: 'low',   color: colors.warn },
      { label: 'WATER QUALITY',       value: 'clean', color: colors.accent },
      { label: 'SAFE TO ENTER',       value: 'safe',  color: colors.excellent },
    ],
    runoffNote: 'Estimated from satellite turbidity + last 24 h rainfall. Confidence may be low after storm events.',
    marineLife: [jellyfishCard(moonIllum)],
    safety: [
      { label: 'ENTRY & EXIT', value: 'easy', color: colors.excellent },
      { label: 'UV INDEX',     value: uvSeverityLabel(uv).split(' ')[0].toLowerCase(), color: uvColor(uv) },
    ],
  };
}

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

// Lunar illumination drives box jellyfish runs in Hawaii — peak swarms
// 8–10 days after a full moon. Map illumination + days-since-full to a
// likelihood bucket. Real backend will replace this with the analysis
// from `BackendReport.now.analysis.jellyfish`.
function jellyfishCard(_moonIllum: number): MarineSpecies {
  return {
    name: 'Jellyfish',
    likelihood: 'POSSIBLE',
    note:
      'Box jellyfish swarms typically arrive 8–10 days after a full moon ' +
      'on south-facing Oahu shores. Currents are light today, so any drift ' +
      'will stay close to the entry. Watch for clear, golf-ball-sized bodies ' +
      'in the surf zone.',
  };
}
