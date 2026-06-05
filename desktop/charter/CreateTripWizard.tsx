// CreateTripWizard — five-step modal flow for adding a new trip to
// charter_accounts/{orgId}/trips. Each step is a tab-card; "Next" is
// disabled until the step's required fields are valid.
//
//   1. Basics — date, trip type, departure harbor (defaults to org
//      home harbor), departure time, return time, headcount.
//   2. Route — pick spots in order. Each picked spot card reads the
//      forecast at planned arrival time, flags tide-preference
//      mismatches, and adds a per-spot drive-time estimate from the
//      previous stop. The route snapshot is rolled up into the
//      trip's conditionsSnapshot at save time.
//   3. Crew — pick from the roster. Cert-expiry warnings appear
//      inline; the wizard lets you assign expiring or expired crew
//      but surfaces the warning so the captain makes the call.
//   4. Manifest — dive trips only. Add divers one at a time with
//      cert level, agency, expiry, emergency contact.
//   5. Review — read-only summary + "File float plan" button which
//      writes to Firestore.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Modal } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useSpotReport, tierFromRating } from '../data/getReport';
import { saveTrip, type NewTripInput } from './saveTrip';
import { useCharterSpots, useCharterCrew, certWarning } from './useCharterData';
import type {
  CharterAccount, CharterSpot, CrewMember, ManifestEntry, TripType,
  OperationsProfile, OperationsTripType,
} from './types';

/** Human-readable label for an OperationsTripType — mirrors the chip
 *  labels in the onboarding wizard's Step 4. Kept local instead of
 *  exported because it's only useful next to a profile preview. */
function labelForOpsType(t: OperationsTripType): string {
  switch (t) {
    case 'dive_charter':    return 'Dive Charter';
    case 'snorkel':         return 'Snorkel';
    case 'sunset_cruise':   return 'Sunset Cruise';
    case 'spearfishing':    return 'Spearfishing';
    case 'freedive':        return 'Freedive';
    case 'private_charter': return 'Private Charter';
    case 'whale_watch':     return 'Whale Watch';
    case 'other':           return 'Custom';
  }
}

const STEPS = ['Basics', 'Route', 'Crew', 'Manifest', 'Review'] as const;
type Step = (typeof STEPS)[number];

const TRIP_TYPES: { id: TripType; label: string; emoji: string }[] = [
  { id: 'dive',         label: 'Scuba',         emoji: '🤿' },
  { id: 'freedive',     label: 'Freedive',      emoji: '🫁' },
  { id: 'snorkel',      label: 'Snorkel',       emoji: '🐠' },
  { id: 'spearfishing', label: 'Spearfishing',  emoji: '🎣' },
];

export interface DraftTrip {
  date: string;                   // 'YYYY-MM-DD' (local)
  departureTime: string;          // 'HH:mm'
  returnTime: string;
  departureHarbor: { name: string; lat: string; lng: string };
  spots: string[];
  crew: string[];
  headcount: string;              // string while editing; parsed on save
  tripType: TripType;
  manifest: ManifestEntry[];
}

interface Props {
  orgId: string;
  org: CharterAccount | null;
  onClose: () => void;
  onSaved?: (newTripId: string) => void;
}

export function CreateTripWizard({ orgId, org, onClose, onSaved }: Props) {
  const [step, setStep] = React.useState<Step>('Basics');
  const [draft, setDraft] = React.useState<DraftTrip>(() => initialDraft(org));
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const { spots: orgSpots } = useCharterSpots(orgId);
  const { crew: orgCrew }   = useCharterCrew(orgId);

  const stepIdx = STEPS.indexOf(step);
  const nextStep = () => setStep(STEPS[Math.min(STEPS.length - 1, stepIdx + 1)]);
  const prevStep = () => setStep(STEPS[Math.max(0, stepIdx - 1)]);

  // Manifest step is skipped for non-dive trips entirely — the wizard
  // walks them straight to Review. Same logic for the "Next" gate.
  const skipManifest = draft.tripType !== 'dive';
  const advance = () => {
    if (step === 'Crew' && skipManifest) setStep('Review');
    else nextStep();
  };
  const retreat = () => {
    if (step === 'Review' && skipManifest) setStep('Crew');
    else prevStep();
  };

  const stepValid = (s: Step): boolean => {
    switch (s) {
      case 'Basics':   return basicsValid(draft);
      case 'Route':    return draft.spots.length > 0;
      case 'Crew':     return true;  // crew is optional
      case 'Manifest': return true;  // manifest can be empty even on dive trips
      case 'Review':   return basicsValid(draft) && draft.spots.length > 0;
    }
  };

  const onSave = async () => {
    if (!stepValid('Review')) return;
    setSaving(true);
    setSaveError(null);
    try {
      const newTripId = await saveTrip(orgId, draftToInput(draft, orgCrew));
      onSaved?.(newTripId);
      onClose();
    } catch (err) {
      setSaveError((err as Error).message || 'Could not save trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header — title + stepper + close */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Create trip</Text>
              <Text style={styles.subtitle}>Step {stepIdx + 1} of {STEPS.length} — {step}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <Stepper current={step} onJump={(s) => stepValid(STEPS[Math.max(0, STEPS.indexOf(s) - 1)] ?? 'Basics') && setStep(s)} skipManifest={skipManifest} />

          {/* Step content */}
          <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent}>
            {step === 'Basics'   && <BasicsStep draft={draft} setDraft={setDraft} org={org} />}
            {step === 'Route'    && <RouteStep  draft={draft} setDraft={setDraft} orgSpots={orgSpots} />}
            {step === 'Crew'     && <CrewStep   draft={draft} setDraft={setDraft} crew={orgCrew} />}
            {step === 'Manifest' && <ManifestStep draft={draft} setDraft={setDraft} />}
            {step === 'Review'   && <ReviewStep draft={draft} orgSpots={orgSpots} crew={orgCrew} saveError={saveError} />}
          </ScrollView>

          {/* Footer — back / next / save */}
          <View style={styles.footer}>
            <Pressable onPress={retreat} disabled={stepIdx === 0} style={[styles.footerBtn, stepIdx === 0 && styles.footerBtnDisabled]}>
              <Text style={[styles.footerBtnText, stepIdx === 0 && styles.footerBtnTextDisabled]}>Back</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {step === 'Review' ? (
              <Pressable
                onPress={onSave}
                disabled={!stepValid('Review') || saving}
                style={[styles.footerBtn, styles.footerBtnPrimary, (!stepValid('Review') || saving) && styles.footerBtnDisabled]}
              >
                <Text style={[styles.footerBtnText, styles.footerBtnTextPrimary]}>
                  {saving ? 'Saving…' : 'File float plan'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={advance}
                disabled={!stepValid(step)}
                style={[styles.footerBtn, styles.footerBtnPrimary, !stepValid(step) && styles.footerBtnDisabled]}
              >
                <Text style={[styles.footerBtnText, styles.footerBtnTextPrimary]}>Next →</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────

function Stepper({ current, onJump, skipManifest }: { current: Step; onJump: (s: Step) => void; skipManifest: boolean }) {
  return (
    <View style={styles.stepperRow}>
      {STEPS.map((s, i) => {
        const isCurrent = s === current;
        const muted = skipManifest && s === 'Manifest';
        return (
          <Pressable key={s} onPress={() => !muted && onJump(s)} style={[styles.stepperItem, isCurrent && styles.stepperItemActive]}>
            <Text style={[styles.stepperNum, isCurrent && styles.stepperNumActive, muted && styles.stepperMuted]}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={[styles.stepperLabel, isCurrent && styles.stepperLabelActive, muted && styles.stepperMuted]}>{s}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 1: Basics ──────────────────────────────────────────────────

/** Map a trip's TripType to the matching OperationsTripType enum the
 *  operations profile uses. Charter-side scuba/freedive/snorkel/spear
 *  → the 4-of-8 ops options that line up; the other 4 (sunset_cruise,
 *  whale_watch, private_charter, other) don't have a trip-side
 *  equivalent in v1 and just don't match anything. */
function opsKeyForTripType(t: TripType): OperationsTripType | null {
  switch (t) {
    case 'dive':         return 'dive_charter';
    case 'snorkel':      return 'snorkel';
    case 'freedive':     return 'freedive';
    case 'spearfishing': return 'spearfishing';
  }
}

function findMatchingProfile(org: CharterAccount | null, t: TripType): OperationsProfile | null {
  if (!org) return null;
  const key = opsKeyForTripType(t);
  if (!key) return null;
  return org.operationsProfile.find((p) => p.tripType === key) ?? null;
}

/** Add `hours` (may be fractional) to a 'HH:mm' clock-time string,
 *  rolling at midnight. Used to compute a trip's return time from
 *  departure + the operations profile's typicalDurationHrs. */
function addHoursToHHmm(hhmm: string, hours: number): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const minsTotal = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + Math.round(hours * 60)) % (24 * 60);
  const h = Math.floor(minsTotal / 60);
  const mm = minsTotal % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function BasicsStep({ draft, setDraft, org }: { draft: DraftTrip; setDraft: React.Dispatch<React.SetStateAction<DraftTrip>>; org: CharterAccount | null }) {
  const useOrgHarbor = () => {
    if (!org?.homeHarbor) return;
    setDraft((d) => ({
      ...d,
      departureHarbor: {
        name: org.homeHarbor.name,
        lat:  String(org.homeHarbor.lat),
        lng:  String(org.homeHarbor.lng),
      },
    }));
  };

  /** Apply the operations-profile defaults for the given trip type.
   *  Always replaces the current values — the captain can edit after.
   *  Pulled out so it fires both on chip-tap AND as an automatic
   *  one-shot when the wizard mounts on a brand-new draft. */
  const applyProfile = React.useCallback((tripType: TripType, profile: OperationsProfile | null) => {
    if (!profile || !org) return;
    const harbor = org.harbors.find((h) => h.harborId === profile.defaultDepartureHarborId);
    const departureTime = profile.typicalDepartureTimes[0] ?? draft.departureTime;
    const returnTime = profile.typicalDurationHrs > 0
      ? addHoursToHHmm(departureTime, profile.typicalDurationHrs)
      : draft.departureTime;
    setDraft((d) => ({
      ...d,
      tripType,
      departureTime,
      returnTime,
      departureHarbor: harbor
        ? { name: harbor.name, lat: String(harbor.lat), lng: String(harbor.lng) }
        : d.departureHarbor,
    }));
  }, [org, draft.departureTime, setDraft]);

  const onPickTripType = (t: TripType) => {
    const matchingProfile = findMatchingProfile(org, t);
    if (matchingProfile) {
      applyProfile(t, matchingProfile);
    } else {
      setDraft((d) => ({ ...d, tripType: t }));
    }
  };

  const matchingProfile = findMatchingProfile(org, draft.tripType);
  const profileSummary = React.useMemo(() => {
    if (!matchingProfile || !org) return null;
    const harbor = org.harbors.find((h) => h.harborId === matchingProfile.defaultDepartureHarborId);
    const vessel = org.fleet.find((v) => v.vesselId === matchingProfile.defaultVesselId);
    return { harbor, vessel, profile: matchingProfile };
  }, [matchingProfile, org]);

  const pickTypicalTime = (t: string) => {
    if (!matchingProfile) return;
    setDraft((d) => ({
      ...d,
      departureTime: t,
      returnTime: matchingProfile.typicalDurationHrs > 0
        ? addHoursToHHmm(t, matchingProfile.typicalDurationHrs)
        : d.returnTime,
    }));
  };

  return (
    <View style={{ gap: 18 }}>
      <Field label="Date">
        <TextInput
          value={draft.date}
          onChangeText={(v) => setDraft((d) => ({ ...d, date: v }))}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text4}
          style={styles.input}
        />
      </Field>

      <Field label="Trip type">
        <View style={styles.chipRow}>
          {TRIP_TYPES.map((t) => {
            const active = draft.tripType === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => onPickTripType(t.id)}
                style={[styles.choiceChip, active && styles.choiceChipActive]}
              >
                <Text style={styles.choiceEmoji}>{t.emoji}</Text>
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* Operations-profile pre-fill summary. Only renders when a
          matching profile exists; otherwise hidden so the form stays
          tight for orgs that haven't filled in their operations
          profile yet. */}
      {profileSummary ? (
        <View style={styles.profileBanner}>
          <Text style={styles.profileBannerKicker}>FROM YOUR OPERATIONS PROFILE</Text>
          <Text style={styles.profileBannerLine}>
            Pre-filled from your <Text style={styles.profileBannerEm}>{labelForOpsType(profileSummary.profile.tripType)}</Text> defaults
            {profileSummary.vessel ? ` · vessel ${profileSummary.vessel.name}` : ''}
            {profileSummary.harbor ? ` · departs ${profileSummary.harbor.name}` : ''}
            {profileSummary.profile.typicalDurationHrs > 0 ? ` · ${profileSummary.profile.typicalDurationHrs}-hour trip` : ''}.
          </Text>
          {profileSummary.profile.destinationAreas.length > 0 ? (
            <Text style={styles.profileBannerArea}>
              Typically heads to: {profileSummary.profile.destinationAreas.map((a) => a.label).join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : org && org.operationsProfile.length === 0 ? (
        <View style={styles.profileEmptyBanner}>
          <Text style={styles.profileEmptyText}>
            No operations profile yet — add trip-type defaults in{' '}
            <Text style={styles.profileEmptyEm}>Settings → Operations</Text> so the wizard
            pre-fills harbor, vessel, and departure times next time.
          </Text>
        </View>
      ) : null}

      {/* Typical-time quick-select chips. Show only when the matching
          profile defines them — otherwise the captain types directly. */}
      {matchingProfile && matchingProfile.typicalDepartureTimes.length > 0 ? (
        <Field label="Typical departure times for this trip type">
          <View style={styles.chipRow}>
            {matchingProfile.typicalDepartureTimes.map((t) => {
              const active = draft.departureTime === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => pickTypicalTime(t)}
                  style={[styles.choiceChip, active && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      <View style={styles.row2}>
        <Field label="Departure time">
          <TextInput
            value={draft.departureTime}
            onChangeText={(v) => setDraft((d) => ({ ...d, departureTime: v }))}
            placeholder="HH:mm"
            placeholderTextColor={colors.text4}
            style={styles.input}
          />
        </Field>
        <Field label="Return time">
          <TextInput
            value={draft.returnTime}
            onChangeText={(v) => setDraft((d) => ({ ...d, returnTime: v }))}
            placeholder="HH:mm"
            placeholderTextColor={colors.text4}
            style={styles.input}
          />
        </Field>
      </View>

      <Field label="Headcount">
        <TextInput
          value={draft.headcount}
          onChangeText={(v) => setDraft((d) => ({ ...d, headcount: v.replace(/[^0-9]/g, '') }))}
          placeholder="0"
          placeholderTextColor={colors.text4}
          keyboardType="number-pad"
          style={styles.input}
        />
      </Field>

      <Field label="Departure harbor">
        <View style={{ gap: 8 }}>
          <TextInput
            value={draft.departureHarbor.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, departureHarbor: { ...d.departureHarbor, name: v } }))}
            placeholder="Haleiwa Small Boat Harbor"
            placeholderTextColor={colors.text4}
            style={styles.input}
          />
          <View style={styles.row2}>
            <TextInput
              value={draft.departureHarbor.lat}
              onChangeText={(v) => setDraft((d) => ({ ...d, departureHarbor: { ...d.departureHarbor, lat: sanitizeCoord(v) } }))}
              placeholder="Lat"
              placeholderTextColor={colors.text4}
              style={styles.input}
            />
            <TextInput
              value={draft.departureHarbor.lng}
              onChangeText={(v) => setDraft((d) => ({ ...d, departureHarbor: { ...d.departureHarbor, lng: sanitizeCoord(v) } }))}
              placeholder="Lng"
              placeholderTextColor={colors.text4}
              style={styles.input}
            />
          </View>
          {org?.homeHarbor ? (
            <Pressable onPress={useOrgHarbor} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Use org home harbor ({org.homeHarbor.name})</Text>
            </Pressable>
          ) : null}
        </View>
      </Field>
    </View>
  );
}

// ─── Step 2: Route ────────────────────────────────────────────────────

function RouteStep({ draft, setDraft, orgSpots }: { draft: DraftTrip; setDraft: React.Dispatch<React.SetStateAction<DraftTrip>>; orgSpots: CharterSpot[] }) {
  const addSpot = (spotId: string) => {
    if (draft.spots.includes(spotId)) return;
    setDraft((d) => ({ ...d, spots: [...d.spots, spotId] }));
  };
  const removeSpot = (spotId: string) => {
    setDraft((d) => ({ ...d, spots: d.spots.filter((s) => s !== spotId) }));
  };
  const moveSpot = (idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d.spots];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return d;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, spots: next };
    });
  };

  const orderedPicked: Array<{ id: string; spot: CharterSpot | undefined }> = draft.spots.map((id) => ({
    id,
    spot: orgSpots.find((s) => s.id === id),
  }));
  const available = orgSpots.filter((s) => !draft.spots.includes(s.id));

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.fieldHint}>
        Pick spots in the order you'll visit them — departure harbor → first stop → next stop → return. Each card reads the
        forecast at the planned arrival time and flags tide-preference mismatches.
      </Text>

      {/* Ordered picked spots */}
      {orderedPicked.length === 0 ? (
        <View style={styles.emptyHintCard}>
          <Text style={styles.emptyHintTitle}>No spots picked yet.</Text>
          <Text style={styles.emptyHintBody}>
            {orgSpots.length === 0
              ? `Add spots to your org's library first — /charter/spots.`
              : 'Tap a spot below to add it to the route.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {orderedPicked.map((p, i) => (
            <RoutedSpotCard
              key={p.id}
              order={i + 1}
              spot={p.spot}
              draft={draft}
              isFirst={i === 0}
              isLast={i === orderedPicked.length - 1}
              prevSpot={i > 0 ? orderedPicked[i - 1].spot : undefined}
              onUp={() => moveSpot(i, -1)}
              onDown={() => moveSpot(i, 1)}
              onRemove={() => removeSpot(p.id)}
            />
          ))}
        </View>
      )}

      {/* Available pool */}
      {available.length > 0 ? (
        <View style={styles.poolWrap}>
          <Text style={styles.poolLabel}>Add a spot</Text>
          <View style={styles.chipRow}>
            {available.map((s) => (
              <Pressable key={s.id} onPress={() => addSpot(s.id)} style={styles.poolChip}>
                <Text style={styles.poolChipText}>+ {s.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RoutedSpotCard({
  order,
  spot,
  draft,
  isFirst,
  isLast,
  prevSpot,
  onUp,
  onDown,
  onRemove,
}: {
  order: number;
  spot: CharterSpot | undefined;
  draft: DraftTrip;
  isFirst: boolean;
  isLast: boolean;
  prevSpot: CharterSpot | undefined;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  // Read forecast for the spot. Prefer the linked public spot id so we
  // hit the canonical kaicast_reports doc; fall back to the spot's own
  // id (which may or may not be a public spot).
  const lookupId = spot?.linkedPublicSpotId ?? spot?.id ?? '';
  const { data: report, loading: reportLoading } = useSpotReport(lookupId || undefined);
  const tier = report ? tierFromRating(report.now?.rating) : null;

  // Tide preference mismatch — we don't have a per-hour tide phase in
  // the BackendReport snapshot yet, so this is a placeholder hook. The
  // shape's already wired; Phase 7 lights it up when the pipeline
  // exposes tide phase at planned arrival time.
  const tideMismatch: boolean = false;

  // Drive time — rough great-circle estimate from prev spot. Real
  // route engine lands later; this is good enough for the planner.
  const driveMin = prevSpot && spot ? estimateDriveMin(prevSpot, spot) : null;

  if (!spot) {
    return (
      <View style={styles.routeCard}>
        <Text style={styles.routeMissing}>Spot {order} was removed from the library. Drop it from the route.</Text>
        <Pressable onPress={onRemove} style={styles.smallBtn}><Text style={styles.smallBtnText}>Remove</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <Text style={styles.routeOrder}>STOP {order}</Text>
        <Text style={styles.routeName}>{spot.name}</Text>
        {reportLoading ? (
          <Text style={styles.routeBadge}>Reading forecast…</Text>
        ) : tier ? (
          <View style={[styles.tierBadge, { borderColor: tierColor(tier) }]}>
            <Text style={[styles.tierBadgeText, { color: tierColor(tier) }]}>
              {tierLabel(tier)}
            </Text>
          </View>
        ) : (
          <Text style={styles.routeBadge}>No forecast available</Text>
        )}
      </View>

      <View style={styles.routeMetaRow}>
        <Text style={styles.routeMeta}>Depth {spot.depthFt || '—'} ft</Text>
        <Text style={styles.routeMeta}>Tide pref: {spot.tidePreference}</Text>
        {driveMin != null ? <Text style={styles.routeMeta}>~{driveMin} min from prev</Text> : null}
        {isFirst ? <Text style={styles.routeMeta}>~{estimateDriveMinFromCoord(parseFloat(draft.departureHarbor.lat), parseFloat(draft.departureHarbor.lng), spot)} min from harbor</Text> : null}
      </View>

      {tideMismatch ? (
        <Text style={styles.routeWarn}>Tide preference may not match planned arrival — verify before float plan.</Text>
      ) : null}

      <View style={styles.routeActions}>
        <Pressable onPress={onUp} disabled={isFirst} style={[styles.smallBtn, isFirst && styles.smallBtnDisabled]}><Text style={styles.smallBtnText}>↑ Move up</Text></Pressable>
        <Pressable onPress={onDown} disabled={isLast} style={[styles.smallBtn, isLast && styles.smallBtnDisabled]}><Text style={styles.smallBtnText}>↓ Move down</Text></Pressable>
        <Pressable onPress={onRemove} style={styles.smallBtn}><Text style={styles.smallBtnText}>Remove</Text></Pressable>
      </View>
    </View>
  );
}

// ─── Step 3: Crew ─────────────────────────────────────────────────────

function CrewStep({ draft, setDraft, crew }: { draft: DraftTrip; setDraft: React.Dispatch<React.SetStateAction<DraftTrip>>; crew: CrewMember[] }) {
  const toggle = (id: string) => {
    setDraft((d) => ({
      ...d,
      crew: d.crew.includes(id) ? d.crew.filter((c) => c !== id) : [...d.crew, id],
    }));
  };
  if (crew.length === 0) {
    return (
      <View style={styles.emptyHintCard}>
        <Text style={styles.emptyHintTitle}>No crew on file.</Text>
        <Text style={styles.emptyHintBody}>
          Add crew at /charter/crew. You can still create this trip without assigning crew, but a
          float plan is more useful with names on it.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.fieldHint}>Tap to toggle. Crew with expiring or expired certs can still be picked — the warning is informational.</Text>
      {crew.map((m) => {
        const picked = draft.crew.includes(m.id);
        const worstCert = m.certs.map((c) => certWarning(c)).reduce<{ tier: 'expired' | 'expiring-soon' | 'ok' | null; daysUntil: number } | null>(
          (acc, w) => {
            if (w.tier === 'expired') return { tier: 'expired', daysUntil: w.daysUntil };
            if (w.tier === 'expiring-soon' && acc?.tier !== 'expired') return { tier: 'expiring-soon', daysUntil: w.daysUntil };
            return acc;
          },
          null,
        );
        return (
          <Pressable key={m.id} onPress={() => toggle(m.id)} style={[styles.crewRow, picked && styles.crewRowPicked]}>
            <View style={[styles.crewCheckbox, picked && styles.crewCheckboxOn]}>
              {picked ? <Text style={styles.crewCheckmark}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.crewName}>{m.name}</Text>
              <Text style={styles.crewMeta}>{m.role.toUpperCase()} · {m.certs.length} cert{m.certs.length === 1 ? '' : 's'}</Text>
            </View>
            {worstCert?.tier === 'expired' ? (
              <View style={[styles.crewWarn, styles.crewWarnRed]}><Text style={styles.crewWarnText}>EXPIRED</Text></View>
            ) : worstCert?.tier === 'expiring-soon' ? (
              <View style={[styles.crewWarn, styles.crewWarnYellow]}><Text style={[styles.crewWarnText, { color: '#F5A623' }]}>EXPIRES IN {worstCert.daysUntil}D</Text></View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 4: Manifest (dive only) ─────────────────────────────────────

function ManifestStep({ draft, setDraft }: { draft: DraftTrip; setDraft: React.Dispatch<React.SetStateAction<DraftTrip>> }) {
  const addEntry = () => {
    setDraft((d) => ({
      ...d,
      manifest: [...d.manifest, {
        name: '',
        certLevel: '',
        certAgency: '',
        certExpiry: new Date(0),
        lastDiveDate: new Date(0),
        emergencyContact: '',
        medicalFlags: '',
      }],
    }));
  };
  const updateEntry = (idx: number, patch: Partial<ManifestEntry>) => {
    setDraft((d) => {
      const next = [...d.manifest];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, manifest: next };
    });
  };
  const removeEntry = (idx: number) => {
    setDraft((d) => ({ ...d, manifest: d.manifest.filter((_, i) => i !== idx) }));
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.fieldHint}>Add one diver at a time. Cert level + agency + expiry are required for the float plan; emergency contact and medical flags are strongly recommended.</Text>
      {draft.manifest.map((m, i) => (
        <View key={i} style={styles.manifestCard}>
          <View style={styles.manifestHeader}>
            <Text style={styles.manifestNum}>DIVER {i + 1}</Text>
            <Pressable onPress={() => removeEntry(i)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Remove</Text>
            </Pressable>
          </View>
          <View style={styles.row2}>
            <Field label="Name">
              <TextInput value={m.name} onChangeText={(v) => updateEntry(i, { name: v })} placeholder="Diver name" placeholderTextColor={colors.text4} style={styles.input} />
            </Field>
            <Field label="Cert level">
              <TextInput value={m.certLevel} onChangeText={(v) => updateEntry(i, { certLevel: v })} placeholder="OW / AOW / DM / Instructor" placeholderTextColor={colors.text4} style={styles.input} />
            </Field>
          </View>
          <View style={styles.row2}>
            <Field label="Cert agency">
              <TextInput value={m.certAgency} onChangeText={(v) => updateEntry(i, { certAgency: v })} placeholder="PADI / SSI / NAUI / …" placeholderTextColor={colors.text4} style={styles.input} />
            </Field>
            <Field label="Cert expiry">
              <TextInput
                value={isoDateOrEmpty(m.certExpiry)}
                onChangeText={(v) => updateEntry(i, { certExpiry: parseIsoDateOrEpoch(v) })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text4}
                style={styles.input}
              />
            </Field>
          </View>
          <View style={styles.row2}>
            <Field label="Last dive date">
              <TextInput
                value={isoDateOrEmpty(m.lastDiveDate)}
                onChangeText={(v) => updateEntry(i, { lastDiveDate: parseIsoDateOrEpoch(v) })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.text4}
                style={styles.input}
              />
            </Field>
            <Field label="Emergency contact">
              <TextInput value={m.emergencyContact} onChangeText={(v) => updateEntry(i, { emergencyContact: v })} placeholder="Name + phone" placeholderTextColor={colors.text4} style={styles.input} />
            </Field>
          </View>
          <Field label="Medical flags (optional)">
            <TextInput value={m.medicalFlags} onChangeText={(v) => updateEntry(i, { medicalFlags: v })} placeholder="DAN form notes — asthma, diabetes, last dive incident…" placeholderTextColor={colors.text4} style={styles.input} />
          </Field>
        </View>
      ))}
      <Pressable onPress={addEntry} style={styles.addEntryBtn}>
        <Text style={styles.addEntryText}>+ Add diver</Text>
      </Pressable>
    </View>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────

function ReviewStep({ draft, orgSpots, crew, saveError }: { draft: DraftTrip; orgSpots: CharterSpot[]; crew: CrewMember[]; saveError: string | null }) {
  const tripDateObj = parseDateOrToday(draft.date);
  return (
    <View style={{ gap: 14 }}>
      <ReviewBlock label="When">
        <Text style={styles.reviewBig}>{tripDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</Text>
        <Text style={styles.reviewMeta}>Departs {draft.departureTime} · returns {draft.returnTime}</Text>
      </ReviewBlock>

      <ReviewBlock label="What">
        <Text style={styles.reviewBig}>{TRIP_TYPES.find((t) => t.id === draft.tripType)?.label ?? draft.tripType}</Text>
        <Text style={styles.reviewMeta}>{draft.headcount || '0'} passengers · departs from {draft.departureHarbor.name || '—'}</Text>
      </ReviewBlock>

      <ReviewBlock label="Route">
        {draft.spots.length === 0 ? (
          <Text style={styles.reviewMuted}>No spots picked.</Text>
        ) : (
          draft.spots.map((id, i) => {
            const spot = orgSpots.find((s) => s.id === id);
            return (
              <Text key={id} style={styles.reviewLine}>
                {i + 1}. {spot?.name ?? id}{spot ? `  · depth ${spot.depthFt}ft · tide pref ${spot.tidePreference}` : ''}
              </Text>
            );
          })
        )}
      </ReviewBlock>

      <ReviewBlock label="Crew">
        {draft.crew.length === 0 ? (
          <Text style={styles.reviewMuted}>No crew assigned (allowed; the float plan won't list any names).</Text>
        ) : (
          draft.crew.map((id) => {
            const m = crew.find((c) => c.id === id);
            return <Text key={id} style={styles.reviewLine}>· {m?.name ?? id} ({m?.role ?? '—'})</Text>;
          })
        )}
      </ReviewBlock>

      {draft.tripType === 'dive' ? (
        <ReviewBlock label="Manifest">
          {draft.manifest.length === 0 ? (
            <Text style={styles.reviewMuted}>No divers on the manifest yet.</Text>
          ) : (
            draft.manifest.map((m, i) => (
              <Text key={i} style={styles.reviewLine}>· {m.name || 'Unnamed diver'}{m.certLevel ? ` — ${m.certLevel}` : ''}{m.certAgency ? ` (${m.certAgency})` : ''}</Text>
            ))
          )}
        </ReviewBlock>
      ) : null}

      {saveError ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not save trip</Text>
          <Text style={styles.errBody}>{saveError}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.reviewBlock}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <View style={{ gap: 4, marginTop: 6 }}>{children}</View>
    </View>
  );
}

// ─── Shared input components ──────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function initialDraft(org: CharterAccount | null): DraftTrip {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    departureTime: '07:00',
    returnTime: '13:00',
    departureHarbor: org?.homeHarbor
      ? { name: org.homeHarbor.name, lat: String(org.homeHarbor.lat), lng: String(org.homeHarbor.lng) }
      : { name: '', lat: '', lng: '' },
    spots: [],
    crew: [],
    headcount: '',
    tripType: 'dive',
    manifest: [],
  };
}

function basicsValid(d: DraftTrip): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return false;
  if (!/^\d{2}:\d{2}$/.test(d.departureTime)) return false;
  if (!/^\d{2}:\d{2}$/.test(d.returnTime)) return false;
  if (d.departureHarbor.name.trim().length === 0) return false;
  const headcount = parseInt(d.headcount, 10);
  if (!Number.isFinite(headcount) || headcount < 1) return false;
  return true;
}

function draftToInput(d: DraftTrip, orgCrew: CrewMember[]): NewTripInput {
  return {
    date: parseDateOrToday(d.date),
    departureTime: d.departureTime,
    returnTime: d.returnTime,
    departureHarbor: {
      name: d.departureHarbor.name,
      lat: parseFloat(d.departureHarbor.lat) || 0,
      lng: parseFloat(d.departureHarbor.lng) || 0,
    },
    spots: d.spots,
    crew: d.crew,
    captainUid: resolveCaptainUid(d.crew, orgCrew),
    headcount: parseInt(d.headcount, 10) || 0,
    tripType: d.tripType,
    manifest: d.tripType === 'dive' ? d.manifest : [],
    conditionsSnapshot: {
      capturedAt: new Date().toISOString(),
      perStopSnapshot: 'TODO: roll up route step forecasts here',
    },
    generateShareToken: true,
  };
}

/** Pick the captain among the assigned crew and return their KaiCast
 *  uid for rule-side captain-scoped write checks. Returns null when
 *  no captain is assigned OR the assigned captain has no linked
 *  KaiCast account (admin-only writes apply in that case). If multiple
 *  captains are assigned, the first one in the roster order wins. */
function resolveCaptainUid(crewIds: string[], orgCrew: CrewMember[]): string | null {
  for (const id of crewIds) {
    const member = orgCrew.find((m) => m.id === id);
    if (member && member.role === 'captain' && member.uid) {
      return member.uid;
    }
  }
  return null;
}

function parseDateOrToday(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
  return d;
}

function isoDateOrEmpty(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime()) || d.getTime() === 0) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDateOrEpoch(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(0);
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
}

function sanitizeCoord(s: string): string {
  let out = s.replace(/[^0-9.\-]/g, '');
  if (out.length > 0) {
    const first = out[0] === '-' ? '-' : '';
    out = first + out.slice(first.length).replace(/-/g, '');
  }
  const dot = out.indexOf('.');
  if (dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '');
  return out;
}

// Great-circle distance / approximate boat speed → drive minutes.
// 25 knots is a reasonable cruise for a Hawaii dive charter; tighten
// or loosen later by reading the org's vessel speed if we store it.
const KNOT_KMPH = 1.852;
const VESSEL_SPEED_KMPH = 25 * KNOT_KMPH;

function estimateDriveMin(from: CharterSpot, to: CharterSpot): number {
  return estimateDriveMinFromCoord(from.lat, from.lng, to);
}

function estimateDriveMinFromCoord(fromLat: number, fromLng: number, to: CharterSpot): number {
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLng)) return 0;
  const R = 6371;
  const dLat = ((to.lat - fromLat) * Math.PI) / 180;
  const dLng = ((to.lng - fromLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((fromLat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  return Math.max(1, Math.round((km / VESSEL_SPEED_KMPH) * 60));
}

function tierColor(tier: 'excellent' | 'great' | 'good' | 'fair' | 'no-go'): string {
  switch (tier) {
    case 'excellent': return '#09A1FB';
    case 'great':
    case 'good':     return '#3DDC84';
    case 'fair':     return '#F5A623';
    case 'no-go':    return '#F73726';
  }
}
function tierLabel(tier: 'excellent' | 'great' | 'good' | 'fair' | 'no-go'): string {
  switch (tier) {
    case 'excellent': return 'EXCELLENT';
    case 'great':
    case 'good':     return 'GO';
    case 'fair':     return 'BORDERLINE';
    case 'no-go':    return 'NO-GO';
  }
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 760, maxHeight: '92%', backgroundColor: colors.surface0, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, overflow: 'hidden' },

  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.text1 },
  subtitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, letterSpacing: 1, marginTop: 4 },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: colors.text2, lineHeight: 22 },

  stepperRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  stepperItem: { flex: 1, padding: 8, gap: 2, borderRadius: radius.sm, alignItems: 'center' },
  stepperItemActive: { backgroundColor: colors.surface1 },
  stepperNum: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, fontWeight: '700' },
  stepperNumActive: { color: colors.accent },
  stepperLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontWeight: '600' },
  stepperLabelActive: { color: colors.text1 },
  stepperMuted: { color: colors.text4, opacity: 0.5 },

  stepScroll: { flex: 1 },
  stepContent: { padding: 24 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.surface1 },
  footerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  footerBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  footerBtnDisabled: { opacity: 0.4 },
  footerBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  footerBtnTextPrimary: { color: colors.bg },
  footerBtnTextDisabled: { color: colors.text4 },

  // Fields
  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  fieldHint: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },
  input: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface1, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.hairlineStrong,
    fontFamily: fonts.body, fontSize: 13, color: colors.text1,
  },
  row2: { flexDirection: 'row', gap: 12 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  choiceChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  choiceEmoji: { fontSize: 14 },
  choiceText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },
  choiceTextActive: { color: colors.text1 },

  // Operations-profile pre-fill banner (Phase 8c)
  profileBanner: {
    padding: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.06)',
    gap: 6,
  },
  profileBannerKicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.accent,
  },
  profileBannerLine: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
    lineHeight: 19,
  },
  profileBannerEm: { fontFamily: fonts.body, fontWeight: '700', color: colors.text1 },
  profileBannerArea: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },

  profileEmptyBanner: {
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  profileEmptyText: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },
  profileEmptyEm: { fontFamily: fonts.mono, color: colors.accent },

  smallBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1, alignSelf: 'flex-start' },
  smallBtnText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text2 },
  smallBtnDisabled: { opacity: 0.4 },

  // Empty hints
  emptyHintCard: { padding: 16, borderRadius: radius.md, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline, gap: 6 },
  emptyHintTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  emptyHintBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, lineHeight: 18 },

  // Route step
  routeCard: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 8 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  routeOrder: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 1 },
  routeName: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text1, flex: 1 },
  routeBadge: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, letterSpacing: 0.5 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  tierBadgeText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  routeMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  routeMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3 },
  routeWarn: { fontFamily: fonts.body, fontSize: 12, color: '#F5A623', fontWeight: '600' },
  routeActions: { flexDirection: 'row', gap: 6 },
  routeMissing: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },
  poolWrap: { gap: 6, marginTop: 4 },
  poolLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  poolChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  poolChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, fontWeight: '600' },

  // Crew step
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface1 },
  crewRowPicked: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  crewCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  crewCheckboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  crewCheckmark: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  crewName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text1 },
  crewMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 2, letterSpacing: 0.3 },
  crewWarn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  crewWarnRed: { borderColor: '#F73726', backgroundColor: 'rgba(247,55,38,0.10)' },
  crewWarnYellow: { borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.10)' },
  crewWarnText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: '#F73726', letterSpacing: 0.5 },

  // Manifest step
  manifestCard: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 10 },
  manifestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manifestNum: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent, fontWeight: '700', letterSpacing: 1 },
  addEntryBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)', alignSelf: 'flex-start' },
  addEntryText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  // Review
  reviewBlock: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  reviewLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  reviewBig: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.text1 },
  reviewMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, marginTop: 2 },
  reviewLine: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 18 },
  reviewMuted: { fontFamily: fonts.body, fontSize: 12, color: colors.text4, fontStyle: 'italic' },
  errCard: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4, lineHeight: 18 },
});
