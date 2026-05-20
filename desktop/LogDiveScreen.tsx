import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';

/**
 * Log Dive — desktop screen (Figma 459:1527).
 *
 * Layout:
 *   - DesktopNav (Log Dive active)
 *   - 2-col: left 380px (live preview card + Publish CTA — sticky in real
 *     life, static here) | right 860px (7-step form)
 *
 * The form is intentionally static visual scaffolding: text inputs, value
 * displays, chip groups, and a visibility "slider" are rendered for layout
 * fidelity only — interaction wiring (form state, validation, slider drag)
 * is a separate task per the spec's data-fetching boundary.
 */

// ─── Mock state (would be form state in real impl) ────────────────────────

const FORM = {
  diveType: 'Scuba',
  spot: 'Electric Beach',
  date: '04 / 15 / 2024',
  entryTime: '02 : 30 PM',
  exitTime: '03 : 28 PM',
  diveSiteType: 'Shore dive',
  depthMax: '—',
  bottomTime: '—',
  depthAvg: '—',
  visibility: 56,
  waterTemp: 79,
  airTemp: 82,
  currentStrength: 'None',
  surfaceConditions: 'Calm',
  surgeSwell: 'None',
  startPressure: 3000,
  endPressure: 500,
  gasMix: 'Air (21% O₂)',
  wetsuitThickness: '3mm full',
  weightUsed: 8,
  thermoclinePresent: false,
  marineLifeSelected: ['Green Turtle', 'Reef Fish'],
  ratingStars: 4,
  notes:
    "Crystal clear today — trades dropped out around noon and the outflow did its thing. Entry at the stairs was easy, viz opened up immediately. Saw a hawksbill at the cleaning station around 35ft, didn't spook. Current was nothing, tide window was perfect…",
};

const MARINE_LIFE_OPTIONS = [
  { emoji: '🐢', name: 'Green Turtle' },
  { emoji: '🦈', name: 'Reef Shark' },
  { emoji: '🐠', name: 'Reef Fish' },
  { emoji: '🦭', name: 'Monk Seal' },
  { emoji: '🐬', name: 'Dolphin' },
  { emoji: '🌊', name: 'Eagle Ray' },
  { emoji: '🐙', name: 'Octopus' },
  { emoji: '🐋', name: 'Humpback' },
  { emoji: '🦑', name: 'Squid' },
  { emoji: '🐍', name: 'Moray Eel' },
  { emoji: '🐡', name: 'Pufferfish' },
  { emoji: '🦞', name: 'Lobster' },
  { emoji: '🦀', name: 'Crab' },
  { emoji: '🐳', name: 'Whale' },
  { emoji: '🐟', name: 'Other' },
];

const CURRENT_CHIPS    = ['None', 'Mild', 'Moderate', 'Strong', 'Ripping'];
const SURFACE_CHIPS    = ['Calm', 'Light chop', 'Choppy', 'Rough'];
const SURGE_CHIPS      = ['None', 'Mild', 'Moderate', 'Strong'];
const RECOMMEND_CHIPS  = ['Definitely', 'Yes', 'With caveats', 'No'];
const REEF_HEALTH_CHIPS = ['Pristine', 'Healthy', 'Stressed', 'Bleached'];

const DIVE_TYPES = [
  { emoji: '🤿',  title: 'Scuba',         sub: 'Open or closed circuit' },
  { emoji: '🧜',  title: 'Freediving',    sub: 'Apnea / breath-hold' },
  { emoji: '🐠',  title: 'Snorkel',       sub: 'Surface observation' },
  { emoji: '🎣',  title: 'Spearfishing',  sub: 'Pole spear / speargun' },
];

// ─── Screen ───────────────────────────────────────────────────────────────

export interface LogDiveScreenProps {
  activeNav?: 'dashboard' | 'forecast' | 'spots' | 'log';
}

export function LogDiveScreen({ activeNav = 'log' }: LogDiveScreenProps) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} />

      <View style={styles.maxWidth}>
        <View style={styles.body}>
          <LeftPreview />
          <RightForm />
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Left: live preview ───────────────────────────────────────────────────

function LeftPreview() {
  return (
    <View style={styles.leftCol}>
      <Text style={styles.previewSectionLabel}>DIVE PREVIEW</Text>

      <View style={styles.previewCard}>
        {/* Header block */}
        <View style={styles.previewHeader}>
          <View style={styles.previewTypeChip}>
            <Text style={styles.previewTypeText}>🤿 {FORM.diveType}</Text>
          </View>
          <Text style={styles.previewSpot}>{FORM.spot}</Text>
          <Text style={styles.previewWhen}>Wed, Apr 15 · 2:30 PM</Text>
        </View>

        {/* Stat row */}
        <View style={styles.previewStatRow}>
          <PreviewStat label="Max Depth"   value={String(FORM.depthMax)}    unit="FT" />
          <PreviewStatDivider />
          <PreviewStat label="Bottom Time" value={String(FORM.bottomTime)}  unit="MIN" />
          <PreviewStatDivider />
          <PreviewStat label="Visibility"  value={String(FORM.visibility)}  unit="FT" highlight />
        </View>

        {/* Conditions list */}
        <View style={styles.previewConditions}>
          <PreviewRow label="Current"  value={FORM.currentStrength === 'None' ? 'Non-existent' : FORM.currentStrength} />
          <PreviewRow label="Surface"  value={FORM.surfaceConditions} />
          <PreviewRow label="Temp"     value={`${FORM.waterTemp}°F`} />
          <PreviewRow label="Wildlife" value={FORM.marineLifeSelected.join(' · ')} />
        </View>

        <View style={styles.previewFooter}>
          <Text style={styles.previewFooterText}>Today · No buddy set</Text>
        </View>
      </View>

      {/* Rating preview */}
      <View style={styles.ratingPreview}>
        <Text style={styles.ratingPreviewLabel}>OVERALL EXPERIENCE</Text>
        <View style={styles.starsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Text
              key={i}
              style={[styles.previewStar, i < FORM.ratingStars && styles.previewStarFilled]}
            >★</Text>
          ))}
        </View>
      </View>

      {/* Share toggle */}
      <View style={styles.shareToggleRow}>
        <View style={styles.shareToggleTextWrap}>
          <Text style={styles.shareToggleTitle}>Share to community</Text>
          <Text style={styles.shareToggleSub}>Visible to other divers at this spot</Text>
        </View>
        <View style={[styles.toggleTrack, styles.toggleTrackOn]}>
          <View style={[styles.toggleThumb, styles.toggleThumbOn]} />
        </View>
      </View>

      {/* Primary CTA */}
      <Pressable style={styles.publishBtn}>
        <Text style={styles.publishBtnIcon}>↑</Text>
        <Text style={styles.publishBtnText}>Publish dive log</Text>
      </Pressable>
      <Pressable style={styles.draftBtn}>
        <Text style={styles.draftBtnText}>Save as draft</Text>
      </Pressable>
    </View>
  );
}

function PreviewStat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.previewStat}>
      <Text style={styles.previewStatLabel}>{label}</Text>
      <View style={styles.previewStatValueRow}>
        <Text style={[styles.previewStatValue, highlight && styles.previewStatValueAccent]}>{value}</Text>
        <Text style={styles.previewStatUnit}>{unit}</Text>
      </View>
    </View>
  );
}
function PreviewStatDivider() {
  return <View style={styles.previewStatDivider} />;
}
function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewRowLabel}>{label}</Text>
      <Text style={styles.previewRowValue}>{value}</Text>
    </View>
  );
}

// ─── Right: 7-step form ───────────────────────────────────────────────────

function RightForm() {
  return (
    <View style={styles.rightCol}>
      <Section step="01" title="Where & When" subtitle="— spot, date, and time">
        <ComboField label="Dive spot" placeholder="Search 47 dive spots across Hawaii…" hint="↵ to select" value={FORM.spot} />
        <Row3>
          <NumericField label="Date" value={FORM.date} />
          <NumericField label="Entry time" value={FORM.entryTime} />
          <NumericField label="Exit time" value={FORM.exitTime} />
        </Row3>
        <Row2>
          <ComboField label="Buddy (optional)" placeholder="Search divers or add name…" value="" />
          <SelectField label="Dive site type" value={FORM.diveSiteType} />
        </Row2>
      </Section>

      <Section step="02" title="Dive Type">
        <View style={styles.diveTypeGrid}>
          {DIVE_TYPES.map((d) => {
            const selected = d.title === FORM.diveType;
            return (
              <View key={d.title} style={[styles.diveTypeTile, selected && styles.diveTypeTileSelected]}>
                <Text style={styles.diveTypeEmoji}>{d.emoji}</Text>
                <Text style={[styles.diveTypeTitle, selected && styles.diveTypeTitleSelected]}>{d.title}</Text>
                <Text style={styles.diveTypeSub}>{d.sub}</Text>
              </View>
            );
          })}
        </View>
      </Section>

      <Section step="03" title="Dive Stats">
        <Row3>
          <StepperField label="Max depth"   value={String(FORM.depthMax)}   unit="ft" />
          <StepperField label="Bottom time" value={String(FORM.bottomTime)} unit="min" />
          <StepperField label="Avg depth"   value={String(FORM.depthAvg)}   unit="ft" />
        </Row3>

        <SubSection title="Tank & gas">
          <Row3>
            <StepperField label="Start pressure" value={String(FORM.startPressure)} unit="psi" />
            <StepperField label="End pressure"   value={String(FORM.endPressure)}   unit="psi" />
            <SelectField  label="Gas mix"        value={FORM.gasMix} />
          </Row3>
          <Row2>
            <SelectField label="Wetsuit thickness" value={FORM.wetsuitThickness} />
            <StepperField label="Weight used"      value={String(FORM.weightUsed)} unit="lbs" />
          </Row2>
        </SubSection>
      </Section>

      <Section step="04" title="Conditions" subtitle="— what did you find down there?">
        <VisibilitySlider value={FORM.visibility} />

        <Row2>
          <StepperField label="Water temperature" value={String(FORM.waterTemp)} unit="°F" />
          <StepperField label="Air temperature"   value={String(FORM.airTemp)}   unit="°F" />
        </Row2>

        <ChipGroupField label="Current strength"    options={CURRENT_CHIPS}     value={FORM.currentStrength} />
        <ChipGroupField label="Surface conditions"  options={SURFACE_CHIPS}     value={FORM.surfaceConditions} />
        <ChipGroupField label="Surge / swell at depth" options={SURGE_CHIPS}    value={FORM.surgeSwell} />

        <View style={styles.thermoclineRow}>
          <View style={[styles.toggleTrack, !FORM.thermoclinePresent && styles.toggleTrackOff]}>
            <View style={[styles.toggleThumb, !FORM.thermoclinePresent && styles.toggleThumbOff]} />
          </View>
          <Text style={styles.thermoclineLabel}>No thermocline detected</Text>
        </View>
      </Section>

      <Section step="05" title="Marine Life" subtitle="— what did you see?">
        <View style={styles.marineGrid}>
          {MARINE_LIFE_OPTIONS.map((m) => {
            const selected = FORM.marineLifeSelected.includes(m.name);
            return (
              <View key={m.name} style={[styles.marineTile, selected && styles.marineTileSelected]}>
                <Text style={styles.marineEmoji}>{m.emoji}</Text>
                <Text style={[styles.marineName, selected && styles.marineNameSelected]}>{m.name}</Text>
              </View>
            );
          })}
        </View>

        <TextAreaField
          label="Sighting notes"
          placeholder="Describe anything notable — turtle cleaning station at 30ft, spinner pod of ~20 at the surface, giant trevally hunting at 40ft…"
        />
      </Section>

      <Section step="06" title="Notes & Photos">
        <TextAreaField label="Dive notes" value={FORM.notes} rows={6} />

        <View style={styles.photoDropzone}>
          <Text style={styles.photoDropIcon}>⬆</Text>
          <Text style={styles.photoDropTitle}>Drop photos here</Text>
          <Text style={styles.photoDropSub}>or click to browse · JPG / PNG / HEIC · up to 10MB each</Text>
        </View>
      </Section>

      <Section step="07" title="Rate the Dive">
        <View style={styles.bigStarsWrap}>
          <Text style={styles.bigStarsLabel}>OVERALL EXPERIENCE</Text>
          <View style={styles.bigStarsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Text
                key={i}
                style={[styles.bigStar, i < FORM.ratingStars && styles.bigStarFilled]}
              >★</Text>
            ))}
          </View>
          <Text style={styles.bigStarsCaption}>{FORM.ratingStars} of 5 — Great dive</Text>
        </View>

        <Row2>
          <ChipGroupField label="Would you recommend this spot?" options={RECOMMEND_CHIPS}  value="Definitely" />
          <ChipGroupField label="Reef health observed"           options={REEF_HEALTH_CHIPS} value="Healthy" />
        </Row2>
      </Section>
    </View>
  );
}

// ─── Field primitives ─────────────────────────────────────────────────────

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionStep}>{step}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      <View style={styles.subSectionBody}>{children}</View>
    </View>
  );
}

function Row3({ children }: { children: React.ReactNode }) {
  return <View style={styles.row3}>{children}</View>;
}
function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function ComboField({
  label,
  placeholder,
  hint,
  value,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  value?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldSearchIcon}>⌕</Text>
        <TextInput
          style={[styles.fieldInput, { outlineStyle: 'none' } as object]}
          placeholder={placeholder}
          placeholderTextColor={colors.text4}
          defaultValue={value}
        />
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function NumericField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldNumericValue}>{value}</Text>
        <Text style={styles.fieldCaret}>▾</Text>
      </View>
    </View>
  );
}

function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldSelectValue}>{value}</Text>
        <Text style={styles.fieldCaret}>▾</Text>
      </View>
    </View>
  );
}

function StepperField({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.stepperRow}>
        <View style={styles.stepperValueWrap}>
          <Text style={styles.stepperValue}>{value}</Text>
          <Text style={styles.stepperUnit}>{unit}</Text>
        </View>
        <View style={styles.stepperBtns}>
          <Pressable style={styles.stepperBtn}>
            <Text style={styles.stepperBtnText}>+</Text>
          </Pressable>
          <View style={styles.stepperDivider} />
          <Pressable style={styles.stepperBtn}>
            <Text style={styles.stepperBtnText}>−</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ChipGroupField({
  label,
  options,
  value,
}: {
  label: string;
  options: string[];
  value: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <View key={opt} style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TextAreaField({
  label,
  placeholder,
  value,
  rows = 4,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  rows?: number;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        style={[
          styles.textarea,
          { minHeight: rows * 22 + 24, outlineStyle: 'none' } as object,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.text4}
        defaultValue={value}
        multiline
      />
    </View>
  );
}

function VisibilitySlider({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const descriptor =
    value >= 50 ? 'Excellent visibility — 50+ ft is exceptional for Hawaii waters'
    : value >= 30 ? 'Clean — typical good Hawaii conditions'
    : value >= 15 ? 'Decent — some particulate'
    : 'Murky — limited sight';
  const descriptorColor =
    value >= 50 ? colors.excellent
    : value >= 30 ? colors.great
    : value >= 15 ? colors.good
    : colors.fair;

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>Underwater visibility</FieldLabel>
      <View style={styles.sliderRow}>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${pct}%` }]} />
          <View style={[styles.sliderHandle, { left: `${pct}%` }]} />
        </View>
        <View style={styles.sliderValueBox}>
          <Text style={styles.sliderValue}>{value}</Text>
          <Text style={styles.sliderUnit}>FT</Text>
        </View>
      </View>
      <View style={styles.sliderTickRow}>
        <Text style={styles.sliderTick}>0</Text>
        <Text style={styles.sliderTick}>100 FT</Text>
      </View>
      <View style={styles.sliderDescriptorRow}>
        <View style={[styles.sliderDescriptorDot, { backgroundColor: descriptorColor }]} />
        <Text style={styles.sliderDescriptorText}>{descriptor}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: DESKTOP_MAX_WIDTH },

  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 28,
    paddingVertical: 28,
    gap: 28,
  },

  // ── Left preview ──
  leftCol: {
    width: 323,
    gap: 16,
  },
  previewSectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  previewCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  previewHeader: {
    padding: 18,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  previewTypeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    height: 22,
    backgroundColor: colors.accentDim,
    borderRadius: 4,
    justifyContent: 'center',
  },
  previewTypeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  previewSpot: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  previewWhen: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  previewStatRow: {
    flexDirection: 'row',
    height: 80,
  },
  previewStat: {
    flex: 1,
    padding: 14,
    gap: 6,
    justifyContent: 'center',
  },
  previewStatDivider: {
    width: 1,
    backgroundColor: colors.hairline,
  },
  previewStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  previewStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  previewStatValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  previewStatValueAccent: {
    color: colors.accent,
  },
  previewStatUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  previewConditions: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  previewRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  previewRowLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  previewRowValue: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
  },
  previewFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  previewFooterText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },

  ratingPreview: {
    padding: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    gap: 8,
    alignItems: 'flex-start',
  },
  ratingPreviewLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  starsRow: { flexDirection: 'row', gap: 4 },
  previewStar: {
    fontSize: 18,
    color: colors.text4,
  },
  previewStarFilled: {
    color: colors.accent,
  },

  shareToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    gap: 14,
  },
  shareToggleTextWrap: { flex: 1, gap: 2 },
  shareToggleTitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  shareToggleSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    padding: 2,
  },
  toggleTrackOn: { backgroundColor: colors.accent },
  toggleTrackOff: { backgroundColor: colors.surface2 },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleThumbOff: { alignSelf: 'flex-start' },

  publishBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  publishBtnIcon: {
    fontSize: 16,
    color: colors.bg,
    fontWeight: '700',
  },
  publishBtnText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.bg,
  },
  draftBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
  },
  draftBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text2,
  },

  // ── Right form ──
  rightCol: {
    flex: 1,
    paddingHorizontal: 28,
    gap: 48,
  },
  section: {
    gap: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  sectionStep: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.text3,
    fontWeight: '600',
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text3,
  },
  sectionBody: { gap: 18 },

  subSection: {
    marginTop: 8,
    padding: 18,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    gap: 16,
  },
  subSectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  subSectionBody: { gap: 16 },

  row3: {
    flexDirection: 'row',
    gap: 12,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },

  // Field shell
  fieldWrap: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  fieldRow: {
    height: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
  },
  fieldSearchIcon: {
    fontSize: 13,
    color: colors.text3,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
  },
  fieldHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text4,
  },
  fieldNumericValue: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.text1,
    fontWeight: '500',
  },
  fieldSelectValue: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
  },
  fieldCaret: {
    fontSize: 11,
    color: colors.text3,
  },

  // Stepper
  stepperRow: {
    height: 64,
    flexDirection: 'row',
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  stepperValueWrap: {
    flex: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingTop: 18,
  },
  stepperValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  stepperUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  stepperBtns: {
    width: 45,
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  stepperBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text2,
  },
  stepperDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },

  // Dive type tiles
  diveTypeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  diveTypeTile: {
    flex: 1,
    height: 121,
    padding: 16,
    gap: 6,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
  },
  diveTypeTileSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  diveTypeEmoji: { fontSize: 28 },
  diveTypeTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text2,
    marginTop: 8,
  },
  diveTypeTitleSelected: {
    color: colors.text1,
  },
  diveTypeSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },

  // Slider
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  sliderHandle: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.accent,
    marginLeft: -10,
  },
  sliderValueBox: {
    width: 100,
    height: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 10,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
  },
  sliderValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
  },
  sliderUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  sliderTickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 114,
    marginTop: 8,
  },
  sliderTick: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text4,
  },
  sliderDescriptorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  sliderDescriptorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sliderDescriptorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  chipTextSelected: {
    color: colors.text1,
    fontWeight: '600',
  },

  // Thermocline
  thermoclineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  thermoclineLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },

  // Marine grid
  marineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  marineTile: {
    width: 'calc(20% - 7px)' as unknown as number,
    height: 75,
    padding: 8,
    gap: 4,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marineTileSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  marineEmoji: { fontSize: 22 },
  marineName: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.text2,
    textAlign: 'center',
  },
  marineNameSelected: {
    color: colors.text1,
    fontWeight: '600',
  },

  // Textarea
  textarea: {
    padding: 14,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text1,
  },

  // Photo dropzone
  photoDropzone: {
    height: 222,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoDropIcon: {
    fontSize: 32,
    color: colors.text3,
  },
  photoDropTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text1,
  },
  photoDropSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },

  // Big stars (Step 07)
  bigStarsWrap: {
    padding: 24,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 12,
  },
  bigStarsLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
  },
  bigStarsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bigStar: {
    fontSize: 38,
    color: colors.text4,
  },
  bigStarFilled: {
    color: colors.accent,
  },
  bigStarsCaption: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text2,
  },
});
