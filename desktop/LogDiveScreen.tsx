import React from 'react';
import ReactDOM from 'react-dom';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Modal } from 'react-native';
import { SPECIES_CATEGORIES, SPECIES_BY_ID, type SpeciesCategory } from './data/marineLife';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from './components/maps/KaiCastMap';
import { CertEligibilityBadge } from './components/CertEligibilityBadge';
import { PhotoUpload } from './components/PhotoUpload';
import { useBreakpoint, pick } from './hooks/useBreakpoint';
import type { NavigateFn } from './router';

// Subset of known Hawaii dive spots — used by the Step 01 map picker.
// Clicking a pin sets form.spot to that name. Kept in lockstep with
// the SpotsMapScreen ISLANDS data; a future refactor could extract
// these into a shared module.
const PICKER_SPOTS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Electric Beach', lat: 21.3550, lng: -158.1220 },
  { name: "Shark's Cove",   lat: 21.6417, lng: -158.0617 },
  { name: 'Mokulua Islands',   lat: 21.6367, lng: -158.0633 },
  { name: 'Magic Island',   lat: 21.2840, lng: -157.8458 },
  { name: 'Hanauma Bay',    lat: 21.2694, lng: -157.6939 },
  { name: 'Molokini Crater', lat: 20.6330, lng: -156.4950 },
  { name: 'Honolua Bay',    lat: 21.0123, lng: -156.6398 },
  { name: 'Black Rock',     lat: 20.9333, lng: -156.6920 },
  { name: 'Kealakekua Bay', lat: 19.4791, lng: -155.9197 },
  { name: 'Two Step',       lat: 19.4187, lng: -155.9099 },
  { name: 'Tunnels Beach',  lat: 22.2233, lng: -159.5705 },
  { name: 'Poipu Beach',    lat: 21.8736, lng: -159.4537 },
];

/**
 * Log Dive — desktop screen (Figma 459:1527).
 *
 * Layout:
 *   - DesktopNav (Log Dive active)
 *   - 2-col: left 380px (live preview card + Publish CTA — sticky in real
 *     life, static here) | right 860px (7-step form)
 *
 * Form state is local React state (no Firestore wiring yet — the desktop
 * preview doesn't bundle Firebase). Publishing transitions to the success
 * view with whatever the user entered; persistence is a follow-up.
 */

// ─── Form state ───────────────────────────────────────────────────────────

/**
 * Form state.
 *
 * SCUBA-specific fields (everything under "// scuba: ...") only matter
 * when diveType === 'Scuba'. They power the cert-eligibility logic
 * (see components/CertEligibilityBadge.tsx) so a dive can count toward
 * PADI / SSI / NAUI / SDI advanced + pro-level certifications.
 *
 * Fields NOT yet captured here (flagged TODO for future passes):
 *  - Tank size/material, BCD/regulator model, entry/exit method
 *  - Wreck/Cave/Drift/Altitude/Ice conditional reveals (only Night +
 *    Deep are wired in v1; the others follow the same pattern)
 *  - Drawn signature pad + remote sign flow (typed name is the only
 *    signatureMethod for now; remote sign is the bigger UX project)
 *  - Auto-populated dive number + repetitive-dive surface interval
 *    (need Firestore query against the user's prior logs)
 *  - Dive computer profile upload + parsing
 */
type VerificationType = 'self' | 'buddy' | 'instructor';
export type AgencyOption = 'PADI' | 'SSI' | 'NAUI' | 'SDI' | 'RAID' | 'CMAS' | 'BSAC' | 'GUE' | 'TDI' | 'Other';
export type BuddyCertLevel = 'OW' | 'AOW' | 'Rescue' | 'DM' | 'Instructor' | 'Other';

interface FormState {
  diveType: string;
  spot: string;
  /** Optional GPS coords — set when the user picks a custom location via
   *  manual entry or by dropping a pin on the map. Null for spots picked
   *  from the canonical SPOTS list (the lat/lon there is the source of
   *  truth). Stored as strings so half-typed values like "-158." don't
   *  fight a numeric type during entry. */
  latitude: string | null;
  longitude: string | null;
  date: string;
  entryTime: string;
  exitTime: string;
  buddy: string;
  diveSiteType: string;
  depthMax: string;
  bottomTime: string;
  depthAvg: string;
  visibility: number;
  waterTemp: number;
  airTemp: number;
  currentStrength: string;
  surfaceConditions: string;
  surgeSwell: string;
  startPressure: number;
  endPressure: number;
  gasMix: string;
  wetsuitThickness: string;
  weightUsed: number;
  thermoclinePresent: boolean;
  /** Kebab-case species ids from desktop/data/marineLife.ts. Mirrors
   *  the mobile log dive — same ids land on the same diveLogs doc so
   *  the report-detail page renders identically on both surfaces. */
  speciesSeen: string[];
  sightingNotes: string;
  notes: string;
  /** Firebase Storage paths for photos uploaded against this draft.
   *  Populated by the PhotoUpload component during step 06 and passed
   *  through to submitDiveLog's `photos: string[]` payload. */
  photos: string[];
  ratingStars: number;
  recommend: string;
  reefHealth: string;
  shareToCommunity: boolean;

  // ── SCUBA-specific (cert-eligibility) ───────────────────────────

  /**
   * Top-level mode toggle. OFF (default) = casual log; ON = cert-grade
   * official entry. When ON, the form runs full validation against the
   * agency-canonical required-field set before allowing publish.
   * Casual dives never count toward any cert level.
   */
  isOfficial: boolean;

  scubaSubtypes: string[];       // multi-select of Boat/Shore/Drift/Night/Deep/Wreck/Cave/etc
  waterTempDepth: number;        // °F at depth (vs surface waterTemp above)
  surfaceInterval: number;       // minutes since previous dive — TODO autocompute from Firestore
  diveComputer: string;          // free text, e.g. "Shearwater Teric"

  // Verification — this is what makes a dive count for cert credit.
  verificationType: VerificationType;
  verifierName: string;
  verifierCertLevel: BuddyCertLevel;     // only used when verificationType === 'buddy'
  verifierAgency: AgencyOption;          // only used when verificationType === 'instructor'
  verifierCertNumber: string;
  verifierSignatureTyped: string;        // typed-name acknowledgment
  verificationDate: string;              // MM / DD / YYYY

  // Conditional reveals — populated only when the matching subtype is
  // selected. Other subtypes (Wreck/Cave/Drift/Altitude/Ice) follow
  // the same pattern but aren't wired yet.
  nightLightSource: string;
  nightAmbientLight: string;
  nightVisibility: number;

  deepConfirmedFromComputer: boolean;
  deepNarcosisExperienced: boolean;
  deepNarcosisNotes: string;
  deepGasPlan: string;

  // ── Tagged dive partners (any activity) ─────────────────────────
  // Replaces single-string `buddy` field. Each entry is either a
  // KaiCast user (uid set) or a free-text name (uid undefined).
  // The legacy `buddy` field is kept for back-compat and auto-syncs
  // to a comma-joined list of these names.
  taggedBuddies: TaggedBuddy[];

  // ── Freediving-specific (only when diveType === 'Freediving') ───
  freediveDiscipline: string;
  freediveTargetDepth: number;     // ft (or m, depending on user pref — ft for v1)
  freediveBreathHold: string;      // mm:ss text
  freediveAttempts: number;
  freediveSurfaceProtocolPass: boolean;
  freediveSafetyOnDuty: boolean;
  freediveEqualization: string;

  // ── Spearfishing-specific (only when diveType === 'Spearfishing')
  spearGear: string;
  spearSpeciesLanded: string;      // free text, comma-separated for v1
  spearCatchWeight: number;        // lbs
  spearStringerUsed: boolean;
  spearAccessMode: string;         // 'Shore' | 'Boat'
}

export interface TaggedBuddy {
  /** Defined when buddy is a KaiCast user. Undefined for free-text adds. */
  uid?: string;
  name: string;
}

// Blank-slate form for a brand-new dive entry. Today's date is filled
// at first render (todayString below); everything else is empty so the
// user is never staring at someone else's mock values when they sit
// down to log.
function todayString(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm} / ${dd} / ${d.getFullYear()}`;
}

const INITIAL_FORM: FormState = {
  diveType: 'Scuba',
  spot: '',
  latitude: null,
  longitude: null,
  date: todayString(),
  entryTime: '',
  exitTime: '',
  buddy: '',
  diveSiteType: 'Shore dive',
  depthMax: '',
  bottomTime: '',
  depthAvg: '',
  visibility: 0,
  waterTemp: 0,
  airTemp: 0,
  currentStrength: 'None',
  surfaceConditions: 'Calm',
  surgeSwell: 'None',
  startPressure: 0,
  endPressure: 0,
  gasMix: 'Air (21% O₂)',
  wetsuitThickness: '3mm full',
  weightUsed: 0,
  thermoclinePresent: false,
  speciesSeen: [],
  sightingNotes: '',
  notes: '',
  photos: [],
  ratingStars: 0,
  recommend: 'Definitely',
  reefHealth: 'Healthy',
  shareToCommunity: true,

  // SCUBA defaults — blank/safe initial state.
  isOfficial: false,
  scubaSubtypes: [],
  waterTempDepth: 0,
  surfaceInterval: 0,
  diveComputer: '',
  verificationType: 'self',
  verifierName: '',
  verifierCertLevel: 'OW',
  verifierAgency: 'PADI',
  verifierCertNumber: '',
  verifierSignatureTyped: '',
  verificationDate: todayString(),

  nightLightSource: 'Primary + backup',
  nightAmbientLight: 'New moon / dark',
  nightVisibility: 0,

  deepConfirmedFromComputer: false,
  deepNarcosisExperienced: false,
  deepNarcosisNotes: '',
  deepGasPlan: '',

  taggedBuddies: [],

  freediveDiscipline: 'Constant weight (CWT)',
  freediveTargetDepth: 0,
  freediveBreathHold: '',
  freediveAttempts: 1,
  freediveSurfaceProtocolPass: true,
  freediveSafetyOnDuty: false,
  freediveEqualization: 'Frenzel',

  spearGear: 'Pole spear',
  spearSpeciesLanded: '',
  spearCatchWeight: 0,
  spearStringerUsed: false,
  spearAccessMode: 'Shore',
};

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

// Mock community user list for buddy autocomplete. Real Firestore-
// backed user search is TODO — for now we suggest a curated set so
// the chips UI is usable in the preview.
const KNOWN_BUDDIES: ReadonlyArray<TaggedBuddy> = [
  { uid: 'u-kai',     name: 'Kai M.' },
  { uid: 'u-leilani', name: 'Leilani S.' },
  { uid: 'u-marcus',  name: 'Marcus H.' },
  { uid: 'u-alana',   name: 'Alana T.' },
  { uid: 'u-ryan',    name: 'Ryan P.' },
];

// Multi-select SCUBA dive subtype chips (Section 02 sub-block).
// Selecting Night reveals the night-specific block; Deep reveals the
// deep-specific block; the rest (Wreck/Cave/Drift/Altitude/Ice) are
// captured in the multi-select but their reveal blocks are flagged
// TODO — same shape as Night/Deep, just more fields.
const SCUBA_DIVE_SUBTYPES = [
  'Boat', 'Shore', 'Drift', 'Night', 'Deep', 'Wreck',
  'Cave', 'Cavern', 'Ice', 'Altitude', 'Reef', 'Wall',
  'Training', 'Search & Recovery',
] as const;

const AGENCY_OPTIONS: ReadonlyArray<AgencyOption> = [
  'PADI', 'SSI', 'NAUI', 'SDI', 'RAID', 'CMAS', 'BSAC', 'GUE', 'TDI', 'Other',
];
const BUDDY_CERT_LEVELS: ReadonlyArray<BuddyCertLevel> = [
  'OW', 'AOW', 'Rescue', 'DM', 'Instructor', 'Other',
];

const NIGHT_LIGHT_OPTIONS = [
  'Primary only', 'Primary + backup', 'Primary + backup + chemlight', 'Other',
];
const NIGHT_AMBIENT_OPTIONS = [
  'New moon / dark', 'Quarter moon', 'Half moon', 'Full moon', 'Dusk/dawn',
];

// Per-field option lists for cycling SelectFields (no real dropdowns yet —
// click cycles to the next option; predictable on a keyboard-less prototype).
const DIVE_SITE_TYPE_OPTIONS = [
  'Shore dive', 'Boat dive', 'Drift dive', 'Cavern', 'Wreck', 'Other',
];
const GAS_MIX_OPTIONS = [
  'Air (21% O₂)', 'EAN32 (32% O₂)', 'EAN36 (36% O₂)', 'Trimix', 'Pure O₂ (deco)', 'Other',
];
const WETSUIT_OPTIONS = [
  'None / rashguard', '1mm', '3mm shorty', '3mm full', '5mm full', '7mm full', 'Drysuit',
];

function cycle<T>(list: readonly T[], current: T): T {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}

const DIVE_TYPE_EMOJI: Record<string, string> = {
  Scuba: '🤿',
  Freediving: '🧜',
  Snorkel: '🐠',
  Spearfishing: '🎣',
};

function diveTypeWithEmoji(t: string): string {
  return `${DIVE_TYPE_EMOJI[t] ?? '🤿'} ${t}`;
}

// MARINE_LIFE_OPTIONS removed — the flat 15-tile grid was replaced with
// the category → species drill-down picker (SPECIES_CATEGORIES from
// ./data/marineLife.ts) so the same dive log doc renders identically
// on mobile and desktop.

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
  onNavigate?: NavigateFn;
}

export function LogDiveScreen({ activeNav = 'log', onNavigate }: LogDiveScreenProps) {
  const bp = useBreakpoint();
  const sidePad = pick(bp, 28, 16);
  const colGap = pick(bp, 28, 16);
  const leftColW = pick(bp, 323, 260);
  const [published, setPublished] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [draftSavedAt, setDraftSavedAt] = React.useState<number | null>(null);

  // Single update helper — every field accepts a key + value pair so we don't
  // hand each child a typed setter just to flip one property.
  const update = React.useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active={activeNav} onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        {published ? (
          <PublishedView
            form={form}
            onAnother={() => {
              setForm(INITIAL_FORM);
              setPublished(false);
            }}
            onNavigate={onNavigate}
          />
        ) : (
          <View style={[styles.body, { paddingHorizontal: sidePad, gap: colGap }]}>
            <View style={{ width: leftColW }}>
              <LeftPreview
                form={form}
                draftSavedAt={draftSavedAt}
                onPublish={() => setPublished(true)}
                onSaveDraft={() => setDraftSavedAt(Date.now())}
                onShareToggle={() => update('shareToCommunity', !form.shareToCommunity)}
              />
            </View>
            <RightForm form={form} update={update} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Post-publish success view ────────────────────────────────────────────

const PUBLISHED_DIVE = {
  id: 'd148',
  spot: 'Electric Beach',
  region: "O'AHU · LEEWARD COAST",
  diveType: '🤿 Scuba',
  date: 'Wed, Apr 15',
  time: '2:30 PM → 3:28 PM',
  // Realistic post-publish values (not the placeholder dashes from the form)
  depthFt: 68,
  durationMin: 58,
  vizFt: 56,
  waterTempF: 79,
  stars: 4,
  totalDives: 148, // bumped from 147 by this entry
};

const UNLOCKED_ACHIEVEMENT = {
  emoji: '👁',
  title: 'Glass-off',
  description: '60ft+ visibility logged · 1st time this month',
  tier: 'gold' as const,
};

const NOTIFICATIONS_SENT = [
  { initials: 'KM', name: 'Kai M.',     reason: 'follows Electric Beach' },
  { initials: 'RP', name: 'Ryan P.',    reason: 'follows you' },
  { initials: 'NO', name: 'Nina O.',    reason: 'follows Electric Beach' },
  { initials: 'LS', name: 'Leilani S.', reason: 'follows you' },
];

function PublishedView({
  form,
  onAnother,
  onNavigate,
}: {
  form: FormState;
  onAnother: () => void;
  onNavigate?: NavigateFn;
}) {
  return (
    <View style={styles.publishedRoot}>
      {/* Success hero */}
      <View style={styles.successHero}>
        <View style={styles.successCheckRing}>
          <View style={styles.successCheckCircle}>
            <Text style={styles.successCheckMark}>✓</Text>
          </View>
        </View>
        <Text style={styles.successHeadline}>Dive logged</Text>
        <Text style={styles.successSub}>
          {diveTypeWithEmoji(form.diveType)} at <Text style={styles.successSubAccent}>{form.spot}</Text> · {form.date} · {form.entryTime} → {form.exitTime}
        </Text>
        <Text style={styles.successTotal}>
          That's your <Text style={styles.successTotalAccent}>{PUBLISHED_DIVE.totalDives}th dive</Text> on KaiCast
        </Text>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryHeaderTitle}>Dive summary</Text>
          <Text style={styles.summaryHeaderId}>#{PUBLISHED_DIVE.id}</Text>
        </View>
        <View style={styles.summaryMetricsRow}>
          <SummaryMetric label="Max depth"  value={form.depthMax || '—'}     unit="FT" />
          <SummaryMetricDivider />
          <SummaryMetric label="Bottom time" value={form.bottomTime || '—'}   unit="MIN" />
          <SummaryMetricDivider />
          <SummaryMetric label="Visibility"  value={String(form.visibility)}  unit="FT" accent />
          <SummaryMetricDivider />
          <SummaryMetric label="Water temp"  value={String(form.waterTemp)}   unit="°F" />
          <SummaryMetricDivider />
          <View style={styles.summaryRatingWrap}>
            <Text style={styles.summaryMetricLabel}>RATING</Text>
            <View style={styles.summaryStarsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Text
                  key={i}
                  style={[styles.summaryStar, i < form.ratingStars && styles.summaryStarFilled]}
                >★</Text>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Two side-by-side cards: achievement + notifications */}
      <View style={styles.afterRow}>
        <View style={styles.achievementCard}>
          <View style={styles.achievementHeader}>
            <View style={styles.achievementPulseDot} />
            <Text style={styles.achievementHeaderText}>ACHIEVEMENT UNLOCKED</Text>
          </View>
          <View style={styles.achievementBody}>
            <Text style={styles.achievementEmoji}>{UNLOCKED_ACHIEVEMENT.emoji}</Text>
            <View style={styles.achievementTextWrap}>
              <Text style={styles.achievementTitle}>{UNLOCKED_ACHIEVEMENT.title}</Text>
              <Text style={styles.achievementDesc}>{UNLOCKED_ACHIEVEMENT.description}</Text>
            </View>
          </View>
          <Pressable style={styles.achievementShareBtn}>
            <Text style={styles.achievementShareText}>Share to feed</Text>
          </Pressable>
        </View>

        <View style={styles.notifyCard}>
          <View style={styles.notifyHeader}>
            <Text style={styles.notifyHeaderTitle}>Notifying {NOTIFICATIONS_SENT.length + 19} divers</Text>
            <Text style={styles.notifyHeaderSub}>23 friends follow this spot or follow you</Text>
          </View>
          <View style={styles.notifyAvatarRow}>
            {NOTIFICATIONS_SENT.map((n, i) => (
              <View
                key={n.name}
                style={[styles.notifyAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: NOTIFICATIONS_SENT.length - i }]}
              >
                <Text style={styles.notifyAvatarText}>{n.initials}</Text>
              </View>
            ))}
            <View style={[styles.notifyAvatarMore, { marginLeft: -10 }]}>
              <Text style={styles.notifyAvatarMoreText}>+19</Text>
            </View>
          </View>
          <View style={styles.notifyList}>
            {NOTIFICATIONS_SENT.slice(0, 3).map((n) => (
              <View key={n.name} style={styles.notifyRow}>
                <Text style={styles.notifyRowName}>{n.name}</Text>
                <Text style={styles.notifyRowReason}>{n.reason}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => onNavigate?.('spot-detail', { spotId: 'electric-beach' })}
        >
          <Text style={styles.actionBtnPrimaryIcon}>↗</Text>
          <Text style={styles.actionBtnPrimaryText}>View on spot page</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => onNavigate?.('my-dives')}
        >
          <Text style={styles.actionBtnText}>Open my dive log</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={onAnother}
        >
          <Text style={styles.actionBtnText}>Log another dive</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => onNavigate?.('dashboard')}
        >
          <Text style={styles.actionBtnText}>Return to dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryMetricLabel}>{label.toUpperCase()}</Text>
      <View style={styles.summaryMetricValueRow}>
        <Text style={[styles.summaryMetricValue, accent && styles.summaryMetricValueAccent]}>{value}</Text>
        <Text style={styles.summaryMetricUnit}>{unit}</Text>
      </View>
    </View>
  );
}
function SummaryMetricDivider() {
  return <View style={styles.summaryMetricDivider} />;
}

// ─── Left: live preview ───────────────────────────────────────────────────

function LeftPreview({
  form,
  draftSavedAt,
  onPublish,
  onSaveDraft,
  onShareToggle,
}: {
  form: FormState;
  draftSavedAt: number | null;
  onPublish: () => void;
  onSaveDraft: () => void;
  onShareToggle: () => void;
}) {
  const buddyText = form.buddy.trim() === '' ? 'No buddy set' : `with ${form.buddy.trim()}`;
  return (
    <View style={styles.leftCol}>
      <Text style={styles.previewSectionLabel}>DIVE PREVIEW</Text>

      <View style={styles.previewCard}>
        {/* Header block */}
        <View style={styles.previewHeader}>
          <View style={styles.previewTypeChip}>
            <Text style={styles.previewTypeText}>{diveTypeWithEmoji(form.diveType)}</Text>
          </View>
          <Text style={styles.previewSpot}>{form.spot}</Text>
          <Text style={styles.previewWhen}>{form.date} · {form.entryTime}</Text>
        </View>

        {/* Stat row */}
        <View style={styles.previewStatRow}>
          <PreviewStat label="Max Depth"   value={form.depthMax || '—'}     unit="FT" />
          <PreviewStatDivider />
          <PreviewStat label="Bottom Time" value={form.bottomTime || '—'}   unit="MIN" />
          <PreviewStatDivider />
          <PreviewStat label="Visibility"  value={String(form.visibility)}  unit="FT" highlight />
        </View>

        {/* Conditions list */}
        <View style={styles.previewConditions}>
          <PreviewRow label="Current"  value={form.currentStrength === 'None' ? 'Non-existent' : form.currentStrength} />
          <PreviewRow label="Surface"  value={form.surfaceConditions} />
          <PreviewRow label="Temp"     value={`${form.waterTemp}°F`} />
          <PreviewRow
            label="Wildlife"
            value={
              form.speciesSeen.length > 0
                ? form.speciesSeen
                    .map((id) => SPECIES_BY_ID.get(id)?.label ?? id)
                    .join(' · ')
                : '—'
            }
          />
        </View>

        <View style={styles.previewFooter}>
          <Text style={styles.previewFooterText}>Today · {buddyText}</Text>
        </View>
      </View>

      {/* Rating preview */}
      <View style={styles.ratingPreview}>
        <Text style={styles.ratingPreviewLabel}>OVERALL EXPERIENCE</Text>
        <View style={styles.starsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Text
              key={i}
              style={[styles.previewStar, i < form.ratingStars && styles.previewStarFilled]}
            >★</Text>
          ))}
        </View>
      </View>

      {/* Share toggle */}
      <Pressable style={styles.shareToggleRow} onPress={onShareToggle}>
        <View style={styles.shareToggleTextWrap}>
          <Text style={styles.shareToggleTitle}>Share to community</Text>
          <Text style={styles.shareToggleSub}>Visible to other divers at this spot</Text>
        </View>
        <View style={[styles.toggleTrack, !form.shareToCommunity && styles.toggleTrackOff]}>
          <View style={[styles.toggleThumb, !form.shareToCommunity && styles.toggleThumbOff]} />
        </View>
      </Pressable>

      {/* Cert-eligibility badge — official dives only. */}
      {form.diveType === 'Scuba' && form.isOfficial ? (
        <View style={styles.certBadgeWrap}>
          <Text style={styles.certBadgeLabel}>CERT ELIGIBILITY</Text>
          <CertEligibilityBadge
            dive={{
              isOfficial: form.isOfficial,
              verificationType: form.verificationType,
              verifierName: form.verifierName,
              verifierCertNumber: form.verifierCertNumber,
              verifierAgency: form.verifierAgency,
              verifierSignatureTyped: form.verifierSignatureTyped,
              spot: form.spot,
              depthMax: form.depthMax,
              bottomTime: form.bottomTime,
              gasMix: form.gasMix,
              waterTemp: form.waterTemp,
              visibility: form.visibility,
              buddy: form.buddy,
              scubaSubtypes: form.scubaSubtypes,
            }}
          />
        </View>
      ) : null}

      {/* Primary CTA — label flips to "Sign and publish" when official.
          Gate publishing on a minimum-viable dive log: spot is required
          for every dive, no exceptions. Without this the form silently
          accepts empty publishes that render as "—" everywhere in the
          PublishedView. Official-scuba has stricter validation handled
          separately by computeMissingOfficialFields. */}
      {(() => {
        const missingSpot = form.spot.trim() === '';
        return (
          <>
            <Pressable
              style={[styles.publishBtn, missingSpot && styles.publishBtnDisabled]}
              onPress={missingSpot ? undefined : onPublish}
              disabled={missingSpot}
            >
              <Text style={styles.publishBtnIcon}>↑</Text>
              <Text style={styles.publishBtnText}>
                {form.diveType === 'Scuba' && form.isOfficial ? 'Sign and publish' : 'Publish dive log'}
              </Text>
            </Pressable>
            {missingSpot ? (
              <Text style={styles.publishHint}>
                Pick a dive spot (or drop a pin) before publishing.
              </Text>
            ) : null}
          </>
        );
      })()}
      <Pressable style={styles.draftBtn} onPress={onSaveDraft}>
        <Text style={styles.draftBtnText}>
          {draftSavedAt ? 'Draft saved ✓' : 'Save as draft'}
        </Text>
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

// Modal-style multi-select for species within one category. Renders
// nothing when `category` is null (modal closed). Selections in other
// categories are preserved; we only mutate this category's slice.
function DesktopSpeciesPickerModal({
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
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.speciesModalBackdrop} onPress={onClose}>
        <Pressable style={styles.speciesModalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.speciesModalHeader}>
            <Text style={styles.speciesModalTitle}>
              {category?.emoji}  {category?.label}
            </Text>
            <Pressable onPress={onClose} style={styles.speciesModalCloseBtn}>
              <Text style={styles.speciesModalCloseText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.speciesModalScroll} contentContainerStyle={styles.speciesModalContent}>
            {category?.species.map((s) => {
              const isSelected = selected.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
                  style={[styles.speciesModalRow, isSelected && styles.speciesModalRowSelected]}
                >
                  <View style={[styles.speciesModalCheckbox, isSelected && styles.speciesModalCheckboxOn]}>
                    {isSelected ? <Text style={styles.speciesModalCheckmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.speciesModalLabel}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Right: 7-step form ───────────────────────────────────────────────────

type Update = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function RightForm({ form, update }: { form: FormState; update: Update }) {
  // Picker UI: tap a category chip to open a modal of species checkboxes
  // for that category. Selections persist across modal opens; the chip
  // shows a count badge so users see what they've already picked.
  const [speciesPickerCategory, setSpeciesPickerCategory] = React.useState<SpeciesCategory | null>(null);
  const setSpeciesSeen = (next: string[]) => update('speciesSeen', next);
  const removeSpecies = (id: string) => setSpeciesSeen(form.speciesSeen.filter((s) => s !== id));

  const ratingCaption =
    form.ratingStars >= 5 ? 'Personal best dive'
    : form.ratingStars >= 4 ? 'Great dive'
    : form.ratingStars >= 3 ? 'Good dive'
    : form.ratingStars >= 2 ? 'Okay dive'
    : form.ratingStars >= 1 ? 'Tough dive'
    : 'Not rated';

  const missingForOfficial = form.diveType === 'Scuba' && form.isOfficial
    ? computeMissingOfficialFields(form)
    : [];

  return (
    <View style={styles.rightCol}>
      {missingForOfficial.length > 0 ? (
        <MissingFieldsBanner
          missing={missingForOfficial}
          onTurnOff={() => update('isOfficial', false)}
        />
      ) : null}
      {form.diveType === 'Scuba' && form.isOfficial && missingForOfficial.length === 0 ? (
        <View style={styles.bannerReady}>
          <Text style={styles.bannerReadyText}>
            ✓ All required fields complete. Ready to sign and publish.
          </Text>
        </View>
      ) : null}
      <Section step="01" title="Where & When" subtitle="— spot, date, and time">
        <SpotPicker
          spotValue={form.spot}
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(spot, lat, lon) => {
            update('spot', spot);
            update('latitude', lat);
            update('longitude', lon);
          }}
        />
        <SpotMapPicker value={form.spot} onPick={(name) => update('spot', name)} />
        <Row3>
          <NumericField label="Date"       value={form.date}      onChange={(v) => update('date', v)} />
          <TimeField    label="Entry time" value={form.entryTime} onChange={(v) => update('entryTime', v)} />
          <TimeField    label="Exit time"  value={form.exitTime}  onChange={(v) => update('exitTime', v)} />
        </Row3>
        <BuddyChipsField
          value={form.taggedBuddies}
          onChange={(next) => {
            update('taggedBuddies', next);
            // Keep legacy `buddy` string in sync for cert-eligibility +
            // preview surfaces that still read the flat string field.
            update('buddy', next.map((b) => b.name).join(', '));
          }}
        />
        <SelectField
          label="Dive site type"
          value={form.diveSiteType}
          options={DIVE_SITE_TYPE_OPTIONS}
          onChange={(v) => update('diveSiteType', v)}
        />
      </Section>

      <Section step="02" title="Dive Type">
        <View style={styles.diveTypeGrid}>
          {DIVE_TYPES.map((d) => {
            const selected = d.title === form.diveType;
            return (
              <Pressable
                key={d.title}
                onPress={() => update('diveType', d.title)}
                style={[styles.diveTypeTile, selected && styles.diveTypeTileSelected]}
              >
                <Text style={styles.diveTypeEmoji}>{d.emoji}</Text>
                <Text style={[styles.diveTypeTitle, selected && styles.diveTypeTitleSelected]}>{d.title}</Text>
                <Text style={styles.diveTypeSub}>{d.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {form.diveType === 'Scuba' ? (
          <SubSection title="SCUBA subtype — pick all that apply">
            <View style={styles.chipGrid}>
              {SCUBA_DIVE_SUBTYPES.map((s) => {
                const selected = form.scubaSubtypes.includes(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      const next = selected
                        ? form.scubaSubtypes.filter((x) => x !== s)
                        : [...form.scubaSubtypes, s];
                      update('scubaSubtypes', next);
                    }}
                    style={[styles.scubaSubtypeChip, selected && styles.scubaSubtypeChipActive]}
                  >
                    <Text style={[styles.scubaSubtypeText, selected && styles.scubaSubtypeTextActive]}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SubSection>
        ) : null}

        {form.diveType === 'Scuba' ? (
          <OfficialToggle
            value={form.isOfficial}
            onChange={(v) => update('isOfficial', v)}
          />
        ) : null}
      </Section>

      <Section step="03" title="Dive Stats">
        <Row3>
          <StepperField label="Max depth"   value={Number(form.depthMax)   || 0} unit="ft"  onChange={(v) => update('depthMax',   String(v))} min={0} />
          <StepperField label="Bottom time" value={Number(form.bottomTime) || 0} unit="min" onChange={(v) => update('bottomTime', String(v))} min={0} />
          <StepperField label="Avg depth"   value={Number(form.depthAvg)   || 0} unit="ft"  onChange={(v) => update('depthAvg',   String(v))} min={0} />
        </Row3>

        {form.diveType === 'Scuba' ? (
          <SubSection title="Tank & gas">
            <Row3>
              <StepperField label="Start pressure" value={form.startPressure} unit="psi" onChange={(v) => update('startPressure', v)} step={100} min={0} />
              <StepperField label="End pressure"   value={form.endPressure}   unit="psi" onChange={(v) => update('endPressure',   v)} step={100} min={0} />
              <SelectField  label="Gas mix"        value={form.gasMix}        options={GAS_MIX_OPTIONS} onChange={(v) => update('gasMix', v)} />
            </Row3>
            <Row2>
              <SelectField  label="Wetsuit thickness" value={form.wetsuitThickness} options={WETSUIT_OPTIONS} onChange={(v) => update('wetsuitThickness', v)} />
              <StepperField label="Weight used"       value={form.weightUsed} unit="lbs" onChange={(v) => update('weightUsed', v)} min={0} typeable={false} />
            </Row2>
          </SubSection>
        ) : (
          // Freediving / Snorkel / Spearfishing — no tank, but still
          // capture exposure suit + weights for honest dive logging.
          <SubSection title="Exposure">
            <Row2>
              <SelectField  label="Wetsuit thickness" value={form.wetsuitThickness} options={WETSUIT_OPTIONS} onChange={(v) => update('wetsuitThickness', v)} />
              <StepperField label="Weight used"       value={form.weightUsed} unit="lbs" onChange={(v) => update('weightUsed', v)} min={0} typeable={false} />
            </Row2>
          </SubSection>
        )}
      </Section>

      <Section step="04" title="Conditions" subtitle="— what did you find down there?">
        <VisibilitySlider value={form.visibility} onChange={(v) => update('visibility', v)} />

        <Row2>
          <StepperField label="Water temperature" value={form.waterTemp} unit="°F" onChange={(v) => update('waterTemp', v)} />
          <StepperField label="Air temperature"   value={form.airTemp}   unit="°F" onChange={(v) => update('airTemp',   v)} />
        </Row2>

        <ChipGroupField label="Current strength"        options={CURRENT_CHIPS} value={form.currentStrength}    onChange={(v) => update('currentStrength',    v)} />
        <ChipGroupField label="Surface conditions"      options={SURFACE_CHIPS} value={form.surfaceConditions}  onChange={(v) => update('surfaceConditions',  v)} />
        <ChipGroupField label="Surge / swell at depth"  options={SURGE_CHIPS}   value={form.surgeSwell}         onChange={(v) => update('surgeSwell',         v)} />

        <Pressable
          style={styles.thermoclineRow}
          onPress={() => update('thermoclinePresent', !form.thermoclinePresent)}
        >
          <View style={[styles.toggleTrack, !form.thermoclinePresent && styles.toggleTrackOff]}>
            <View style={[styles.toggleThumb, !form.thermoclinePresent && styles.toggleThumbOff]} />
          </View>
          <Text style={styles.thermoclineLabel}>
            {form.thermoclinePresent ? 'Thermocline detected' : 'No thermocline detected'}
          </Text>
        </Pressable>

        {form.diveType === 'Scuba' ? (
          <SubSection title="At-depth water temperature">
            <Row2>
              <StepperField
                label="Water temp at depth"
                value={form.waterTempDepth}
                unit="°F"
                onChange={(v) => update('waterTempDepth', v)}
              />
              <NumericField
                label="Dive computer"
                value={form.diveComputer}
                onChange={(v) => update('diveComputer', v)}
              />
            </Row2>
          </SubSection>
        ) : null}
      </Section>

      {form.diveType === 'Scuba' && form.scubaSubtypes.includes('Night') ? (
        <Section step="N1" title="Night Dive Details" subtitle="— specialty-dive specifics">
          <Row2>
            <SelectField
              label="Light source"
              value={form.nightLightSource}
              options={NIGHT_LIGHT_OPTIONS}
              onChange={(v) => update('nightLightSource', v)}
            />
            <SelectField
              label="Ambient light"
              value={form.nightAmbientLight}
              options={NIGHT_AMBIENT_OPTIONS}
              onChange={(v) => update('nightAmbientLight', v)}
            />
          </Row2>
          <Row2>
            <StepperField
              label="Visibility (night)"
              value={form.nightVisibility}
              unit="ft"
              onChange={(v) => update('nightVisibility', v)}
              min={0}
            />
            <View />
          </Row2>
        </Section>
      ) : null}

      {form.diveType === 'Scuba' &&
       (form.scubaSubtypes.includes('Deep') || Number(form.depthMax) > 60) ? (
        <Section step="D1" title="Deep Dive Details" subtitle="— required for deep specialty">
          <Pressable
            style={styles.thermoclineRow}
            onPress={() => update('deepConfirmedFromComputer', !form.deepConfirmedFromComputer)}
          >
            <View style={[styles.toggleTrack, !form.deepConfirmedFromComputer && styles.toggleTrackOff]}>
              <View style={[styles.toggleThumb, !form.deepConfirmedFromComputer && styles.toggleThumbOff]} />
            </View>
            <Text style={styles.thermoclineLabel}>
              Max depth confirmed from dive computer
            </Text>
          </Pressable>
          <Pressable
            style={styles.thermoclineRow}
            onPress={() => update('deepNarcosisExperienced', !form.deepNarcosisExperienced)}
          >
            <View style={[styles.toggleTrack, !form.deepNarcosisExperienced && styles.toggleTrackOff]}>
              <View style={[styles.toggleThumb, !form.deepNarcosisExperienced && styles.toggleThumbOff]} />
            </View>
            <Text style={styles.thermoclineLabel}>
              Narcosis symptoms experienced
            </Text>
          </Pressable>
          {form.deepNarcosisExperienced ? (
            <TextAreaField
              label="Narcosis notes"
              placeholder="What did you experience? At what depth? How did you manage it?"
              value={form.deepNarcosisNotes}
              onChange={(v) => update('deepNarcosisNotes', v)}
            />
          ) : null}
          <TextAreaField
            label="Gas plan"
            placeholder="e.g. Air to 100ft, EAN50 deco at 20ft"
            value={form.deepGasPlan}
            onChange={(v) => update('deepGasPlan', v)}
          />
        </Section>
      ) : null}

      {form.diveType === 'Scuba' && form.isOfficial ? (
        <VerificationBlock form={form} update={update} />
      ) : null}

      {form.diveType === 'Freediving' ? (
        <Section step="F1" title="Freediving Details" subtitle="— discipline + breath-hold metrics">
          <Row2>
            <SelectField
              label="Discipline"
              value={form.freediveDiscipline}
              options={FREEDIVE_DISCIPLINES}
              onChange={(v) => update('freediveDiscipline', v)}
            />
            <SelectField
              label="Equalization"
              value={form.freediveEqualization}
              options={FREEDIVE_EQUALIZATION}
              onChange={(v) => update('freediveEqualization', v)}
            />
          </Row2>
          <Row3>
            <StepperField
              label="Target depth"
              value={form.freediveTargetDepth}
              unit="ft"
              onChange={(v) => update('freediveTargetDepth', v)}
              min={0}
            />
            <NumericField
              label="Breath-hold (mm:ss)"
              value={form.freediveBreathHold}
              onChange={(v) => update('freediveBreathHold', v)}
            />
            <StepperField
              label="Attempts"
              value={form.freediveAttempts}
              unit=""
              onChange={(v) => update('freediveAttempts', v)}
              min={1}
            />
          </Row3>
          <Pressable
            style={styles.thermoclineRow}
            onPress={() => update('freediveSurfaceProtocolPass', !form.freediveSurfaceProtocolPass)}
          >
            <View style={[styles.toggleTrack, !form.freediveSurfaceProtocolPass && styles.toggleTrackOff]}>
              <View style={[styles.toggleThumb, !form.freediveSurfaceProtocolPass && styles.toggleThumbOff]} />
            </View>
            <Text style={styles.thermoclineLabel}>
              Surface protocol passed (clean recovery within 15s)
            </Text>
          </Pressable>
          <Pressable
            style={styles.thermoclineRow}
            onPress={() => update('freediveSafetyOnDuty', !form.freediveSafetyOnDuty)}
          >
            <View style={[styles.toggleTrack, !form.freediveSafetyOnDuty && styles.toggleTrackOff]}>
              <View style={[styles.toggleThumb, !form.freediveSafetyOnDuty && styles.toggleThumbOff]} />
            </View>
            <Text style={styles.thermoclineLabel}>
              Safety diver on duty (strongly recommended for depth)
            </Text>
          </Pressable>
        </Section>
      ) : null}

      {form.diveType === 'Spearfishing' ? (
        <Section step="S1" title="Spearfishing Details" subtitle="— gear, catch, access">
          <Row2>
            <SelectField
              label="Gear"
              value={form.spearGear}
              options={SPEAR_GEAR_OPTIONS}
              onChange={(v) => update('spearGear', v)}
            />
            <SelectField
              label="Access"
              value={form.spearAccessMode}
              options={SPEAR_ACCESS_OPTIONS}
              onChange={(v) => update('spearAccessMode', v)}
            />
          </Row2>
          <NumericField
            label="Species landed (comma-separated)"
            value={form.spearSpeciesLanded}
            onChange={(v) => update('spearSpeciesLanded', v)}
          />
          <Row2>
            <StepperField
              label="Total catch"
              value={form.spearCatchWeight}
              unit="lbs"
              onChange={(v) => update('spearCatchWeight', v)}
              min={0}
            />
            <Pressable
              style={styles.thermoclineRow}
              onPress={() => update('spearStringerUsed', !form.spearStringerUsed)}
            >
              <View style={[styles.toggleTrack, !form.spearStringerUsed && styles.toggleTrackOff]}>
                <View style={[styles.toggleThumb, !form.spearStringerUsed && styles.toggleThumbOff]} />
              </View>
              <Text style={styles.thermoclineLabel}>Stringer used</Text>
            </Pressable>
          </Row2>
        </Section>
      ) : null}

      <Section step="05" title="Marine Life" subtitle="— what did you see?">
        <Text style={styles.speciesHelper}>Tap a category to pick the species you saw.</Text>
        <View style={styles.speciesCategoryRow}>
          {SPECIES_CATEGORIES.map((c) => {
            const count = c.species.filter((s) => form.speciesSeen.includes(s.id)).length;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSpeciesPickerCategory(c)}
                style={[styles.speciesCategoryChip, count > 0 && styles.speciesCategoryChipActive]}
              >
                <Text style={styles.speciesCategoryEmoji}>{c.emoji}</Text>
                <Text style={[styles.speciesCategoryText, count > 0 && styles.speciesCategoryTextActive]}>
                  {c.label}
                </Text>
                {count > 0 ? (
                  <View style={styles.speciesCategoryBadge}>
                    <Text style={styles.speciesCategoryBadgeText}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {form.speciesSeen.length > 0 ? (
          <View style={styles.selectedSpeciesRow}>
            {form.speciesSeen.map((id) => {
              const meta = SPECIES_BY_ID.get(id);
              if (!meta) return null;
              return (
                <Pressable key={id} onPress={() => removeSpecies(id)} style={styles.selectedSpeciesChip}>
                  <Text style={styles.selectedSpeciesText}>{meta.label}</Text>
                  <Text style={styles.selectedSpeciesX}>×</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <DesktopSpeciesPickerModal
          category={speciesPickerCategory}
          selected={form.speciesSeen}
          onChange={setSpeciesSeen}
          onClose={() => setSpeciesPickerCategory(null)}
        />

        <TextAreaField
          label="Sighting notes"
          placeholder="Describe anything notable — turtle cleaning station at 30ft, spinner pod of ~20 at the surface, giant trevally hunting at 40ft…"
          value={form.sightingNotes}
          onChange={(v) => update('sightingNotes', v)}
        />
      </Section>

      <Section step="06" title="Notes & Photos">
        <TextAreaField
          label="Dive notes"
          value={form.notes}
          onChange={(v) => update('notes', v)}
          rows={6}
        />

        <PhotoUpload
          initialPaths={form.photos}
          onPathsChange={(paths) => update('photos', paths)}
        />
      </Section>

      <Section step="07" title="Rate the Dive">
        <View style={styles.bigStarsWrap}>
          <Text style={styles.bigStarsLabel}>OVERALL EXPERIENCE</Text>
          <View style={styles.bigStarsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Pressable key={i} onPress={() => update('ratingStars', i + 1)}>
                <Text style={[styles.bigStar, i < form.ratingStars && styles.bigStarFilled]}>★</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.bigStarsCaption}>{form.ratingStars} of 5 — {ratingCaption}</Text>
        </View>

        <Row2>
          <ChipGroupField label="Would you recommend this spot?" options={RECOMMEND_CHIPS}   value={form.recommend}  onChange={(v) => update('recommend',  v)} />
          <ChipGroupField label="Reef health observed"           options={REEF_HEALTH_CHIPS} value={form.reefHealth} onChange={(v) => update('reefHealth', v)} />
        </Row2>
      </Section>
    </View>
  );
}

// ─── Spot map picker (Step 01) ────────────────────────────────────────────

/**
 * Collapsible Mapbox picker beneath the Dive spot combo field.
 * Clicking a pin sets the form.spot value to that spot's name; the
 * map and combo stay in sync via the shared selection.
 */
function SpotMapPicker({ value, onPick }: { value: string; onPick: (name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const markers: MapMarker[] = React.useMemo(
    () => PICKER_SPOTS.map((s) => ({ id: s.name, lng: s.lng, lat: s.lat })),
    [],
  );
  const selected = PICKER_SPOTS.find((s) => s.name === value);
  const center: [number, number] = selected ? [selected.lng, selected.lat] : HAWAII_CENTER;
  const zoom = selected ? 9.5 : HAWAII_ZOOM;
  return (
    <View style={styles.spotPickerWrap}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.spotPickerToggle}>
        <Text style={styles.spotPickerToggleIcon}>{open ? '−' : '+'}</Text>
        <Text style={styles.spotPickerToggleText}>
          {open ? 'Hide map' : 'Pick on map'}
        </Text>
        <View style={styles.spotPickerToggleSpacer} />
        <Text style={styles.spotPickerToggleHint}>
          {selected ? `Selected: ${selected.name}` : 'No spot selected'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.spotPickerMap}>
          <KaiCastMap
            markers={markers}
            center={center}
            zoom={zoom}
            selectedId={selected?.name}
            onMarkerClick={onPick}
            showZoomControls
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Buddy chips (tag dive partners) ────────────────────────────────────

/**
 * Multi-buddy chip input. Suggests names from KNOWN_BUDDIES (a mock
 * KaiCast user list) as the user types; pressing Enter on a non-match
 * adds the typed string as a free-text buddy. Real Firestore-backed
 * user search is TODO.
 */
function BuddyChipsField({
  value,
  onChange,
}: {
  value: TaggedBuddy[];
  onChange: (next: TaggedBuddy[]) => void;
}) {
  const [draft, setDraft] = React.useState('');
  const matches = React.useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return KNOWN_BUDDIES.filter(
      (b) =>
        b.name.toLowerCase().includes(q) &&
        !value.some((v) => v.name.toLowerCase() === b.name.toLowerCase()),
    ).slice(0, 5);
  }, [draft, value]);

  const addBuddy = (b: TaggedBuddy) => {
    if (!b.name.trim()) return;
    if (value.some((v) => v.name.toLowerCase() === b.name.toLowerCase())) return;
    onChange([...value, b]);
    setDraft('');
  };
  const removeBuddy = (name: string) => {
    onChange(value.filter((v) => v.name !== name));
  };

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>Dive partners (optional)</FieldLabel>

      {value.length > 0 ? (
        <View style={styles.buddyChipsRow}>
          {value.map((b) => (
            <View key={b.name} style={styles.buddyChip}>
              {b.uid ? <Text style={styles.buddyChipUser}>@</Text> : null}
              <Text style={styles.buddyChipText}>{b.name}</Text>
              <Pressable onPress={() => removeBuddy(b.name)} hitSlop={8}>
                <Text style={styles.buddyChipX}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.buddyInputWrap}>
        <TextInput
          style={[styles.fieldNumericInput, { outlineStyle: 'none' } as object]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Search KaiCast users or type a name"
          placeholderTextColor={colors.text4}
          onSubmitEditing={() => addBuddy({ name: draft.trim() })}
          returnKeyType="done"
        />
        {matches.length > 0 ? (
          <View style={styles.buddySuggestList}>
            {matches.map((m) => (
              <Pressable
                key={m.uid}
                style={styles.buddySuggestRow}
                onPress={() => addBuddy(m)}
              >
                <Text style={styles.buddyChipUser}>@</Text>
                <Text style={styles.buddySuggestText}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {draft.trim() && matches.length === 0 ? (
          <Pressable
            style={styles.buddySuggestRow}
            onPress={() => addBuddy({ name: draft.trim() })}
          >
            <Text style={styles.buddySuggestText}>+ Add "{draft.trim()}" as free-text buddy</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── "Make official" toggle + cert-eligibility helpers ──────────────────

/**
 * Top-level mode toggle for SCUBA dives. When ON, the form runs full
 * validation against the agency-canonical required-field set before
 * publish. When OFF (default), the dive is a casual log and skips
 * verification + cert credit entirely.
 */
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
      style={[styles.officialToggle, value && styles.officialToggleOn]}
    >
      <View style={styles.officialToggleText}>
        <View style={styles.officialToggleTitleRow}>
          <Text style={styles.officialToggleTitle}>Make official</Text>
          {value ? (
            <View style={styles.officialBadge}>
              <Text style={styles.officialBadgeText}>OFFICIAL · CERT-ELIGIBLE</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.officialToggleSub}>
          {value
            ? 'Official logbook entry — all required fields must be completed before sign + publish.'
            : 'Cert-grade entry. Counts toward AOW, Rescue, DM, Instructor logbook requirements. Requires buddy or instructor verification before submit.'}
        </Text>
      </View>
      <View style={[styles.toggleTrack, !value && styles.toggleTrackOff]}>
        <View style={[styles.toggleThumb, !value && styles.toggleThumbOff]} />
      </View>
    </Pressable>
  );
}

/**
 * Returns the list of missing required fields for an official scuba
 * entry. Field labels match what the banner surfaces to the user.
 * Caller is expected to gate on `form.isOfficial && form.diveType === 'Scuba'`.
 */
function computeMissingOfficialFields(form: FormState): string[] {
  const missing: string[] = [];
  if (!form.spot) missing.push('Dive spot');
  if (!form.bottomTime || Number(form.bottomTime) <= 0) missing.push('Bottom time');
  if (!form.depthMax || Number(form.depthMax) <= 0) missing.push('Max depth');
  if (!form.startPressure) missing.push('Start pressure');
  if (!form.endPressure) missing.push('End pressure');
  if (!form.gasMix) missing.push('Gas mix');
  if (!form.weightUsed) missing.push('Weight used');
  if (!form.wetsuitThickness) missing.push('Exposure suit');
  if (!form.waterTemp) missing.push('Water temperature');
  if (!form.visibility) missing.push('Visibility');
  if (!form.buddy) missing.push('Buddy name');

  if (form.verificationType === 'self') {
    missing.push('Verification (buddy or instructor — self-log is not eligible)');
  } else {
    if (!form.verifierName) {
      missing.push(form.verificationType === 'instructor' ? 'Instructor name' : 'Buddy name (verifier)');
    }
    if (form.verificationType === 'instructor') {
      if (!form.verifierAgency) missing.push('Verifier agency');
      if (!form.verifierCertNumber) missing.push('Verifier cert / member number');
    }
    if (!form.verifierSignatureTyped) missing.push('Verifier signature acknowledgment');
  }

  // Conditional required fields tied to specialty subtypes
  if (form.scubaSubtypes.includes('Night') && !form.nightLightSource) {
    missing.push('Night-dive light source');
  }
  if ((form.scubaSubtypes.includes('Deep') || Number(form.depthMax) > 60) && !form.deepConfirmedFromComputer) {
    missing.push('Confirm max depth from dive computer (deep dive)');
  }

  return missing;
}

/**
 * Sticky-style banner shown above the form when "Make official" is on
 * but required fields are missing. Lists missing fields and gives a
 * one-click escape hatch to turn the toggle back off so the user can
 * save as a casual log.
 */
function MissingFieldsBanner({
  missing,
  onTurnOff,
}: {
  missing: string[];
  onTurnOff: () => void;
}) {
  return (
    <View style={styles.bannerMissing}>
      <Text style={styles.bannerMissingTitle}>
        ⚠ {missing.length} required field{missing.length === 1 ? '' : 's'} missing for official entry
      </Text>
      <View style={styles.bannerMissingList}>
        {missing.slice(0, 6).map((m) => (
          <Text key={m} style={styles.bannerMissingItem}>· {m}</Text>
        ))}
        {missing.length > 6 ? (
          <Text style={styles.bannerMissingItem}>· +{missing.length - 6} more</Text>
        ) : null}
      </View>
      <View style={styles.bannerMissingActions}>
        <Pressable style={styles.bannerMissingBtn} onPress={onTurnOff}>
          <Text style={styles.bannerMissingBtnText}>Turn off "Make official"</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Verification block (cert-eligibility) ───────────────────────────────

function VerificationBlock({ form, update }: { form: FormState; update: Update }) {
  const VERIFICATION_OPTIONS: Array<{ value: VerificationType; label: string; sub: string }> = [
    { value: 'self',       label: 'Self-logged',                 sub: 'No cert credit toward pro levels' },
    { value: 'buddy',      label: 'Buddy verified',              sub: 'Counts toward AOW, Rescue' },
    { value: 'instructor', label: 'Instructor / Divemaster',     sub: 'Required for DM + Instructor credit' },
  ];

  return (
    <Section
      step="V1"
      title="Verification"
      subtitle="— required for pro-level certifications (DM, Instructor)"
    >
      <View style={styles.verifRadioGroup}>
        {VERIFICATION_OPTIONS.map((opt) => {
          const selected = opt.value === form.verificationType;
          return (
            <Pressable
              key={opt.value}
              onPress={() => update('verificationType', opt.value)}
              style={[styles.verifRadioRow, selected && styles.verifRadioRowActive]}
            >
              <View style={[styles.verifRadio, selected && styles.verifRadioActive]}>
                {selected ? <View style={styles.verifRadioDot} /> : null}
              </View>
              <View style={styles.verifRadioText}>
                <Text style={[styles.verifRadioLabel, selected && styles.verifRadioLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.verifRadioSub}>{opt.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {form.verificationType === 'buddy' ? (
        <SubSection title="Buddy details">
          <Row2>
            <NumericField
              label="Buddy name"
              value={form.verifierName}
              onChange={(v) => update('verifierName', v)}
            />
            <SelectField
              label="Buddy cert level"
              value={form.verifierCertLevel}
              options={BUDDY_CERT_LEVELS as readonly string[]}
              onChange={(v) => update('verifierCertLevel', v as BuddyCertLevel)}
            />
          </Row2>
          <Row2>
            <NumericField
              label="Cert # (optional)"
              value={form.verifierCertNumber}
              onChange={(v) => update('verifierCertNumber', v)}
            />
            <NumericField
              label="Date verified"
              value={form.verificationDate}
              onChange={(v) => update('verificationDate', v)}
            />
          </Row2>
          <NumericField
            label="Type buddy name as acknowledgment"
            value={form.verifierSignatureTyped}
            onChange={(v) => update('verifierSignatureTyped', v)}
          />
          <Text style={styles.verifTodo}>
            🔒 Send-to-buddy signing link · coming soon
          </Text>
        </SubSection>
      ) : null}

      {form.verificationType === 'instructor' ? (
        <SubSection title="Instructor / Divemaster details">
          <Row2>
            <NumericField
              label="Instructor name"
              value={form.verifierName}
              onChange={(v) => update('verifierName', v)}
            />
            <SelectField
              label="Agency"
              value={form.verifierAgency}
              options={AGENCY_OPTIONS as readonly string[]}
              onChange={(v) => update('verifierAgency', v as AgencyOption)}
            />
          </Row2>
          <Row2>
            <NumericField
              label="Cert / member number"
              value={form.verifierCertNumber}
              onChange={(v) => update('verifierCertNumber', v)}
            />
            <NumericField
              label="Date verified"
              value={form.verificationDate}
              onChange={(v) => update('verificationDate', v)}
            />
          </Row2>
          <NumericField
            label="Type instructor name as acknowledgment"
            value={form.verifierSignatureTyped}
            onChange={(v) => update('verifierSignatureTyped', v)}
          />
          <Text style={styles.verifTodo}>
            🔒 Send-to-instructor signing link + drawn-signature pad · coming soon
          </Text>
        </SubSection>
      ) : null}

      {form.verificationType === 'self' ? (
        <Text style={styles.verifTodo}>
          Self-logged dives still appear in your dive history and can earn AOW credit later if you add buddy/instructor verification afterward. Pro-level certs (DM, Instructor) require instructor verification.
        </Text>
      ) : null}
    </Section>
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
  onChange,
}: {
  label: string;
  placeholder: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
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
          value={value}
          onChangeText={onChange}
        />
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.fieldNumericInput, { outlineStyle: 'none' } as object]}
          value={value}
          onChangeText={onChange}
          placeholderTextColor={colors.text4}
        />
        <Text style={styles.fieldCaret}>▾</Text>
      </View>
    </View>
  );
}

// ─── Spot picker ─────────────────────────────────────────────────────────
//
// Three ways to set a dive location, in order of typical use:
//   1. Type to search the existing SPOTS list (canonical Hawaii spots)
//   2. Enter custom latitude + longitude manually
//   3. Drop a pin on a small Mapbox map
//
// Modes (2) and (3) set form.latitude + form.longitude and overwrite
// form.spot with a coords-derived label like "21.3540°N, 158.1180°W".
// Mode (1) leaves lat/lon null because the canonical SPOTS lookup
// already has those — submitDiveLog can resolve them server-side.

function formatCoord(lat: string | null, lon: string | null): string {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || lat === null || lon === null) return '';
  const latPart = `${Math.abs(la).toFixed(4)}°${la >= 0 ? 'N' : 'S'}`;
  const lonPart = `${Math.abs(lo).toFixed(4)}°${lo >= 0 ? 'E' : 'W'}`;
  return `${latPart}, ${lonPart}`;
}

function sanitizeCoord(s: string): string {
  // Allow digits, a single leading minus, and at most one decimal point.
  // Strip the rest so pasting "lat: 21.354°N" yields "21.354".
  let cleaned = s.replace(/[^0-9.\-]/g, '');
  // Only the first char can be a minus.
  if (cleaned.length > 0) {
    const first = cleaned[0] === '-' ? '-' : '';
    cleaned = first + cleaned.slice(first.length).replace(/-/g, '');
  }
  const dot = cleaned.indexOf('.');
  if (dot !== -1) {
    cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
  }
  return cleaned;
}

function SpotPicker({
  spotValue,
  latitude,
  longitude,
  onChange,
}: {
  spotValue: string;
  latitude: string | null;
  longitude: string | null;
  onChange: (spot: string, lat: string | null, lon: string | null) => void;
}) {
  type Mode = 'search' | 'coords' | 'map';
  const [mode, setMode] = React.useState<Mode>('search');
  const hasCoords = latitude !== null && longitude !== null
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  const toggleMode = (next: Mode) => {
    setMode((cur) => (cur === next ? 'search' : next));
  };

  const setLat = (v: string) => {
    const s = sanitizeCoord(v);
    const newSpot = formatCoord(s, longitude);
    onChange(newSpot || spotValue, s || null, longitude);
  };
  const setLon = (v: string) => {
    const s = sanitizeCoord(v);
    const newSpot = formatCoord(latitude, s);
    onChange(newSpot || spotValue, latitude, s || null);
  };
  const setFromMap = (lng: number, lat: number) => {
    const latS = lat.toFixed(6);
    const lonS = lng.toFixed(6);
    onChange(formatCoord(latS, lonS), latS, lonS);
  };

  const mapMarker: MapMarker[] = hasCoords
    ? [{ id: 'picked', lat: Number(latitude), lng: Number(longitude), tier: 'excellent' }]
    : [];

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>Dive spot</FieldLabel>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldSearchIcon}>⌕</Text>
        <TextInput
          style={[styles.fieldInput, { outlineStyle: 'none' } as object]}
          placeholder="Search 47 dive spots across Hawaii…"
          placeholderTextColor={colors.text4}
          value={spotValue}
          onChangeText={(v) => onChange(v, null, null)}
        />
        <Text style={styles.fieldHint}>↵ to select</Text>
      </View>

      <View style={styles.spotPickerActions}>
        <Pressable
          onPress={() => toggleMode('coords')}
          style={[styles.spotPickerActionBtn, mode === 'coords' && styles.spotPickerActionBtnActive]}
        >
          <Text style={[styles.spotPickerActionText, mode === 'coords' && styles.spotPickerActionTextActive]}>
            ⌖ Enter coordinates
          </Text>
        </Pressable>
        <Pressable
          onPress={() => toggleMode('map')}
          style={[styles.spotPickerActionBtn, mode === 'map' && styles.spotPickerActionBtnActive]}
        >
          <Text style={[styles.spotPickerActionText, mode === 'map' && styles.spotPickerActionTextActive]}>
            ◇ Drop a pin
          </Text>
        </Pressable>
      </View>

      {mode === 'coords' ? (
        <View style={styles.spotPickerCoordsRow}>
          <View style={styles.spotPickerCoordField}>
            <Text style={styles.spotPickerCoordLabel}>LATITUDE</Text>
            <TextInput
              style={[styles.spotPickerCoordInput, { outlineStyle: 'none' } as object]}
              placeholder="21.3540"
              placeholderTextColor={colors.text4}
              value={latitude ?? ''}
              onChangeText={setLat}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
          <View style={styles.spotPickerCoordField}>
            <Text style={styles.spotPickerCoordLabel}>LONGITUDE</Text>
            <TextInput
              style={[styles.spotPickerCoordInput, { outlineStyle: 'none' } as object]}
              placeholder="-158.1400"
              placeholderTextColor={colors.text4}
              value={longitude ?? ''}
              onChangeText={setLon}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
        </View>
      ) : null}

      {mode === 'map' ? (
        <View style={styles.spotPickerMapWrap}>
          <KaiCastMap
            markers={mapMarker}
            center={hasCoords ? [Number(longitude), Number(latitude)] : HAWAII_CENTER}
            zoom={hasCoords ? 11 : HAWAII_ZOOM}
            onMapClick={setFromMap}
            interactive
            showZoomControls
            style={{ width: '100%', height: 320, borderRadius: radius.md }}
          />
          <Text style={styles.spotPickerMapHint}>
            {hasCoords
              ? `Pin at ${formatCoord(latitude, longitude)} — click anywhere to move it`
              : 'Click on the map to drop a pin'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Military-time dropdown that's also typeable. Dropdown options run
// from 0100 → 2400 in 30-minute intervals (47 options total) per the
// product spec; users wanting finer minutes (e.g. 1234, 1245) just
// keep typing after they select. Input is digits-only, capped at 4
// characters since military time fits in HHMM.
const MILITARY_TIME_OPTIONS: readonly string[] = (() => {
  const out: string[] = [];
  for (let i = 2; i <= 48; i++) {
    const minutes = i * 30;
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    out.push(`${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`);
  }
  return out;
})();

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  // Viewport-anchored fixed popover, same pattern as SelectField.
  // The dropdown was previously `position: absolute` inside fieldWrap,
  // which meant any ancestor stacking context (and Section cards
  // make new ones) capped its z-index — so the panel painted behind
  // subsequent form sections. Measuring the field's rect and
  // rendering the menu as a `position: fixed` overlay escapes every
  // ancestor stacking context and floats it above the page.
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const rowRef = React.useRef<View>(null);

  const measure = React.useCallback(() => {
    const node = rowRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.getBoundingClientRect !== 'function') return;
    const r = node.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const openMenu = () => {
    measure();
    setOpen(true);
  };

  // Reposition on scroll/resize so the menu tracks the field.
  React.useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  // Digits only, max 4. Doesn't validate ranges (so 9999 will parse)
  // — that's intentional so half-typed states like "12" don't snap
  // back. Users only see invalid values if they actually type them.
  const handleType = (s: string) => {
    onChange(s.replace(/[^0-9]/g, '').slice(0, 4));
  };

  const pick = (opt: string) => {
    onChange(opt);
    setOpen(false);
  };

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View ref={rowRef} style={styles.fieldRow}>
        <TextInput
          style={[styles.fieldNumericInput, { outlineStyle: 'none' } as object]}
          value={value}
          onChangeText={handleType}
          placeholder="HHMM"
          placeholderTextColor={colors.text4}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
        />
        <Pressable onPress={() => (open ? setOpen(false) : openMenu())} hitSlop={6}>
          <Text style={styles.fieldCaret}>▾</Text>
        </Pressable>
      </View>
      {open && rect && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <>
              {/* Backdrop + menu render into document.body via portal so
                  they participate in the GLOBAL stacking context. The
                  earlier `position: fixed` + zIndex:9999 was insufficient
                  because any ancestor with z-index set (even 0) creates
                  a stacking context that traps descendants — a sibling
                  later in DOM order (Dive Site Type select, Section 02)
                  would still capture clicks at the same z-level. Portal
                  is the only real escape. */}
              <Pressable onPress={() => setOpen(false)} style={selectStyles.backdrop} />
              <View
                style={[
                  selectStyles.menu,
                  { top: rect.top, left: rect.left, width: rect.width },
                ]}
              >
                <ScrollView style={selectStyles.menuScroll} keyboardShouldPersistTaps="handled">
                  {MILITARY_TIME_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt}
                      onPress={() => pick(opt)}
                      style={[styles.timeDropdownRow, opt === value && styles.timeDropdownRowActive]}
                    >
                      <Text style={[styles.timeDropdownText, opt === value && styles.timeDropdownTextActive]}>
                        {opt}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </>,
            document.body,
          )
        : null}
    </View>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  // Real dropdown rendered as a viewport-anchored fixed popover so it
  // floats above sibling form fields regardless of parent stacking
  // contexts. We measure the field's bounding rect on open and pin
  // the menu beneath it.
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const rowRef = React.useRef<View>(null);

  const openMenu = () => {
    const node = rowRef.current as unknown as HTMLElement | null;
    if (node && typeof node.getBoundingClientRect === 'function') {
      const r = node.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  // Reposition on scroll/resize so the menu tracks the field.
  React.useEffect(() => {
    if (!open) return;
    const update = () => {
      const node = rowRef.current as unknown as HTMLElement | null;
      if (!node || typeof node.getBoundingClientRect !== 'function') return;
      const r = node.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        ref={rowRef}
        style={styles.fieldRow}
        onPress={() => (open ? setOpen(false) : openMenu())}
      >
        <Text style={styles.fieldSelectValue}>{value}</Text>
        <Text style={styles.fieldCaret}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && rect && typeof document !== 'undefined'
        ? ReactDOM.createPortal(
            <>
              {/* Portal-rendered for the same reason as TimeField:
                  position:fixed + high z-index doesn't escape ancestor
                  stacking contexts. Mounting at document.body puts the
                  backdrop and menu in the global stacking context where
                  zIndex:9998/9999 actually wins. */}
              <Pressable
                onPress={() => setOpen(false)}
                style={selectStyles.backdrop}
              />
              <View
                style={[
                  selectStyles.menu,
                  { top: rect.top, left: rect.left, width: rect.width },
                ]}
              >
                <ScrollView style={selectStyles.menuScroll} keyboardShouldPersistTaps="handled">
                  {options.map((opt) => {
                    const isSelected = opt === value;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => { onChange(opt); setOpen(false); }}
                        style={[selectStyles.menuItem, isSelected && selectStyles.menuItemSelected]}
                      >
                        <Text style={[selectStyles.menuItemText, isSelected && selectStyles.menuItemTextSelected]}>
                          {opt}
                        </Text>
                        {isSelected ? <Text style={selectStyles.menuItemCheck}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </>,
            document.body,
          )
        : null}
    </View>
  );
}

const selectStyles = StyleSheet.create({
  backdrop: {
    position: 'fixed' as unknown as 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
  },
  menu: {
    position: 'fixed' as unknown as 'absolute',
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    zIndex: 9999,
    maxHeight: 280,
  },
  menuScroll: {
    maxHeight: 280,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuItemSelected: {
    backgroundColor: colors.accentDim,
  },
  menuItemText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    flex: 1,
  },
  menuItemTextSelected: {
    color: colors.text1,
    fontWeight: '600',
  },
  menuItemCheck: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
  },
});

function StepperField({
  label,
  value,
  unit,
  onChange,
  step = 1,
  min,
  max,
  typeable = true,
  allowDecimal = false,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** false → render the value as plain text; +/- only (e.g. Weight Used). */
  typeable?: boolean;
  /** allow a single decimal point (e.g. swell ft 2.5). */
  allowDecimal?: boolean;
}) {
  const clamp = (n: number) => {
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };

  // Local string state lets the user transiently type things like "" or
  // "5." that are mid-edit and don't parse to a finished number. We
  // commit a clamped numeric value upstream on every keystroke that
  // produces a valid number, plus on blur as a safety net.
  const [draft, setDraft] = React.useState<string>(Number.isFinite(value) ? String(value) : '');
  // Resync when the parent pushes a different value (+/- buttons, form reset).
  React.useEffect(() => {
    setDraft(Number.isFinite(value) ? String(value) : '');
  }, [value]);

  const sanitize = (s: string) => {
    // Numeric only. Optionally one decimal point. Strip everything else
    // so pasted "abc-12.3ft" becomes "12.3".
    if (allowDecimal) {
      const cleaned = s.replace(/[^0-9.]/g, '');
      const dot = cleaned.indexOf('.');
      if (dot === -1) return cleaned;
      return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
    }
    return s.replace(/[^0-9]/g, '');
  };

  const onChangeText = (next: string) => {
    const s = sanitize(next);
    setDraft(s);
    if (s === '' || s === '.') {
      onChange(clamp(0));
      return;
    }
    const n = Number(s);
    if (Number.isFinite(n)) onChange(clamp(n));
  };

  const onBlur = () => {
    // Snap back to the numeric value the parent holds. Catches half-typed
    // "5." that we left in the draft.
    setDraft(Number.isFinite(value) ? String(value) : '');
  };

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.stepperRow}>
        <View style={styles.stepperValueWrap}>
          {typeable ? (
            <TextInput
              style={[styles.stepperValueInput, { outlineStyle: 'none' } as object]}
              value={draft}
              onChangeText={onChangeText}
              onBlur={onBlur}
              keyboardType="decimal-pad"
              inputMode={allowDecimal ? 'decimal' : 'numeric'}
              placeholder="—"
              placeholderTextColor={colors.text4}
            />
          ) : (
            <Text style={styles.stepperValue}>{value || '—'}</Text>
          )}
          <Text style={styles.stepperUnit}>{unit}</Text>
        </View>
        <View style={styles.stepperBtns}>
          <Pressable style={styles.stepperBtn} onPress={() => onChange(clamp(value + step))}>
            <Text style={styles.stepperBtnText}>+</Text>
          </Pressable>
          <View style={styles.stepperDivider} />
          <Pressable style={styles.stepperBtn} onPress={() => onChange(clamp(value - step))}>
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
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
            </Pressable>
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
  onChange,
  rows = 4,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
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
        value={value}
        onChangeText={onChange}
        multiline
      />
    </View>
  );
}

function VisibilitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  // Thresholds use absolute Hawaii benchmarks (a 50ft viz IS excellent
  // regardless of how wide the slider is). Slider max was raised to
  // 200ft to allow recording rare gin-clear days — added an
  // "Exceptional" tier at ≥100 ft so those readings get their own
  // descriptor instead of just maxing out at "Excellent".
  const descriptor =
    value >= 100 ? 'Exceptional — gin-clear, rare even for Hawaii'
    : value >= 50 ? 'Excellent visibility — 50+ ft is exceptional for Hawaii waters'
    : value >= 30 ? 'Clean — typical good Hawaii conditions'
    : value >= 15 ? 'Decent — some particulate'
    : value > 0 ? 'Murky — limited sight'
    : 'Not set';
  const descriptorColor =
    value >= 100 ? colors.accent
    : value >= 50 ? colors.excellent
    : value >= 30 ? colors.great
    : value >= 15 ? colors.good
    : value > 0 ? colors.fair
    : colors.text4;

  // Render a real HTML range input — the prior custom Pressable slider
  // depended on nativeEvent.locationX which RN-Web doesn't reliably
  // provide on click, so dragging + clicking the track silently no-op'd.
  // The range input gives free drag, keyboard arrow control, and
  // accessibility out of the box. Styled via inline CSS to match the
  // KaiCast palette.
  // Slider max raised from 100 → 200 ft. The fill-percentage in the
  // linear-gradient is the value's share of 200, not a literal pct.
  const VIS_MAX = 200;
  const fillPct = (value / VIS_MAX) * 100;
  const rangeInput = React.createElement('input', {
    type: 'range',
    min: 0,
    max: VIS_MAX,
    step: 1,
    value: String(value),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      if (Number.isFinite(n)) onChange(n);
    },
    style: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      appearance: 'none',
      WebkitAppearance: 'none',
      background: `linear-gradient(to right, ${colors.accent} 0%, ${colors.accent} ${fillPct}%, ${colors.surface2} ${fillPct}%, ${colors.surface2} 100%)`,
      outline: 'none',
      cursor: 'pointer',
    },
  });

  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>Underwater visibility</FieldLabel>
      <View style={styles.sliderRow}>
        <View style={{ flex: 1 }}>
          {rangeInput}
        </View>
        <View style={styles.sliderValueBox}>
          <Text style={styles.sliderValue}>{value}</Text>
          <Text style={styles.sliderUnit}>FT</Text>
        </View>
      </View>
      <View style={styles.sliderTickRow}>
        <Text style={styles.sliderTick}>0</Text>
        <Text style={styles.sliderTick}>200 FT</Text>
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

  // ── Post-publish ──
  publishedRoot: {
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 24,
    maxWidth: 880,
    alignSelf: 'center',
  },

  successHero: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 24,
  },
  successCheckRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(9,161,251,0.10)',
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheckMark: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '700',
    color: colors.bg,
    lineHeight: 32,
  },
  successHeadline: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.6,
    marginTop: 6,
  },
  successSub: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text2,
    textAlign: 'center',
    maxWidth: 560,
  },
  successSubAccent: {
    color: colors.text1,
    fontWeight: '600',
  },
  successTotal: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    marginTop: 4,
  },
  successTotalAccent: {
    color: colors.accent,
    fontWeight: '700',
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  summaryHeaderTitle: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  summaryHeaderId: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    fontWeight: '600',
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    paddingVertical: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  summaryMetricDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.hairline,
    marginHorizontal: 8,
  },
  summaryMetricLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
  },
  summaryMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  summaryMetricValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
  },
  summaryMetricValueAccent: {
    color: colors.accent,
  },
  summaryMetricUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  summaryRatingWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  summaryStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  summaryStar: {
    fontSize: 18,
    color: colors.text4,
  },
  summaryStarFilled: {
    color: colors.accent,
  },

  // After row (achievement + notifications)
  afterRow: {
    flexDirection: 'row',
    gap: 16,
  },

  achievementCard: {
    flex: 1,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,160,23,0.20)',
  },
  achievementPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d4a017',
  },
  achievementHeaderText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#d4a017',
  },
  achievementBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  achievementEmoji: {
    fontSize: 36,
  },
  achievementTextWrap: { flex: 1, gap: 4 },
  achievementTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  achievementDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  achievementShareBtn: {
    marginHorizontal: 18,
    marginBottom: 18,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(212,160,23,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementShareText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: '#d4a017',
  },

  // Notifications card
  notifyCard: {
    flex: 1,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  notifyHeader: {
    padding: 18,
    paddingBottom: 14,
    gap: 4,
  },
  notifyHeaderTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  notifyHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },
  notifyAvatarRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  notifyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.surface0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.text1,
  },
  notifyAvatarMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentDim,
    borderWidth: 2,
    borderColor: colors.surface0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyAvatarMoreText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
  },
  notifyList: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 8,
  },
  notifyRowName: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  notifyRowReason: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },

  // Action buttons grid
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1,
    minWidth: 180,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  actionBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text1,
  },
  actionBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionBtnPrimaryIcon: {
    fontSize: 14,
    color: colors.bg,
    fontWeight: '700',
  },
  actionBtnPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.bg,
  },

  // ── Form view ──
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 28,
    paddingVertical: 28,
    gap: 28,
  },

  // ── Left preview ──
  leftCol: {
    // Width set by responsive wrapper in LogDiveScreen.
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
  publishBtnDisabled: {
    opacity: 0.4,
  },
  publishHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
    marginTop: -4,
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
  // Editable variant of fieldNumericValue — used by the controlled NumericField.
  fieldNumericInput: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.text1,
    fontWeight: '500',
    padding: 0,
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

  // ── SpotPicker ──
  spotPickerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  spotPickerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  spotPickerActionBtnActive: {
    backgroundColor: colors.accentDim,
    borderColor: 'rgba(9,161,251,0.40)',
  },
  spotPickerActionText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text2,
  },
  spotPickerActionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  spotPickerCoordsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  spotPickerCoordField: {
    flex: 1,
    gap: 4,
  },
  spotPickerCoordLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  spotPickerCoordInput: {
    height: 36,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  spotPickerMapWrap: {
    marginTop: 12,
    gap: 8,
  },
  spotPickerMapHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
  },

  // ── TimeField dropdown ──
  // Sits absolutely below the field's input row so the input itself
  // doesn't reflow when it opens. Caps at 240px tall (≈ 8 rows visible)
  // and scrolls — the 47-option list is taller than any reasonable
  // dropdown.
  timeDropdown: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    maxHeight: 240,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    // Raised above SelectField backdrop (9998) so a TimeField opened
    // while a SelectField is also open still floats on top.
    zIndex: 9999,
  },
  // Sibling of timeDropdown: a full-viewport invisible Pressable that
  // catches outside clicks and closes the dropdown. position:fixed so
  // it covers the screen regardless of where the TimeField scrolled to.
  timeDropdownBackdrop: {
    position: 'fixed' as unknown as 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
  },
  timeDropdownScroll: {
    maxHeight: 240,
  },
  timeDropdownRow: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  timeDropdownRowActive: {
    backgroundColor: colors.accentDim,
  },
  timeDropdownText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text2,
    letterSpacing: 0.6,
  },
  timeDropdownTextActive: {
    color: colors.accent,
    fontWeight: '600',
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
  // Same typography as stepperValue but TextInput-shaped so typing
  // matches the static look (no native border, transparent bg).
  stepperValueInput: {
    minWidth: 60,
    paddingVertical: 0,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.3,
    backgroundColor: 'transparent',
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

  // Species picker — category chip row + selected pills + modal
  speciesHelper: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    marginBottom: 8,
  },
  speciesCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speciesCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  speciesCategoryChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  speciesCategoryEmoji: { fontSize: 14 },
  speciesCategoryText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text2,
  },
  speciesCategoryTextActive: { color: colors.text1 },
  speciesCategoryBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesCategoryBadgeText: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    color: colors.bg,
  },
  selectedSpeciesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  selectedSpeciesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  selectedSpeciesText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.bg,
  },
  selectedSpeciesX: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    color: colors.bg,
    lineHeight: 14,
  },

  // Species picker modal
  speciesModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  speciesModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  speciesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  speciesModalTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  speciesModalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  speciesModalCloseText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  speciesModalScroll: { flex: 1 },
  speciesModalContent: { padding: 8 },
  speciesModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
  },
  speciesModalRowSelected: { backgroundColor: colors.surface0 },
  speciesModalCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesModalCheckboxOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  speciesModalCheckmark: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  speciesModalLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
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

  // Step 01 spot map picker
  spotPickerWrap: {
    gap: 12,
    marginTop: -4,
  },
  spotPickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  spotPickerToggleIcon: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.accent,
    width: 14,
    textAlign: 'center',
  },
  spotPickerToggleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  spotPickerToggleSpacer: {
    flex: 1,
  },
  spotPickerToggleHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    letterSpacing: 0.5,
  },
  spotPickerMap: {
    height: 360,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface0,
  },

  // ── SCUBA cert-eligibility extension ─────────────────────────────────
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scubaSubtypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  scubaSubtypeChipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  scubaSubtypeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  scubaSubtypeTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },

  // OfficialToggle row
  officialToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    marginTop: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  officialToggleOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.08)',
  },
  officialToggleText: {
    flex: 1,
    gap: 4,
  },
  officialToggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  officialToggleTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  officialToggleSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
    lineHeight: 17,
  },
  officialBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  officialBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#04070d',
    fontWeight: '700',
  },

  // MissingFieldsBanner
  bannerMissing: {
    padding: 16,
    marginBottom: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(247,55,38,0.4)',
    backgroundColor: 'rgba(247,55,38,0.08)',
    gap: 10,
  },
  bannerMissingTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.nogo,
  },
  bannerMissingList: {
    gap: 2,
    paddingLeft: 4,
  },
  bannerMissingItem: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
    lineHeight: 18,
  },
  bannerMissingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  bannerMissingBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  bannerMissingBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
    fontWeight: '500',
  },
  bannerReady: {
    padding: 12,
    marginBottom: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(39,214,103,0.35)',
    backgroundColor: 'rgba(39,214,103,0.10)',
  },
  bannerReadyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.great,
  },

  // VerificationBlock
  verifRadioGroup: {
    gap: 8,
  },
  verifRadioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
  },
  verifRadioRowActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.08)',
  },
  verifRadio: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  verifRadioActive: {
    borderColor: colors.accent,
  },
  verifRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  verifRadioText: {
    flex: 1,
    gap: 2,
  },
  verifRadioLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text2,
  },
  verifRadioLabelActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  verifRadioSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
  },
  verifTodo: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.text3,
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 4,
  },

  // Buddy chips field
  buddyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  buddyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buddyChipUser: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
  },
  buddyChipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
  },
  buddyChipX: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.text2,
    lineHeight: 16,
  },
  buddyInputWrap: {
    gap: 4,
  },
  buddySuggestList: {
    gap: 2,
    paddingVertical: 4,
  },
  buddySuggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
  },
  buddySuggestText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },

  // Cert badge wrap in LeftPreview
  certBadgeWrap: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
    gap: 8,
  },
  certBadgeLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
  },
});
