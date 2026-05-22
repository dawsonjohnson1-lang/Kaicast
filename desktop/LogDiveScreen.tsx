import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import {
  colors,
  fonts,
  radius,
  DESKTOP_MAX_WIDTH,
} from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { KaiCastMap, HAWAII_CENTER, HAWAII_ZOOM, type MapMarker } from './components/maps/KaiCastMap';
import { CertEligibilityBadge, evaluateEligibility, type DiveForBadge } from './components/CertEligibilityBadge';
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
  marineLifeSelected: string[];
  sightingNotes: string;
  notes: string;
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
  marineLifeSelected: [],
  sightingNotes: '',
  notes: '',
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
};

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
          <PreviewRow label="Wildlife" value={form.marineLifeSelected.length > 0 ? form.marineLifeSelected.join(' · ') : '—'} />
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

      {/* Primary CTA — label flips to "Sign and publish" when official. */}
      <Pressable style={styles.publishBtn} onPress={onPublish}>
        <Text style={styles.publishBtnIcon}>↑</Text>
        <Text style={styles.publishBtnText}>
          {form.diveType === 'Scuba' && form.isOfficial ? 'Sign and publish' : 'Publish dive log'}
        </Text>
      </Pressable>
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

// ─── Right: 7-step form ───────────────────────────────────────────────────

type Update = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function RightForm({ form, update }: { form: FormState; update: Update }) {
  const toggleMarine = (name: string) => {
    const next = form.marineLifeSelected.includes(name)
      ? form.marineLifeSelected.filter((n) => n !== name)
      : [...form.marineLifeSelected, name];
    update('marineLifeSelected', next);
  };

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
        <ComboField
          label="Dive spot"
          placeholder="Search 47 dive spots across Hawaii…"
          hint="↵ to select"
          value={form.spot}
          onChange={(v) => update('spot', v)}
        />
        <SpotMapPicker value={form.spot} onPick={(name) => update('spot', name)} />
        <Row3>
          <NumericField label="Date"       value={form.date}      onChange={(v) => update('date', v)} />
          <NumericField label="Entry time" value={form.entryTime} onChange={(v) => update('entryTime', v)} />
          <NumericField label="Exit time"  value={form.exitTime}  onChange={(v) => update('exitTime', v)} />
        </Row3>
        <Row2>
          <ComboField
            label="Buddy (optional)"
            placeholder="Search divers or add name…"
            value={form.buddy}
            onChange={(v) => update('buddy', v)}
          />
          <SelectField
            label="Dive site type"
            value={form.diveSiteType}
            options={DIVE_SITE_TYPE_OPTIONS}
            onChange={(v) => update('diveSiteType', v)}
          />
        </Row2>
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

        <SubSection title="Tank & gas">
          <Row3>
            <StepperField label="Start pressure" value={form.startPressure} unit="psi" onChange={(v) => update('startPressure', v)} step={100} min={0} />
            <StepperField label="End pressure"   value={form.endPressure}   unit="psi" onChange={(v) => update('endPressure',   v)} step={100} min={0} />
            <SelectField  label="Gas mix"        value={form.gasMix}        options={GAS_MIX_OPTIONS} onChange={(v) => update('gasMix', v)} />
          </Row3>
          <Row2>
            <SelectField  label="Wetsuit thickness" value={form.wetsuitThickness} options={WETSUIT_OPTIONS} onChange={(v) => update('wetsuitThickness', v)} />
            <StepperField label="Weight used"       value={form.weightUsed} unit="lbs" onChange={(v) => update('weightUsed', v)} min={0} />
          </Row2>
        </SubSection>
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

      <Section step="05" title="Marine Life" subtitle="— what did you see?">
        <View style={styles.marineGrid}>
          {MARINE_LIFE_OPTIONS.map((m) => {
            const selected = form.marineLifeSelected.includes(m.name);
            return (
              <Pressable
                key={m.name}
                onPress={() => toggleMarine(m.name)}
                style={[styles.marineTile, selected && styles.marineTileSelected]}
              >
                <Text style={styles.marineEmoji}>{m.emoji}</Text>
                <Text style={[styles.marineName, selected && styles.marineNameSelected]}>{m.name}</Text>
              </Pressable>
            );
          })}
        </View>

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
  // Cycle through options on press. Not a true dropdown — see comment on
  // DIVE_SITE_TYPE_OPTIONS etc. — but interactive and predictable.
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable style={styles.fieldRow} onPress={() => onChange(cycle(options, value))}>
        <Text style={styles.fieldSelectValue}>{value}</Text>
        <Text style={styles.fieldCaret}>▾</Text>
      </Pressable>
    </View>
  );
}

function StepperField({
  label,
  value,
  unit,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const clamp = (n: number) => {
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };
  return (
    <View style={styles.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.stepperRow}>
        <View style={styles.stepperValueWrap}>
          <Text style={styles.stepperValue}>{value || '—'}</Text>
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
  const [trackWidth, setTrackWidth] = React.useState(0);
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
        {/* Click anywhere on the track to set value. Not a true drag handler
            (RN-Web doesn't ship one out of the box) — good enough for a
            prototype, and easier than wiring PanResponder for desktop. */}
        <Pressable
          style={styles.sliderTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={(e) => {
            if (trackWidth <= 0) return;
            const x = e.nativeEvent.locationX;
            const next = Math.round((x / trackWidth) * 100);
            onChange(Math.max(0, Math.min(100, next)));
          }}
        >
          <View style={[styles.sliderFill, { width: `${pct}%` }]} />
          <View style={[styles.sliderHandle, { left: `${pct}%` }]} />
        </Pressable>
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
