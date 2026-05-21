export type StatusLevel = 'clear' | 'caution' | 'hazard';

export type SeverityValue = {
  label: string;
  value: string;
  color: string;
};

export type MarineSpecies = {
  name: string;
  likelihood: 'UNLIKELY' | 'POSSIBLE' | 'LIKELY';
  note: string;
};

export type HazardsReport = {
  status: { level: StatusLevel; text: string };
  uv: { value: number; severity: string };
  runoff: SeverityValue[];
  runoffNote?: string;
  marineLife: MarineSpecies[];
  safety: SeverityValue[];
};
