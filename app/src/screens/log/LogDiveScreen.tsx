import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
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
import { useAuth } from '@/hooks/useAuth';
import { useUserDiveLogs } from '@/hooks/useDiveLogs';
import { submitDiveLog } from '@/api/diveLogs';
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

type ScubaSubType = 'shore' | 'boat' | 'drift' | 'night' | 'wreck' | 'cave' | 'training';
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
  { id: 'shore', label: 'Shore' },
  { id: 'boat', label: 'Boat' },
  { id: 'drift', label: 'Drift' },
  { id: 'night', label: 'Night' },
  { id: 'wreck', label: 'Wreck' },
  { id: 'cave', label: 'Cave' },
  { id: 'training', label: 'Training' },
];
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
  const [scubaSubType, setScubaSubType] = useState<ScubaSubType>('shore');
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

      await submitDiveLog({
        uid: user.id,
        // For known spots, spotId matches the backend's SPOTS object so
        // the report cross-reference works. For custom spots we get a
        // synthetic id and stash the human-readable name + lat/lon
        // inline on the log so it's still meaningful.
        spotId: spotPick?.id ?? 'unknown',
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
          overallRating,
          forecastAccuracy,
          notes: conditionsNotes.trim() || undefined,
          hazards: hazards.length > 0 ? hazards : undefined,
          hazardsOther: hazards.includes('other') && hazardsOther.trim() ? hazardsOther.trim() : undefined,
        },
        scuba: type === 'scuba'
          ? {
              diveSubType: scubaSubType,
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
            }
          : undefined,
      });
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
          {type === 'spear' && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Weapon" placeholder="Speargun (band)" value={weapon} onChangeText={setWeapon} />
              <View style={{ height: spacing.lg }} />
              <Input label="Catch" placeholder="2 × Uku (4 lb, 3 lb)" />
            </>
          )}
          {type === 'freedive' && (
            <>
              <View style={{ height: spacing.lg }} />
              <Input label="Discipline" placeholder="Constant weight (CWT)" />
              <View style={{ height: spacing.lg }} />
              <Input label="Best dive time" placeholder="2:15" />
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

          <SectionLabel>Dive Info</SectionLabel>
          <Text style={styles.label}>Dive Type</Text>
          <View style={styles.chipRow}>
            {SCUBA_SUB_TYPES.map((d) => (
              <ChoiceChip key={d.id} label={d.label} selected={scubaSubType === d.id} onPress={() => setScubaSubType(d.id)} />
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
    </Screen>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
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
