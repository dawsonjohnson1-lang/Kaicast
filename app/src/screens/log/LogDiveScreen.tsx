import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, LayoutAnimation, Platform, UIManager, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { ProgressDots } from '@/components/ProgressDots';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ChoiceChip } from '@/components/ChoiceChip';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { AuthHero } from '@/components/AuthHero';
import { SpotPicker, type PickedSpot } from '@/components/SpotPicker';
import { CertEligibilityBadge } from '@/components/CertEligibilityBadge';
import { useAuth } from '@/hooks/useAuth';
import { useUserDiveLogs } from '@/hooks/useDiveLogs';
import { submitDiveLog, type SubmitDiveLogResult } from '@/api/diveLogs';
import { fetchSpotReport } from '@/api/kaicast';
import { colors, radius, spacing, typography } from '@/theme';
import {
  calcAirConsumed,
  calcSAC,
  calcSurfaceInterval,
  formatSurfaceInterval,
  ftToM,
  mToFt,
  fToC,
  cToF,
  psiToBar,
  barToPsi,
  lbsToKg,
  kgToLbs,
  cuftToL,
  lToCuft,
} from '@/utils/diveCalculations';
import type { DiveType } from '@/types';
import type { RootNav } from '@/navigation/types';
import {
  SPECIES_CATEGORIES,
  SPECIES_BY_ID,
  type SpeciesCategory,
} from '@/data/marineLife';

// Enable LayoutAnimation on Android (no-op on iOS).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Step-3 conditions enums — used for diver-reported ground-truth
// against KaiCast predictions.
type SurfaceState = 'glassy' | 'light_chop' | 'whitecaps' | 'breaking';
type CurrentStrength = 'none' | 'light' | 'moderate' | 'strong';
type CurrentDirection = 'with_shore' | 'against' | 'parallel' | 'variable' | 'reversing';
type WaterColor = 'blue' | 'green' | 'brown' | 'silty';
type Particulate = 'clean' | 'some' | 'heavy';
type SurgeAtDepth = 'none' | 'mild' | 'strong';
type MarineLifeActivity = 'low' | 'normal' | 'high';
type OverallRating = 'poor' | 'fair' | 'good' | 'excellent';
type ForecastAccuracy = 'much_worse' | 'worse' | 'as_predicted' | 'better' | 'much_better';

const SURFACE_STATES: { id: SurfaceState; label: string }[] = [
  { id: 'glassy', label: 'Glassy' },
  { id: 'light_chop', label: 'Light chop' },
  { id: 'whitecaps', label: 'Whitecaps' },
  { id: 'breaking', label: 'Breaking' },
];
const CURRENT_STRENGTHS: { id: CurrentStrength; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'strong', label: 'Strong' },
];
const CURRENT_DIRECTIONS: { id: CurrentDirection; label: string }[] = [
  { id: 'with_shore', label: 'With shore' },
  { id: 'against', label: 'Against' },
  { id: 'parallel', label: 'Parallel' },
  { id: 'variable', label: 'Variable' },
  { id: 'reversing', label: 'Reversing' },
];
const WATER_COLORS: { id: WaterColor; label: string }[] = [
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'brown', label: 'Brown' },
  { id: 'silty', label: 'Silty' },
];
const PARTICULATES: { id: Particulate; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'some', label: 'Some particles' },
  { id: 'heavy', label: 'Heavy' },
];
const SURGES: { id: SurgeAtDepth; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'mild', label: 'Mild' },
  { id: 'strong', label: 'Strong' },
];
const MARINE_LIFE: { id: MarineLifeActivity; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
];
const OVERALL_RATINGS: { id: OverallRating; label: string }[] = [
  { id: 'poor', label: 'Poor' },
  { id: 'fair', label: 'Fair' },
  { id: 'good', label: 'Good' },
  { id: 'excellent', label: 'Excellent' },
];
const FORECAST_ACCURACIES: { id: ForecastAccuracy; label: string }[] = [
  { id: 'much_worse', label: 'Much worse' },
  { id: 'worse', label: 'Worse' },
  { id: 'as_predicted', label: 'As predicted' },
  { id: 'better', label: 'Better' },
  { id: 'much_better', label: 'Much better' },
];

type Hazard = 'jellyfish' | 'rip_current' | 'boat_traffic' | 'discharge_plume' | 'wildlife' | 'gear_failure' | 'other';
const HAZARDS: { id: Hazard; label: string }[] = [
  { id: 'jellyfish', label: 'Jellyfish' },
  { id: 'rip_current', label: 'Rip current' },
  { id: 'boat_traffic', label: 'Boat traffic' },
  { id: 'discharge_plume', label: 'Discharge plume' },
  { id: 'wildlife', label: 'Wildlife concern' },
  { id: 'gear_failure', label: 'Gear failure' },
  { id: 'other', label: 'Other' },
];

// Matches desktop's SCUBA_DIVE_SUBTYPES (14 options) so cert-eligibility
// criteria evaluate identically across surfaces.
type ScubaSubType =
  | 'shore' | 'boat' | 'drift' | 'night' | 'deep' | 'wreck'
  | 'cave' | 'cavern' | 'ice' | 'altitude' | 'reef' | 'wall'
  | 'training' | 'search_recovery';

type VerificationType = 'self' | 'buddy' | 'instructor';
type EntryType = 'giant_stride' | 'back_roll' | 'shore';
type GasMix = 'air' | 'eanx' | 'trimix';
type SuitType = 'wetsuit' | 'drysuit' | 'skin';
type WetsuitThickness = '3mm' | '5mm' | '7mm';
type TankUnit = 'cuft' | 'liters';
type DepthUnit = 'ft' | 'm';
type PressureUnit = 'psi' | 'bar';
type TempUnit = 'F' | 'C';
type WeightUnit = 'lbs' | 'kg';

const SCUBA_SUB_TYPES: { id: ScubaSubType; label: string }[] = [
  { id: 'boat', label: 'Boat' },
  { id: 'shore', label: 'Shore' },
  { id: 'drift', label: 'Drift' },
  { id: 'night', label: 'Night' },
  { id: 'deep', label: 'Deep' },
  { id: 'wreck', label: 'Wreck' },
  { id: 'cave', label: 'Cave' },
  { id: 'cavern', label: 'Cavern' },
  { id: 'ice', label: 'Ice' },
  { id: 'altitude', label: 'Altitude' },
  { id: 'reef', label: 'Reef' },
  { id: 'wall', label: 'Wall' },
  { id: 'training', label: 'Training' },
  { id: 'search_recovery', label: 'Search & Recovery' },
];

const VERIFICATION_OPTIONS: { value: VerificationType; label: string; sub: string }[] = [
  { value: 'self',       label: 'Self-logged',             sub: 'No cert credit toward pro levels' },
  { value: 'buddy',      label: 'Buddy verified',          sub: 'Counts toward AOW, Rescue' },
  { value: 'instructor', label: 'Instructor / Divemaster', sub: 'Required for DM + Instructor credit' },
];

const AGENCY_OPTIONS = ['PADI', 'SSI', 'NAUI', 'SDI', 'RAID', 'CMAS', 'BSAC', 'GUE', 'TDI', 'Other'] as const;

// ─── Conditional-reveal section option lists (mirror desktop) ────────────
// Order matches desktop's LogDiveScreen.tsx constants so the same value
// renders the same option index on both surfaces.

const NIGHT_LIGHT_OPTIONS = [
  'Primary only', 'Primary + backup', 'Primary + backup + chemlight', 'Other',
];
const NIGHT_AMBIENT_OPTIONS = [
  'New moon / dark', 'Quarter moon', 'Half moon', 'Full moon', 'Dusk/dawn',
];

const FREEDIVE_DISCIPLINES = [
  'Constant weight (CWT)',
  'Constant no fins (CNF)',
  'Free immersion (FIM)',
  'Variable weight (VWT)',
  'No-limits (NLT)',
  'Dynamic apnea (DYN)',
  'Dynamic no fins (DNF)',
  'Static apnea (STA)',
  'Recreational',
];
const FREEDIVE_EQUALIZATION = [
  'Frenzel', 'Mouthfill', 'Valsalva', 'BTV (hands-free)', 'Other',
];

const SPEAR_GEAR_OPTIONS = [
  'Pole spear', 'Hawaiian sling', 'Speargun (band)', 'Speargun (pneumatic)', 'Three-prong', 'Other',
];
const SPEAR_ACCESS_OPTIONS = ['Shore', 'Boat', 'Kayak'];

const RECOMMEND_CHIPS = ['Definitely', 'Yes', 'With caveats', 'No'];
const REEF_HEALTH_CHIPS = ['Pristine', 'Healthy', 'Stressed', 'Bleached'];
const ENTRY_TYPES: { id: EntryType; label: string }[] = [
  { id: 'giant_stride', label: 'Giant stride' },
  { id: 'back_roll', label: 'Back roll' },
  { id: 'shore', label: 'Shore' },
];
const GAS_MIXES: { id: GasMix; label: string }[] = [
  { id: 'air', label: 'Air' },
  { id: 'eanx', label: 'EANx' },
  { id: 'trimix', label: 'Trimix' },
];
const SUITS: { id: SuitType; label: string }[] = [
  { id: 'wetsuit', label: 'Wetsuit' },
  { id: 'drysuit', label: 'Drysuit' },
  { id: 'skin', label: 'Skin' },
];
const TANK_UNITS: { id: TankUnit; label: string }[] = [
  { id: 'cuft', label: 'cu ft' },
  { id: 'liters', label: 'liters' },
];
const WETSUIT_THICKNESSES: { id: WetsuitThickness; label: string }[] = [
  { id: '3mm', label: '3mm' },
  { id: '5mm', label: '5mm' },
  { id: '7mm', label: '7mm' },
];

// Convert a user-entered numeric string (in `unit`) to the schema base
// unit. Returns 0 when the input isn't a number.
function toBaseDepth(s: string, unit: DepthUnit): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return unit === 'm' ? mToFt(n) : n;
}
function toBaseTempF(s: string, unit: TempUnit): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return unit === 'C' ? cToF(n) : n;
}
function toBasePsi(s: string, unit: PressureUnit): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return unit === 'bar' ? barToPsi(n) : n;
}
/**
 * Parse the step-1 `date` and `time` text inputs into a Unix ms
 * timestamp. Accepts `MM/DD/YYYY` (the form's default shape) and a
 * variety of clock formats — `2:30 PM`, `14:30`, etc. Returns
 * Date.now() if neither parses (or if the resulting date is more
 * than 24h in the future, which the server would reject anyway).
 */
function parseDiveAt(dateText: string, timeText: string): number {
  const fallback = Date.now();
  const dt = (dateText || '').trim();
  const tt = (timeText || '').trim();
  // Treat placeholder time as missing.
  const timeClean = tt && !tt.includes('--') ? tt : '12:00 PM';
  const combined = dt ? `${dt} ${timeClean}` : '';
  if (!combined) return fallback;
  const ms = Date.parse(combined);
  if (!Number.isFinite(ms)) return fallback;
  // Clamp anything more than 24h ahead — the server would reject it.
  if (ms > fallback + 24 * 3600 * 1000) return fallback;
  return ms;
}

function toBaseLbs(s: string, unit: WeightUnit): number {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return unit === 'kg' ? kgToLbs(n) : n;
}

type Step = 1 | 2 | 3 | 4 | 5;

const DIVE_TYPES: { id: DiveType; label: string }[] = [
  { id: 'scuba', label: 'Scuba' },
  { id: 'freedive', label: 'Freediving' },
  { id: 'spear', label: 'Spearfishing' },
  { id: 'snorkel', label: 'Snorkeling' },
];

const GROUP_SIZES = ['Solo', 'With a buddy', 'Small group', 'Guide'];

export function LogDiveScreen() {
  const nav = useNavigation<RootNav>();
  const { user } = useAuth();
  const { logs: userLogs } = useUserDiveLogs(user?.id);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  // Server response from submitDiveLog — drives the "your report is
  // live for other divers" line on the success screen.
  const [submitResult, setSubmitResult] = useState<SubmitDiveLogResult | null>(null);

  // Most recent prior log's loggedAt → drives the Surface Interval card
  // in scuba step 2. `useUserDiveLogs` returns newest-first.
  const previousDiveTimeOut: Date | null =
    userLogs && userLogs.length > 0 ? userLogs[0].loggedAt ?? null : null;
  const surfaceIntervalMin = useMemo(
    () => calcSurfaceInterval(previousDiveTimeOut, new Date()),
    [previousDiveTimeOut],
  );
  const diveNumber = (userLogs?.length ?? 0) + 1;

  const [type, setType] = useState<DiveType>('scuba');
  const [group, setGroup] = useState('Solo');
  const [date, setDate] = useState('04/16/2026');
  const [time, setTime] = useState('--:-- --');
  const [duration, setDuration] = useState('');
  const [spotPick, setSpotPick] = useState<PickedSpot | null>(null);
  const [spotPickerOpen, setSpotPickerOpen] = useState(false);

  const [depth, setDepth] = useState('');
  const [weapon, setWeapon] = useState('');

  // Step 3 — diver-reported conditions (validation against KaiCast).
  // No defaults: undefined === "diver did not answer", which we want
  // distinguished from a real answer in the analytics later.
  const [visibilityFt, setVisibilityFt] = useState('');
  const [surfaceState, setSurfaceState] = useState<SurfaceState | undefined>(undefined);
  const [currentStrength, setCurrentStrength] = useState<CurrentStrength | undefined>(undefined);
  const [currentDirection, setCurrentDirection] = useState<CurrentDirection | undefined>(undefined);
  const [waterColor, setWaterColor] = useState<WaterColor | undefined>(undefined);
  const [particulate, setParticulate] = useState<Particulate | undefined>(undefined);
  const [surgeAtDepth, setSurgeAtDepth] = useState<SurgeAtDepth | undefined>(undefined);
  const [marineLifeActivity, setMarineLifeActivity] = useState<MarineLifeActivity | undefined>(undefined);
  // Species sighting log — flat list of species ids (see data/marineLife.ts
  // for the taxonomy). The picker UI is a row of category chips that
  // open a modal of species checkboxes for that category; selections
  // persist across modal opens.
  const [speciesSeen, setSpeciesSeen] = useState<string[]>([]);
  const [speciesPickerCategory, setSpeciesPickerCategory] = useState<SpeciesCategory | null>(null);
  const [overallRating, setOverallRating] = useState<OverallRating | undefined>(undefined);
  const [forecastAccuracy, setForecastAccuracy] = useState<ForecastAccuracy | undefined>(undefined);
  const [conditionsNotes, setConditionsNotes] = useState('');
  const [hazardsExpanded, setHazardsExpanded] = useState(false);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [hazardsOther, setHazardsOther] = useState('');
  const [waterTemp, setWaterTemp] = useState('');

  const toggleHazard = (h: Hazard) => {
    setHazards((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  const [notes, setNotes] = useState('');

  // ----- Scuba-only state (step 2 when type === 'scuba') ---------------
  // All numeric inputs hold the user's entered string in the currently
  // selected display unit. Conversion to base units (ft, psi, °F, lbs,
  // cu ft) happens at submit time.
  // Multi-select per desktop parity (SCUBA_DIVE_SUBTYPES). At least one
  // entry required for AOW cert credit; first entry is mirrored back to
  // the legacy `diveSubType` server field for backwards compat.
  const [scubaSubtypes, setScubaSubtypes] = useState<ScubaSubType[]>(['shore']);
  const toggleSubtype = (id: ScubaSubType) => {
    setScubaSubtypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Cert-eligibility + verification state. Mirrors desktop's
  // OfficialToggle + VerificationBlock — see components/CertEligibilityBadge.tsx
  // for the evaluation criteria.
  const [isOfficial, setIsOfficial] = useState(false);
  const [verificationType, setVerificationType] = useState<VerificationType>('self');
  const [verifierName, setVerifierName] = useState('');
  const [verifierAgency, setVerifierAgency] = useState<string>('');
  const [verifierCertNumber, setVerifierCertNumber] = useState('');
  const [verifierSignatureTyped, setVerifierSignatureTyped] = useState('');

  // ─── Conditional-reveal state (Night / Deep / Freedive / Spear) ────────
  // Mirrors desktop's FormState fields; each section gates render on its
  // condition (scuba subtypes, depth > 60, dive type).
  const [nightLightSource, setNightLightSource] = useState('');
  const [nightAmbientLight, setNightAmbientLight] = useState('');
  const [nightVisibility, setNightVisibility] = useState('');

  const [deepConfirmedFromComputer, setDeepConfirmedFromComputer] = useState(false);
  const [deepNarcosisExperienced, setDeepNarcosisExperienced] = useState(false);
  const [deepNarcosisNotes, setDeepNarcosisNotes] = useState('');
  const [deepGasPlan, setDeepGasPlan] = useState('');

  const [freediveDiscipline, setFreediveDiscipline] = useState('');
  const [freediveEqualization, setFreediveEqualization] = useState('');
  const [freediveTargetDepth, setFreediveTargetDepth] = useState('');
  const [freediveBreathHold, setFreediveBreathHold] = useState('');
  const [freediveAttempts, setFreediveAttempts] = useState('');
  const [freediveSurfaceProtocolPass, setFreediveSurfaceProtocolPass] = useState(false);
  const [freediveSafetyOnDuty, setFreediveSafetyOnDuty] = useState(false);

  const [spearGear, setSpearGear] = useState('');
  const [spearAccessMode, setSpearAccessMode] = useState('');
  const [spearSpeciesLanded, setSpearSpeciesLanded] = useState('');
  const [spearCatchWeight, setSpearCatchWeight] = useState('');
  const [spearStringerUsed, setSpearStringerUsed] = useState(false);

  // Rate-the-Dive (final-step section, mirrors desktop's section 07).
  const [ratingStars, setRatingStars] = useState(0);
  const [recommend, setRecommend] = useState('');
  const [reefHealth, setReefHealth] = useState('');
  const [scubaEntry, setScubaEntry] = useState<EntryType>('giant_stride');
  const [scubaMaxDepth, setScubaMaxDepth] = useState('');
  const [scubaDepthUnit, setScubaDepthUnit] = useState<DepthUnit>('ft');
  const [scubaVis, setScubaVis] = useState('');
  const [scubaVisUnit, setScubaVisUnit] = useState<DepthUnit>('ft');
  const [scubaTempSurface, setScubaTempSurface] = useState('');
  const [scubaTempSurfaceUnit, setScubaTempSurfaceUnit] = useState<TempUnit>('F');
  const [scubaTempBottom, setScubaTempBottom] = useState('');
  const [scubaTempBottomUnit, setScubaTempBottomUnit] = useState<TempUnit>('F');
  const [scubaGasMix, setScubaGasMix] = useState<GasMix>('air');
  const [scubaO2, setScubaO2] = useState('');
  const [scubaHe, setScubaHe] = useState('');
  const [scubaStartPressure, setScubaStartPressure] = useState('');
  const [scubaEndPressure, setScubaEndPressure] = useState('');
  const [scubaPressureUnit, setScubaPressureUnit] = useState<PressureUnit>('psi');
  const [scubaTankSize, setScubaTankSize] = useState('');
  const [scubaTankUnit, setScubaTankUnit] = useState<TankUnit>('cuft');
  const [scubaSafetyDepth, setScubaSafetyDepth] = useState('');
  const [scubaSafetyDepthUnit, setScubaSafetyDepthUnit] = useState<DepthUnit>('ft');
  const [scubaSafetyDuration, setScubaSafetyDuration] = useState('');
  const [scubaWeight, setScubaWeight] = useState('');
  const [scubaWeightUnit, setScubaWeightUnit] = useState<WeightUnit>('lbs');
  const [scubaSuit, setScubaSuit] = useState<SuitType>('wetsuit');
  const [scubaWetsuitThk, setScubaWetsuitThk] = useState<WetsuitThickness>('5mm');
  const [scubaBuddy, setScubaBuddy] = useState('');

  // Animate conditional reveals (O2/He, wetsuit thickness, hazards expand).
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [scubaGasMix, scubaSuit, hazardsExpanded]);

  // Live-calculated summary values for scuba step 2.
  const scubaAirUsedPsi = useMemo(() => {
    const s = parseFloat(scubaStartPressure);
    const e = parseFloat(scubaEndPressure);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
    const startPsi = scubaPressureUnit === 'bar' ? s / 0.0689476 : s;
    const endPsi = scubaPressureUnit === 'bar' ? e / 0.0689476 : e;
    return calcAirConsumed(startPsi, endPsi);
  }, [scubaStartPressure, scubaEndPressure, scubaPressureUnit]);

  const scubaSacRate = useMemo(() => {
    const depthBase = toBaseDepth(scubaMaxDepth, scubaDepthUnit);
    const tankBase = scubaTankUnit === 'liters' ? lToCuft(parseFloat(scubaTankSize) || 0) : parseFloat(scubaTankSize) || 0;
    const dur = duration ? parseInt(duration, 10) : 0;
    if (scubaAirUsedPsi == null || !depthBase || !tankBase || dur <= 0) return null;
    return calcSAC(scubaAirUsedPsi, tankBase, depthBase / 2, dur);
  }, [scubaAirUsedPsi, scubaMaxDepth, scubaDepthUnit, scubaTankSize, scubaTankUnit, duration]);

  // For scuba, step 3's conditions chips still apply, but we skip the
  // standalone "water temp" question because step 2 captures it per
  // surface/bottom.
  const totalSteps = 4;

  // Required fields for an official scuba entry — mirrors desktop's
  // computeMissingOfficialFields (LogDiveScreen.tsx:1504). Only checked
  // when isOfficial && type === 'scuba'.
  const missingOfficialFields = useMemo<string[]>(() => {
    if (!isOfficial || type !== 'scuba') return [];
    const missing: string[] = [];
    if (!spotPick) missing.push('Dive spot');
    if (!duration || Number(duration) <= 0) missing.push('Bottom time');
    if (!scubaMaxDepth || Number(scubaMaxDepth) <= 0) missing.push('Max depth');
    if (!scubaStartPressure) missing.push('Start pressure');
    if (!scubaEndPressure) missing.push('End pressure');
    if (!scubaGasMix) missing.push('Gas mix');
    if (!scubaWeight) missing.push('Weight used');
    if (!scubaSuit) missing.push('Exposure suit');
    if (!scubaTempSurface) missing.push('Water temperature');
    if (!scubaVis) missing.push('Visibility');
    if (!scubaBuddy) missing.push('Buddy name');

    if (verificationType === 'self') {
      missing.push('Verification (buddy or instructor — self-log is not eligible)');
    } else {
      if (!verifierName) {
        missing.push(verificationType === 'instructor' ? 'Instructor name' : 'Buddy name (verifier)');
      }
      if (verificationType === 'instructor') {
        if (!verifierAgency) missing.push('Verifier agency');
        if (!verifierCertNumber) missing.push('Verifier cert / member number');
      }
      if (!verifierSignatureTyped) missing.push('Verifier signature acknowledgment');
    }

    if (scubaSubtypes.includes('night') && !nightLightSource) {
      missing.push('Night-dive light source');
    }
    if ((scubaSubtypes.includes('deep') || Number(scubaMaxDepth) > 60) && !deepConfirmedFromComputer) {
      missing.push('Confirm max depth from dive computer (deep dive)');
    }

    return missing;
  }, [
    isOfficial, type, spotPick, duration, scubaMaxDepth, scubaStartPressure,
    scubaEndPressure, scubaGasMix, scubaWeight, scubaSuit, scubaTempSurface,
    scubaVis, scubaBuddy, verificationType, verifierName, verifierAgency,
    verifierCertNumber, verifierSignatureTyped, scubaSubtypes,
    nightLightSource, deepConfirmedFromComputer,
  ]);

  const next = () => setStep(((step + 1) as Step));
  const back = () => (step === 1 ? nav.goBack() : setStep(((step - 1) as Step)));

  const onSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      // For known spots, capture the BackendReport at log time so the
      // log carries an objective conditions snapshot alongside the
      // user-reported readings. Two-tap pivots later — "what did
      // KaiCast think it was vs what the diver reported" — fall right
      // out of this. Custom spots have no backend report; skip.
      let conditionsSnapshot: Awaited<ReturnType<typeof fetchSpotReport>> | null = null;
      if (spotPick?.kind === 'known') {
        try {
          conditionsSnapshot = await fetchSpotReport(spotPick.id);
        } catch {
          // Non-blocking — if the spot has no backend report yet, the
          // log is still valid. conditionsSnapshot stays null.
          conditionsSnapshot = null;
        }
      }

      // For scuba, prefer the comprehensive step-2 max depth (converted
      // to ft) over step-1's `depth`. For other activities, the latter
      // is the only depth we collected.
      const depthFt =
        type === 'scuba'
          ? toBaseDepth(scubaMaxDepth, scubaDepthUnit) || null
          : depth
            ? Number.parseInt(depth, 10)
            : null;
      const waterTempBase = type === 'scuba'
        ? toBaseTempF(scubaTempSurface, scubaTempSurfaceUnit) || null
        : waterTemp ? Number.parseFloat(waterTemp) : null;

      const result = await submitDiveLog({
        uid: user.id,
        // For known spots, spotId matches the backend's SPOTS object so
        // the report cross-reference works. For custom spots we get a
        // synthetic id and stash the human-readable name + lat/lon
        // inline on the log so it's still meaningful.
        spotId: spotPick?.id ?? 'unknown',
        // Parse the step-1 date + time strings into a Unix ms. Robust
        // to either field being blank / placeholder — falls back to
        // Date.now() server-side. Server then clamps to ±1yr window.
        diveAt: parseDiveAt(date, time),
        customSpot:
          spotPick?.kind === 'custom'
            ? { name: spotPick.name, lat: spotPick.lat, lon: spotPick.lon }
            : undefined,
        diveType: type,
        groupSize: group,
        durationMin: duration ? Number.parseInt(duration, 10) : null,
        depthFt,
        // Conditions live in the new `conditions` object below.
        // Legacy chip fields (surface/current/visibility) are no longer
        // collected by the UI — leave them undefined.
        waterTempF: waterTempBase,
        notes,
        privacy: 'public',
        photos: [],
        conditionsSnapshot,
        conditions: {
          visibilityFt: visibilityFt ? parseFloat(visibilityFt) : undefined,
          surfaceState,
          currentStrength,
          currentDirection,
          waterColor,
          particulate,
          surgeAtDepth,
          marineLifeActivity,
          speciesSeen: speciesSeen.length > 0 ? speciesSeen : undefined,
          overallRating,
          forecastAccuracy,
          notes: conditionsNotes.trim() || undefined,
          hazards: hazards.length > 0 ? hazards : undefined,
          hazardsOther: hazards.includes('other') && hazardsOther.trim() ? hazardsOther.trim() : undefined,
        },
        scuba: type === 'scuba'
          ? {
              // Legacy single-value field, server schema accepts this.
              // First entry of the multi-select is the primary subtype.
              diveSubType: scubaSubtypes[0] ?? 'shore',
              // New multi-select array + cert-eligibility fields. Server
              // may not consume these yet; they're stored on the log doc
              // for the calibration job + future client refactor.
              diveSubTypes: scubaSubtypes,
              isOfficial,
              verificationType,
              verifierName: verifierName.trim() || undefined,
              verifierAgency: verifierAgency || undefined,
              verifierCertNumber: verifierCertNumber.trim() || undefined,
              verifierSignatureTyped: verifierSignatureTyped.trim() || undefined,
              entryType: scubaEntry,
              maxDepthFt: toBaseDepth(scubaMaxDepth, scubaDepthUnit) || undefined,
              visibilityFt: toBaseDepth(scubaVis, scubaVisUnit) || undefined,
              waterTempSurfaceF: toBaseTempF(scubaTempSurface, scubaTempSurfaceUnit) || undefined,
              waterTempBottomF: toBaseTempF(scubaTempBottom, scubaTempBottomUnit) || undefined,
              gasMix: scubaGasMix,
              o2Percent: scubaGasMix !== 'air' && scubaO2 ? Number.parseFloat(scubaO2) : undefined,
              hePercent: scubaGasMix === 'trimix' && scubaHe ? Number.parseFloat(scubaHe) : undefined,
              tankStartPsi: toBasePsi(scubaStartPressure, scubaPressureUnit) || undefined,
              tankEndPsi: toBasePsi(scubaEndPressure, scubaPressureUnit) || undefined,
              tankSizeCuft: scubaTankSize
                ? scubaTankUnit === 'liters'
                  ? lToCuft(parseFloat(scubaTankSize))
                  : parseFloat(scubaTankSize)
                : undefined,
              safetyStopDepthFt: toBaseDepth(scubaSafetyDepth, scubaSafetyDepthUnit) || undefined,
              safetyStopMin: scubaSafetyDuration ? parseFloat(scubaSafetyDuration) : undefined,
              weightLbs: toBaseLbs(scubaWeight, scubaWeightUnit) || undefined,
              suitType: scubaSuit,
              wetsuitThickness: scubaSuit === 'wetsuit' ? scubaWetsuitThk : undefined,
              buddyName: scubaBuddy.trim() || undefined,
              airUsedPsi: scubaAirUsedPsi ?? undefined,
              sacRate: scubaSacRate ?? undefined,
              // Conditional reveal blocks — only attached when the
              // relevant subtype is selected.
              night: scubaSubtypes.includes('night')
                ? {
                    lightSource: nightLightSource || undefined,
                    ambientLight: nightAmbientLight || undefined,
                    visibilityFt: nightVisibility ? parseFloat(nightVisibility) : undefined,
                  }
                : undefined,
              deep: scubaSubtypes.includes('deep') || Number(scubaMaxDepth) > 60
                ? {
                    confirmedFromComputer: deepConfirmedFromComputer,
                    narcosisExperienced: deepNarcosisExperienced,
                    narcosisNotes: deepNarcosisNotes.trim() || undefined,
                    gasPlan: deepGasPlan.trim() || undefined,
                  }
                : undefined,
            }
          : undefined,
        freedive: type === 'freedive'
          ? {
              discipline: freediveDiscipline || undefined,
              equalization: freediveEqualization || undefined,
              targetDepthFt: freediveTargetDepth ? parseFloat(freediveTargetDepth) : undefined,
              breathHold: freediveBreathHold.trim() || undefined,
              attempts: freediveAttempts ? parseInt(freediveAttempts, 10) : undefined,
              surfaceProtocolPass: freediveSurfaceProtocolPass,
              safetyOnDuty: freediveSafetyOnDuty,
            }
          : undefined,
        spear: type === 'spear'
          ? {
              gear: spearGear || undefined,
              accessMode: spearAccessMode || undefined,
              speciesLanded: spearSpeciesLanded.trim() || undefined,
              catchWeightLbs: spearCatchWeight ? parseFloat(spearCatchWeight) : undefined,
              stringerUsed: spearStringerUsed,
            }
          : undefined,
        rating: (ratingStars > 0 || recommend || reefHealth)
          ? {
              stars: ratingStars || undefined,
              recommend: recommend || undefined,
              reefHealth: reefHealth || undefined,
            }
          : undefined,
      });
      setSubmitResult(result);
      setStep(5);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[LogDive] submit failed:', err);
      // Still advance to the success screen — the stub fallback in
      // submitDiveLog never throws, so a thrown error means a real
      // Firebase write failed. Surface it but don't trap the user.
      setStep(5);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      contentStyle={{ paddingTop: 100 }}
      bg={colors.bg}
      edges={['left', 'right', 'bottom']}
    >
      <AuthHero height={100} style={{ top: 0 }} />
      <View style={logHeroStyles.headerOverlay}>
        <Header onBack={back} transparent />
      </View>
      {step <= 4 && (
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.lg }}>
          <ProgressDots total={4} current={step} />
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={[typography.h1, styles.titleSm]}>Log your dive</Text>
          <Text style={styles.sub}>Fill in the details — change anytime</Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>I dive / do</Text>
          <View style={styles.chipRow}>
            {DIVE_TYPES.map((d) => (
              <ChoiceChip key={d.id} label={d.label} selected={type === d.id} onPress={() => setType(d.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Date & time</Text>
          <View style={styles.row2}>
            <Input value={date} onChangeText={setDate} containerStyle={{ flex: 1 }} />
            <Input value={time} onChangeText={setTime} containerStyle={{ flex: 1 }} />
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Location</Text>
          <Pressable onPress={() => setSpotPickerOpen(true)} style={styles.spotPickerField}>
            <Text style={[typography.body, { color: spotPick ? colors.textPrimary : colors.textMuted, flex: 1 }]}>
              {spotPick ? spotPick.name : 'Select your spot'}
            </Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Size or type of group</Text>
          <View style={styles.chipRow}>
            {GROUP_SIZES.map((g) => (
              <ChoiceChip key={g} label={g} selected={group === g} onPress={() => setGroup(g)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Duration</Text>
          <Input placeholder="e.g 45 minutes" value={duration} onChangeText={setDuration} />
        </View>
      )}

      {step === 2 && type !== 'scuba' && (
        <View>
          <Text style={[typography.h1, styles.titleSm]}>{labelForType(type)}</Text>
          <Text style={styles.sub}>Step 2 of 4 — activity-specific details</Text>

          <View style={{ height: spacing.xl }} />
          <Input label="Max depth (ft)" placeholder="40" keyboardType="number-pad" value={depth} onChangeText={setDepth} />

          {/* ── Freediving Details — desktop section F1 ─────────────── */}
          {type === 'freedive' && (
            <>
              <SectionLabel>Discipline & Equalization</SectionLabel>
              <Text style={styles.label}>Discipline</Text>
              <View style={styles.chipRow}>
                {FREEDIVE_DISCIPLINES.map((d) => (
                  <ChoiceChip
                    key={d}
                    label={d}
                    selected={freediveDiscipline === d}
                    onPress={() => setFreediveDiscipline(d)}
                  />
                ))}
              </View>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Equalization</Text>
              <View style={styles.chipRow}>
                {FREEDIVE_EQUALIZATION.map((e) => (
                  <ChoiceChip
                    key={e}
                    label={e}
                    selected={freediveEqualization === e}
                    onPress={() => setFreediveEqualization(e)}
                  />
                ))}
              </View>

              <SectionLabel>Performance</SectionLabel>
              <Input
                label="Target depth (ft)"
                placeholder="50"
                keyboardType="number-pad"
                value={freediveTargetDepth}
                onChangeText={setFreediveTargetDepth}
              />
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  label="Breath-hold (mm:ss)"
                  placeholder="2:15"
                  value={freediveBreathHold}
                  onChangeText={setFreediveBreathHold}
                />
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  label="Attempts"
                  placeholder="3"
                  keyboardType="number-pad"
                  value={freediveAttempts}
                  onChangeText={setFreediveAttempts}
                />
              </View>

              <Pressable
                style={deepRowStyles.row}
                onPress={() => setFreediveSurfaceProtocolPass(!freediveSurfaceProtocolPass)}
              >
                <View style={[
                  deepRowStyles.check,
                  freediveSurfaceProtocolPass && deepRowStyles.checkOn,
                ]}>
                  {freediveSurfaceProtocolPass ? <Text style={deepRowStyles.checkMark}>✓</Text> : null}
                </View>
                <Text style={[typography.body, { flex: 1 }]}>
                  Surface protocol passed (clean recovery within 15s)
                </Text>
              </Pressable>
              <Pressable
                style={deepRowStyles.row}
                onPress={() => setFreediveSafetyOnDuty(!freediveSafetyOnDuty)}
              >
                <View style={[
                  deepRowStyles.check,
                  freediveSafetyOnDuty && deepRowStyles.checkOn,
                ]}>
                  {freediveSafetyOnDuty ? <Text style={deepRowStyles.checkMark}>✓</Text> : null}
                </View>
                <Text style={[typography.body, { flex: 1 }]}>
                  Safety diver on duty (strongly recommended for depth)
                </Text>
              </Pressable>
            </>
          )}

          {/* ── Spearfishing Details — desktop section S1 ───────────── */}
          {type === 'spear' && (
            <>
              <SectionLabel>Gear & Access</SectionLabel>
              <Text style={styles.label}>Gear</Text>
              <View style={styles.chipRow}>
                {SPEAR_GEAR_OPTIONS.map((g) => (
                  <ChoiceChip
                    key={g}
                    label={g}
                    selected={spearGear === g}
                    onPress={() => setSpearGear(g)}
                  />
                ))}
              </View>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Access</Text>
              <View style={styles.chipRow}>
                {SPEAR_ACCESS_OPTIONS.map((a) => (
                  <ChoiceChip
                    key={a}
                    label={a}
                    selected={spearAccessMode === a}
                    onPress={() => setSpearAccessMode(a)}
                  />
                ))}
              </View>

              <SectionLabel>Catch</SectionLabel>
              <Input
                label="Species landed (comma-separated)"
                placeholder="Uku, Kole"
                value={spearSpeciesLanded}
                onChangeText={setSpearSpeciesLanded}
              />
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  label="Total catch weight (lbs)"
                  placeholder="7"
                  keyboardType="number-pad"
                  value={spearCatchWeight}
                  onChangeText={setSpearCatchWeight}
                />
              </View>
              <Pressable
                style={deepRowStyles.row}
                onPress={() => setSpearStringerUsed(!spearStringerUsed)}
              >
                <View style={[
                  deepRowStyles.check,
                  spearStringerUsed && deepRowStyles.checkOn,
                ]}>
                  {spearStringerUsed ? <Text style={deepRowStyles.checkMark}>✓</Text> : null}
                </View>
                <Text style={[typography.body, { flex: 1 }]}>Stringer used</Text>
              </Pressable>
            </>
          )}

          {type === 'snorkel' && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Highlights" placeholder="Saw a turtle and reef sharks" />
            </>
          )}
        </View>
      )}

      {step === 2 && type === 'scuba' && (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={styles.divePill}>
              <Text style={styles.divePillText}>#{diveNumber}</Text>
            </View>
            <Text style={[typography.h1, styles.titleSm]}>Scuba details</Text>
          </View>
          <Text style={styles.sub}>Step 2 of 4 — comprehensive log</Text>

          {/* Auto-calculated summary (2x2) */}
          <View style={styles.summaryGrid}>
            <CalcCard label="Duration" value={duration ? duration : '—'} unit="min" />
            <CalcCard label="Air Used" value={scubaAirUsedPsi != null ? String(Math.round(scubaAirUsedPsi)) : '—'} unit="psi" />
            <CalcCard label="SAC Rate" value={scubaSacRate != null ? scubaSacRate.toFixed(2) : '—'} unit="ft³/min" />
            <CalcCard label="Surf. Interval" value={formatSurfaceInterval(surfaceIntervalMin)} unit="" />
          </View>

          {/* Sticky-style banner when official mode is on but required
              fields aren't filled. One-tap escape to turn it back off. */}
          {isOfficial && missingOfficialFields.length > 0 ? (
            <MissingFieldsBanner
              missing={missingOfficialFields}
              onTurnOff={() => setIsOfficial(false)}
            />
          ) : null}

          {/* Cert-eligibility toggle — when on, the dive counts toward
              AOW/Rescue/DM logbook hours per agency rules. See
              components/CertEligibilityBadge.tsx for the criteria.
              Mirrors desktop's OfficialToggle (LogDiveScreen.tsx:1465). */}
          <OfficialToggle value={isOfficial} onChange={setIsOfficial} />

          {/* Live eligibility readout — chips flip on as fields complete. */}
          <View style={{ marginTop: spacing.md }}>
            <CertEligibilityBadge
              dive={{
                isOfficial,
                verificationType,
                verifierName,
                verifierAgency,
                verifierCertNumber,
                verifierSignatureTyped,
                spot: spotPick?.name ?? spotPick?.id ?? '',
                depthMax: scubaMaxDepth,
                bottomTime: duration,
                gasMix: scubaGasMix,
                waterTemp: parseFloat(scubaTempSurface) || 0,
                visibility: parseFloat(scubaVis) || 0,
                buddy: scubaBuddy,
                scubaSubtypes,
              }}
            />
          </View>

          <SectionLabel>Dive Info</SectionLabel>
          <Text style={styles.label}>Dive Type (multi-select)</Text>
          <View style={styles.chipRow}>
            {SCUBA_SUB_TYPES.map((d) => (
              <ChoiceChip
                key={d.id}
                label={d.label}
                selected={scubaSubtypes.includes(d.id)}
                onPress={() => toggleSubtype(d.id)}
              />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: spacing.lg }]}>Entry Type</Text>
          <View style={styles.chipRow}>
            {ENTRY_TYPES.map((e) => (
              <ChoiceChip key={e.id} label={e.label} selected={scubaEntry === e.id} onPress={() => setScubaEntry(e.id)} />
            ))}
          </View>

          <SectionLabel>Depth & Conditions</SectionLabel>
          <NumberWithUnit
            label="Max Depth"
            value={scubaMaxDepth}
            onChange={setScubaMaxDepth}
            unit={scubaDepthUnit}
            onUnitChange={(u) => setScubaDepthUnit(u as DepthUnit)}
            options={['ft', 'm']}
            placeholder="40"
          />
          <NumberWithUnit
            label="Visibility"
            value={scubaVis}
            onChange={setScubaVis}
            unit={scubaVisUnit}
            onUnitChange={(u) => setScubaVisUnit(u as DepthUnit)}
            options={['ft', 'm']}
            placeholder="50"
          />
          <NumberWithUnit
            label="Water Temp Surface"
            value={scubaTempSurface}
            onChange={setScubaTempSurface}
            unit={scubaTempSurfaceUnit}
            onUnitChange={(u) => setScubaTempSurfaceUnit(u as TempUnit)}
            options={['F', 'C']}
            placeholder="79"
          />
          <NumberWithUnit
            label="Water Temp Bottom"
            value={scubaTempBottom}
            onChange={setScubaTempBottom}
            unit={scubaTempBottomUnit}
            onUnitChange={(u) => setScubaTempBottomUnit(u as TempUnit)}
            options={['F', 'C']}
            placeholder="74"
          />

          <SectionLabel>Tank & Gas</SectionLabel>
          <Text style={styles.label}>Gas Mix</Text>
          <View style={styles.chipRow}>
            {GAS_MIXES.map((g) => (
              <ChoiceChip key={g.id} label={g.label} selected={scubaGasMix === g.id} onPress={() => setScubaGasMix(g.id)} />
            ))}
          </View>
          {scubaGasMix !== 'air' && (
            <View style={{ marginTop: spacing.lg }}>
              <Input label="O₂ %" placeholder="32" keyboardType="numeric" value={scubaO2} onChangeText={setScubaO2} />
            </View>
          )}
          {scubaGasMix === 'trimix' && (
            <View style={{ marginTop: spacing.lg }}>
              <Input label="He %" placeholder="20" keyboardType="numeric" value={scubaHe} onChangeText={setScubaHe} />
            </View>
          )}
          <NumberWithUnit
            label="Start Pressure"
            value={scubaStartPressure}
            onChange={setScubaStartPressure}
            unit={scubaPressureUnit}
            onUnitChange={(u) => setScubaPressureUnit(u as PressureUnit)}
            options={['psi', 'bar']}
            placeholder="3000"
          />
          <NumberWithUnit
            label="End Pressure"
            value={scubaEndPressure}
            onChange={setScubaEndPressure}
            unit={scubaPressureUnit}
            onUnitChange={(u) => setScubaPressureUnit(u as PressureUnit)}
            options={['psi', 'bar']}
            placeholder="500"
          />
          <View style={{ marginTop: spacing.lg }}>
            <Input label="Tank Size" placeholder="80" keyboardType="numeric" value={scubaTankSize} onChangeText={setScubaTankSize} />
          </View>
          <Text style={[styles.label, { marginTop: spacing.lg }]}>Tank Unit</Text>
          <View style={styles.chipRow}>
            {TANK_UNITS.map((t) => (
              <ChoiceChip key={t.id} label={t.label} selected={scubaTankUnit === t.id} onPress={() => setScubaTankUnit(t.id)} />
            ))}
          </View>
          <CalcInlineRow label="Air Consumed" value={scubaAirUsedPsi != null ? `${Math.round(scubaAirUsedPsi)} psi` : '—'} />

          <SectionLabel>Safety Stop</SectionLabel>
          <NumberWithUnit
            label="Depth"
            value={scubaSafetyDepth}
            onChange={setScubaSafetyDepth}
            unit={scubaSafetyDepthUnit}
            onUnitChange={(u) => setScubaSafetyDepthUnit(u as DepthUnit)}
            options={['ft', 'm']}
            placeholder="15"
          />
          <View style={{ marginTop: spacing.lg }}>
            <Input label="Duration (min)" placeholder="3" keyboardType="numeric" value={scubaSafetyDuration} onChangeText={setScubaSafetyDuration} />
          </View>

          <SectionLabel>Equipment</SectionLabel>
          <NumberWithUnit
            label="Weight"
            value={scubaWeight}
            onChange={setScubaWeight}
            unit={scubaWeightUnit}
            onUnitChange={(u) => setScubaWeightUnit(u as WeightUnit)}
            options={['lbs', 'kg']}
            placeholder="14"
          />
          <Text style={[styles.label, { marginTop: spacing.lg }]}>Suit Type</Text>
          <View style={styles.chipRow}>
            {SUITS.map((s) => (
              <ChoiceChip key={s.id} label={s.label} selected={scubaSuit === s.id} onPress={() => setScubaSuit(s.id)} />
            ))}
          </View>
          {scubaSuit === 'wetsuit' && (
            <>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Wetsuit Thickness</Text>
              <View style={styles.chipRow}>
                {WETSUIT_THICKNESSES.map((w) => (
                  <ChoiceChip key={w.id} label={w.label} selected={scubaWetsuitThk === w.id} onPress={() => setScubaWetsuitThk(w.id)} />
                ))}
              </View>
            </>
          )}

          <SectionLabel>Buddy</SectionLabel>
          <Input label="Buddy Name" placeholder="Buddy's name" value={scubaBuddy} onChangeText={setScubaBuddy} />

          {/* Verification — required for cert credit. Mirrors desktop's
              VerificationBlock (LogDiveScreen.tsx:1579). Only renders when
              the user has chosen to log this dive as official. */}
          {isOfficial && (
            <>
              <SectionLabel>Verification</SectionLabel>
              <Text style={styles.sub}>Required for pro-level certifications (DM, Instructor)</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {VERIFICATION_OPTIONS.map((opt) => {
                  const selected = opt.value === verificationType;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setVerificationType(opt.value)}
                      style={[verifStyles.row, selected && verifStyles.rowActive]}
                    >
                      <View style={[verifStyles.radio, selected && verifStyles.radioActive]}>
                        {selected ? <View style={verifStyles.radioDot} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.body, { fontWeight: '600' }]}>{opt.label}</Text>
                        <Text style={{ ...typography.bodySm, color: colors.textMuted }}>{opt.sub}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {verificationType !== 'self' && (
                <>
                  <View style={{ marginTop: spacing.lg }}>
                    <Input
                      label={verificationType === 'instructor' ? 'Instructor name' : 'Buddy name (verifier)'}
                      placeholder="Full name"
                      value={verifierName}
                      onChangeText={setVerifierName}
                    />
                  </View>

                  {verificationType === 'instructor' && (
                    <>
                      <Text style={[styles.label, { marginTop: spacing.lg }]}>Agency</Text>
                      <View style={styles.chipRow}>
                        {AGENCY_OPTIONS.map((a) => (
                          <ChoiceChip
                            key={a}
                            label={a}
                            selected={verifierAgency === a}
                            onPress={() => setVerifierAgency(a)}
                          />
                        ))}
                      </View>
                      <View style={{ marginTop: spacing.lg }}>
                        <Input
                          label="Cert / member number"
                          placeholder="e.g. PADI 123456"
                          value={verifierCertNumber}
                          onChangeText={setVerifierCertNumber}
                        />
                      </View>
                    </>
                  )}

                  <View style={{ marginTop: spacing.lg }}>
                    <Input
                      label="Type verifier's name to acknowledge signature"
                      placeholder={verifierName || 'Full name'}
                      value={verifierSignatureTyped}
                      onChangeText={setVerifierSignatureTyped}
                    />
                  </View>
                </>
              )}
            </>
          )}

          {/* ── Night Dive Details — desktop section N1 ──────────────── */}
          {scubaSubtypes.includes('night') && (
            <>
              <SectionLabel>Night Dive Details</SectionLabel>
              <Text style={[styles.label]}>Light source</Text>
              <View style={styles.chipRow}>
                {NIGHT_LIGHT_OPTIONS.map((o) => (
                  <ChoiceChip
                    key={o}
                    label={o}
                    selected={nightLightSource === o}
                    onPress={() => setNightLightSource(o)}
                  />
                ))}
              </View>
              <Text style={[styles.label, { marginTop: spacing.lg }]}>Ambient light</Text>
              <View style={styles.chipRow}>
                {NIGHT_AMBIENT_OPTIONS.map((o) => (
                  <ChoiceChip
                    key={o}
                    label={o}
                    selected={nightAmbientLight === o}
                    onPress={() => setNightAmbientLight(o)}
                  />
                ))}
              </View>
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  label="Visibility at night (ft)"
                  placeholder="20"
                  keyboardType="number-pad"
                  value={nightVisibility}
                  onChangeText={setNightVisibility}
                />
              </View>
            </>
          )}

          {/* ── Deep Dive Details — desktop section D1.
                Triggers on the 'deep' subtype OR any dive past 60 ft, the
                PADI Deep-specialty threshold. ──────────────────────── */}
          {(scubaSubtypes.includes('deep') || Number(scubaMaxDepth) > 60) && (
            <>
              <SectionLabel>Deep Dive Details</SectionLabel>
              <Pressable
                style={deepRowStyles.row}
                onPress={() => setDeepConfirmedFromComputer(!deepConfirmedFromComputer)}
              >
                <View style={[
                  deepRowStyles.check,
                  deepConfirmedFromComputer && deepRowStyles.checkOn,
                ]}>
                  {deepConfirmedFromComputer ? <Text style={deepRowStyles.checkMark}>✓</Text> : null}
                </View>
                <Text style={[typography.body, { flex: 1 }]}>
                  Max depth confirmed from dive computer
                </Text>
              </Pressable>
              <Pressable
                style={deepRowStyles.row}
                onPress={() => setDeepNarcosisExperienced(!deepNarcosisExperienced)}
              >
                <View style={[
                  deepRowStyles.check,
                  deepNarcosisExperienced && deepRowStyles.checkOn,
                ]}>
                  {deepNarcosisExperienced ? <Text style={deepRowStyles.checkMark}>✓</Text> : null}
                </View>
                <Text style={[typography.body, { flex: 1 }]}>
                  Narcosis symptoms experienced
                </Text>
              </Pressable>
              {deepNarcosisExperienced && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.label}>Narcosis notes</Text>
                  <TextInput
                    placeholder="What did you experience? At what depth? How did you manage it?"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    value={deepNarcosisNotes}
                    onChangeText={setDeepNarcosisNotes}
                    style={styles.textarea}
                  />
                </View>
              )}
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.label}>Gas plan</Text>
                <TextInput
                  placeholder="e.g. Air to 100ft, EAN50 deco at 20ft"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  value={deepGasPlan}
                  onChangeText={setDeepGasPlan}
                  style={styles.textarea}
                />
              </View>
            </>
          )}
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={[typography.h1, styles.titleSm]}>Conditions</Text>
          <Text style={styles.sub}>Step 3 of 4 — help us validate the forecast</Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Visibility (ft)</Text>
          <Input placeholder="50" keyboardType="numeric" value={visibilityFt} onChangeText={setVisibilityFt} />

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Surface state</Text>
          <View style={styles.chipRow}>
            {SURFACE_STATES.map((s) => (
              <ChoiceChip key={s.id} label={s.label} selected={surfaceState === s.id} onPress={() => setSurfaceState(s.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Current strength</Text>
          <View style={styles.chipRow}>
            {CURRENT_STRENGTHS.map((c) => (
              <ChoiceChip key={c.id} label={c.label} selected={currentStrength === c.id} onPress={() => setCurrentStrength(c.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Current direction</Text>
          <View style={styles.chipRow}>
            {CURRENT_DIRECTIONS.map((c) => (
              <ChoiceChip key={c.id} label={c.label} selected={currentDirection === c.id} onPress={() => setCurrentDirection(c.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Water color</Text>
          <View style={styles.chipRow}>
            {WATER_COLORS.map((w) => (
              <ChoiceChip key={w.id} label={w.label} selected={waterColor === w.id} onPress={() => setWaterColor(w.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Particulate</Text>
          <View style={styles.chipRow}>
            {PARTICULATES.map((p) => (
              <ChoiceChip key={p.id} label={p.label} selected={particulate === p.id} onPress={() => setParticulate(p.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Surge at depth</Text>
          <View style={styles.chipRow}>
            {SURGES.map((s) => (
              <ChoiceChip key={s.id} label={s.label} selected={surgeAtDepth === s.id} onPress={() => setSurgeAtDepth(s.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Marine life activity</Text>
          <View style={styles.chipRow}>
            {MARINE_LIFE.map((m) => (
              <ChoiceChip key={m.id} label={m.label} selected={marineLifeActivity === m.id} onPress={() => setMarineLifeActivity(m.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Species seen</Text>
          <Text style={styles.helper}>Tap a category to pick the species you saw.</Text>
          <View style={styles.chipRow}>
            {SPECIES_CATEGORIES.map((c) => {
              const countSelected = c.species.filter((s) => speciesSeen.includes(s.id)).length;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSpeciesPickerCategory(c)}
                  style={[styles.categoryChip, countSelected > 0 && styles.categoryChipActive]}
                >
                  <Text style={styles.categoryChipEmoji}>{c.emoji}</Text>
                  <Text style={[styles.categoryChipText, countSelected > 0 && styles.categoryChipTextActive]}>
                    {c.label}
                  </Text>
                  {countSelected > 0 ? (
                    <View style={styles.categoryChipBadge}>
                      <Text style={styles.categoryChipBadgeText}>{countSelected}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {speciesSeen.length > 0 ? (
            <View style={[styles.chipRow, { marginTop: spacing.md }]}>
              {speciesSeen.map((sid) => {
                const meta = SPECIES_BY_ID.get(sid);
                if (!meta) return null;
                return (
                  <Pressable
                    key={sid}
                    onPress={() => setSpeciesSeen((prev) => prev.filter((x) => x !== sid))}
                    style={styles.selectedSpeciesChip}
                  >
                    <Text style={styles.selectedSpeciesText}>{meta.label}</Text>
                    <Text style={styles.selectedSpeciesX}>×</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Overall rating</Text>
          <View style={styles.chipRow}>
            {OVERALL_RATINGS.map((r) => (
              <ChoiceChip key={r.id} label={r.label} selected={overallRating === r.id} onPress={() => setOverallRating(r.id)} />
            ))}
          </View>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>vs Forecast</Text>
          <View style={styles.chipRow}>
            {FORECAST_ACCURACIES.map((f) => (
              <ChoiceChip key={f.id} label={f.label} selected={forecastAccuracy === f.id} onPress={() => setForecastAccuracy(f.id)} />
            ))}
          </View>

          {type !== 'scuba' && (
            <>
              <Text style={[styles.label, { marginTop: spacing.xl }]}>Water temp (°F)</Text>
              <Input placeholder="79" keyboardType="numeric" value={waterTemp} onChangeText={setWaterTemp} />
            </>
          )}

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Notes on conditions</Text>
          <TextInput
            placeholder="e.g. viz dropped from 60 ft to 15 ft below 40 ft"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            value={conditionsNotes}
            onChangeText={setConditionsNotes}
            style={styles.textareaSm}
          />

          <Pressable
            onPress={() => setHazardsExpanded((v) => !v)}
            style={styles.expandRow}
            hitSlop={8}
          >
            <Icon
              name={hazardsExpanded ? 'chevron-down' : 'chevron-right'}
              size={14}
              color={colors.accent}
            />
            <Text style={styles.expandLabel}>
              {hazardsExpanded ? 'Hide hazards' : 'Report a hazard'}
              {!hazardsExpanded && hazards.length > 0 ? ` (${hazards.length})` : ''}
            </Text>
          </Pressable>

          {hazardsExpanded && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.helperText}>
                Tap any that apply. Multi-select.
              </Text>
              <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
                {HAZARDS.map((h) => (
                  <ChoiceChip
                    key={h.id}
                    label={h.label}
                    selected={hazards.includes(h.id)}
                    onPress={() => toggleHazard(h.id)}
                  />
                ))}
              </View>
              {hazards.includes('other') && (
                <View style={{ marginTop: spacing.lg }}>
                  <Input
                    label="Describe"
                    placeholder="What happened?"
                    value={hazardsOther}
                    onChangeText={setHazardsOther}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={[typography.h1, styles.titleSm]}>Wrap-up</Text>
          <Text style={styles.sub}>Step 4 of 4 — share what made it special</Text>

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Notes</Text>
          <TextInput
            placeholder="Crystal clear today..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
            value={notes}
            onChangeText={setNotes}
            style={styles.textarea}
          />

          <Text style={[styles.label, { marginTop: spacing.xl }]}>Privacy</Text>
          <View style={styles.chipRow}>
            <ChoiceChip label="Public" selected />
            <ChoiceChip label="Friends" />
            <ChoiceChip label="Only me" />
          </View>

          {/* ── Rate the Dive — desktop section 07 ──────────────────── */}
          <SectionLabel>Rate the Dive</SectionLabel>
          <Text style={{ ...typography.caption, color: colors.textMuted, letterSpacing: 1 }}>
            OVERALL EXPERIENCE
          </Text>
          <View style={rateStyles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Pressable key={i} onPress={() => setRatingStars(i + 1)} hitSlop={6}>
                <Text style={[rateStyles.star, i < ratingStars && rateStyles.starOn]}>★</Text>
              </Pressable>
            ))}
          </View>
          {ratingStars > 0 ? (
            <Text style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: 4 }}>
              {ratingStars} of 5
            </Text>
          ) : null}

          <Text style={[styles.label, { marginTop: spacing.lg }]}>Would you recommend this spot?</Text>
          <View style={styles.chipRow}>
            {RECOMMEND_CHIPS.map((r) => (
              <ChoiceChip
                key={r}
                label={r}
                selected={recommend === r}
                onPress={() => setRecommend(r)}
              />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: spacing.lg }]}>Reef health observed</Text>
          <View style={styles.chipRow}>
            {REEF_HEALTH_CHIPS.map((h) => (
              <ChoiceChip
                key={h}
                label={h}
                selected={reefHealth === h}
                onPress={() => setReefHealth(h)}
              />
            ))}
          </View>
        </View>
      )}

      {step === 5 && (
        <View style={styles.successWrap}>
          <View style={styles.checkBubble}>
            <Icon name="check" size={42} color="#0a1626" />
          </View>
          <Text style={[typography.h1, { textAlign: 'center', marginTop: spacing.xl }]}>Dive logged!</Text>
          <Text style={[styles.sub, { textAlign: 'center', marginTop: spacing.sm }]}>
            Your dive has been added to your profile. Friends can see and react to your report.
          </Text>
          <View style={{ height: spacing.xxl }} />
          {submitResult?.communityOverlayUpdated && (
            <>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="eye" size={20} color={colors.excellent} />
                  <Text style={{ ...typography.bodySm, flex: 1 }}>
                    Your report just updated live conditions for this spot — divers
                    checking it right now will see what you saw.
                  </Text>
                </View>
              </Card>
              <View style={{ height: spacing.md }} />
            </>
          )}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={typography.body}>Share to feed</Text>
              <Icon name="check" size={20} color={colors.excellent} />
            </View>
          </Card>
        </View>
      )}

      <View style={{ height: spacing.xxxl }} />
      {step < 5 ? (
        <View style={styles.actions}>
          <Button label="Back" variant="ghost" iconLeft="chevron-left" onPress={back} />
          <Button
            label={step === 4 ? 'Submit dive' : 'Continue'}
            iconRight="arrow-right"
            loading={submitting}
            onPress={() => (step === 4 ? onSubmit() : next())}
          />
        </View>
      ) : (
        <Button label="Done" fullWidth onPress={() => nav.popToTop()} />
      )}

      <SpotPicker
        open={spotPickerOpen}
        value={spotPick}
        onClose={() => setSpotPickerOpen(false)}
        onSelect={(s) => {
          setSpotPick(s);
          setSpotPickerOpen(false);
        }}
      />

      <SpeciesPickerModal
        category={speciesPickerCategory}
        selected={speciesSeen}
        onChange={setSpeciesSeen}
        onClose={() => setSpeciesPickerCategory(null)}
      />
    </Screen>
  );
}

// Modal multi-select for species within one category. Selections in
// other categories are preserved — we only mutate this category's
// slice of the species id list.
function SpeciesPickerModal({
  category,
  selected,
  onChange,
  onClose,
}: {
  category: SpeciesCategory | null;
  selected: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}) {
  const visible = !!category;
  const toggle = (speciesId: string) => {
    if (selected.includes(speciesId)) {
      onChange(selected.filter((id) => id !== speciesId));
    } else {
      onChange([...selected, speciesId]);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {category?.emoji} {category?.label}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
            {category?.species.map((s) => {
              const isSelected = selected.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
                  style={[styles.speciesRow, isSelected && styles.speciesRowSelected]}
                >
                  <View style={[styles.speciesCheckbox, isSelected && styles.speciesCheckboxOn]}>
                    {isSelected ? <Text style={styles.speciesCheckmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.speciesLabel}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function labelForType(t: DiveType) {
  switch (t) {
    case 'scuba': return 'Scuba details';
    case 'freedive': return 'Freediving details';
    case 'spear': return 'Spearfishing details';
    case 'snorkel': return 'Snorkel details';
  }
}

// Section heading inside scuba step 2 — accent color, uppercase, micro
// label per spec, but uses the project's typography/spacing tokens so
// it harmonizes with the rest of the form.
function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

// "Make official" toggle — mirrors desktop's OfficialToggle in
// LogDiveScreen.tsx:1465. When on, the dive counts toward cert
// logbook requirements (AOW/Rescue/DM) per agency rules; the
// Verification block becomes required.
function OfficialToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[officialToggleStyles.row, value && officialToggleStyles.rowOn]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={officialToggleStyles.titleRow}>
          <Text style={officialToggleStyles.title}>Make official</Text>
          {value ? (
            <View style={officialToggleStyles.badge}>
              <Text style={officialToggleStyles.badgeText}>OFFICIAL · CERT-ELIGIBLE</Text>
            </View>
          ) : null}
        </View>
        <Text style={officialToggleStyles.sub}>
          {value
            ? 'Official logbook entry — all required fields must be completed before sign + publish.'
            : 'Cert-grade entry. Counts toward AOW, Rescue, DM, Instructor logbook requirements. Requires buddy or instructor verification before submit.'}
        </Text>
      </View>
      <View style={[officialToggleStyles.track, !value && officialToggleStyles.trackOff]}>
        <View style={[officialToggleStyles.thumb, !value && officialToggleStyles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const officialToggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginTop: spacing.lg,
  },
  rowOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  title: { ...typography.h3, fontSize: 15, color: colors.textPrimary },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  badgeText: { ...typography.caption, color: '#000', fontWeight: '800' },
  sub: { ...typography.bodySm, color: colors.textSecondary },
  track: {
    width: 40,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.accent,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  trackOff: { backgroundColor: colors.border, alignItems: 'flex-start' },
  thumb: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#fff' },
  thumbOff: { backgroundColor: colors.textMuted },
});

// Sticky-style banner shown above the form when "Make official" is on
// but required fields are missing. Mirrors desktop's MissingFieldsBanner
// (LogDiveScreen.tsx:1548).
function MissingFieldsBanner({
  missing,
  onTurnOff,
}: {
  missing: string[];
  onTurnOff: () => void;
}) {
  return (
    <View style={bannerStyles.row}>
      <Text style={bannerStyles.title}>
        ⚠ {missing.length} required field{missing.length === 1 ? '' : 's'} missing for official entry
      </Text>
      <View style={bannerStyles.list}>
        {missing.slice(0, 6).map((m) => (
          <Text key={m} style={bannerStyles.item}>· {m}</Text>
        ))}
        {missing.length > 6 ? (
          <Text style={bannerStyles.item}>· +{missing.length - 6} more</Text>
        ) : null}
      </View>
      <Pressable style={bannerStyles.btn} onPress={onTurnOff}>
        <Text style={bannerStyles.btnText}>Turn off "Make official"</Text>
      </Pressable>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  row: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warn,
    backgroundColor: colors.warnSoft,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  title: { ...typography.body, fontWeight: '700', color: colors.warn },
  list: { gap: 2 },
  item: { ...typography.bodySm, color: colors.textSecondary },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
});

const deepRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkMark: { color: '#000', fontWeight: '800', fontSize: 14 },
});

const rateStyles = StyleSheet.create({
  starsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  star: { fontSize: 36, color: colors.border },
  starOn: { color: colors.warn },
});

const verifStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.accent },
});

// 2x2 calc card. Re-uses the project's Card surface so it visually
// fits with step 1, but tints to accent so it reads as derived/locked.
function CalcCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.calcCard}>
      <Text style={styles.calcLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Text style={styles.calcValue}>{value}</Text>
        {unit ? <Text style={styles.calcUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

// Inline calc row — shown beneath an input group when one number falls
// out of the others (e.g., Air Consumed = start − end pressure).
function CalcInlineRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.calcInline}>
      <Text style={styles.calcInlineLabel}>{label}</Text>
      <Text style={styles.calcInlineValue}>{value}</Text>
    </View>
  );
}

// Number Input + paired unit toggle. Styled to match the other Inputs
// in the LogDive flow so it sits naturally in the form.
function NumberWithUnit({
  label,
  value,
  onChange,
  unit,
  onUnitChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  onUnitChange: (u: string) => void;
  options: [string, string];
  placeholder?: string;
}) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Input
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          containerStyle={{ flex: 1 }}
        />
        <View style={styles.unitToggle}>
          {options.map((o) => {
            const active = o === unit;
            return (
              <Pressable
                key={o}
                onPress={() => onUnitChange(o)}
                style={[styles.unitToggleBtn, active && styles.unitToggleBtnActive]}
              >
                <Text style={[styles.unitToggleText, active && styles.unitToggleTextActive]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const logHeroStyles = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

const styles = StyleSheet.create({
  titleSm: { fontSize: 22, lineHeight: 26 },
  spotPickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  label: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  helper: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },

  // Species picker — category chips + selected chips + modal.
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  categoryChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.card,
  },
  categoryChipEmoji: { fontSize: 16 },
  categoryChipText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: colors.textPrimary },
  categoryChipBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipBadgeText: { fontSize: 10, fontWeight: '800', color: colors.bg },
  selectedSpeciesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  selectedSpeciesText: { ...typography.bodySm, color: colors.bg, fontWeight: '600' },
  selectedSpeciesX: { ...typography.bodySm, color: colors.bg, fontWeight: '800', fontSize: 16, lineHeight: 16 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  modalCloseBtn: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  modalCloseText: { ...typography.body, color: colors.accent, fontWeight: '700' },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  speciesRowSelected: { backgroundColor: colors.cardAlt },
  speciesCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesCheckboxOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  speciesCheckmark: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  speciesLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  row2: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  textarea: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 140,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  textareaSm: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  expandLabel: { ...typography.bodySm, color: colors.accent, fontWeight: '600' },
  helperText: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.sm },
  successWrap: { alignItems: 'center', marginTop: spacing.xxxl },
  checkBubble: { width: 84, height: 84, borderRadius: 999, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  // Scuba step 2
  divePill: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  divePillText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  sectionLabel: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  calcCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  calcLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  calcValue: { color: colors.accent, fontSize: 22, fontWeight: '700' },
  calcUnit: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  calcInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  calcInlineLabel: { color: colors.textMuted, fontSize: 11 },
  calcInlineValue: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  unitToggleBtn: { paddingHorizontal: 14, justifyContent: 'center', minWidth: 48 },
  unitToggleBtnActive: { backgroundColor: colors.accentSoft },
  unitToggleText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  unitToggleTextActive: { color: colors.accent },
});
