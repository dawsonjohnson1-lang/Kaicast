// CharterSetupScreen — 5-step charter onboarding wizard.
//
//   1. Org basics       — name, contact email, phone, optional description
//   2. Fleet            — one or more vessels with full safety-gear checklist
//   3. Harbors          — one or more harbors (home / loading / both)
//   4. Operations       — trip-type profiles that feed the trip planner
//   5. Review & launch  — read-only summary, "Launch dashboard" persists
//
// Gated by accountType: 'charter' AND setupComplete: false. Once
// launched, App.tsx's gate routes the user to /charter on next nav.
// The wizard is also reachable from /charter/settings for individual-
// section edits later (Phase 8b).

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useAuth } from '../hooks/useAuth';
import { useCharterAccount } from './useCharterData';
import { ChipSelect, ToggleRow, NumberStepper } from './inputs';
import { HAWAII_HARBORS, searchHarborPresets, type HarborPreset } from './hawaiiHarbors';
import { saveOnboarding, newVesselId, newHarborId, newProfileId } from './saveOnboarding';
import type {
  Vessel, OrgHarbor, OperationsProfile, VesselType, EngineConfig,
  HarborRole, OperationsTripType, SafetyGear, DestinationArea,
} from './types';
import type { NavigateFn } from '../router';

const STEPS = ['Basics', 'Fleet', 'Harbors', 'Operations', 'Review'] as const;
type Step = (typeof STEPS)[number];

const VESSEL_TYPE_OPTIONS: ReadonlyArray<{ id: VesselType; label: string }> = [
  { id: 'catamaran',       label: 'Catamaran' },
  { id: 'mono_sail',       label: 'Mono-hull Sailboat' },
  { id: 'center_console',  label: 'Center Console' },
  { id: 'rib_inflatable',  label: 'RIB / Inflatable' },
  { id: 'pontoon',         label: 'Pontoon' },
  { id: 'cabin_cruiser',   label: 'Cabin Cruiser' },
  { id: 'other',           label: 'Other' },
];

const ENGINE_OPTIONS: ReadonlyArray<{ id: EngineConfig; label: string }> = [
  { id: 'single_outboard', label: 'Single Outboard' },
  { id: 'twin_outboard',   label: 'Twin Outboard' },
  { id: 'inboard',         label: 'Inboard' },
  { id: 'sail',            label: 'Sail' },
  { id: 'other',           label: 'Other' },
];

const HARBOR_ROLE_OPTIONS: ReadonlyArray<{ id: HarborRole; label: string }> = [
  { id: 'home',    label: 'Home (boat docked here)' },
  { id: 'loading', label: 'Loading (guests board here)' },
  { id: 'both',    label: 'Both (storage + boarding)' },
];

const OPS_TRIP_TYPE_OPTIONS: ReadonlyArray<{ id: OperationsTripType; label: string }> = [
  { id: 'dive_charter',     label: 'Dive Charter' },
  { id: 'snorkel',          label: 'Snorkel' },
  { id: 'sunset_cruise',    label: 'Sunset Cruise' },
  { id: 'spearfishing',     label: 'Spearfishing' },
  { id: 'freedive',         label: 'Freedive' },
  { id: 'private_charter',  label: 'Private Charter' },
  { id: 'whale_watch',      label: 'Whale Watch' },
  { id: 'other',            label: 'Other' },
];

interface Draft {
  // Step 1
  name: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  // Step 2
  fleet: Vessel[];
  // Step 3
  harbors: OrgHarbor[];
  // Step 4
  operationsProfile: OperationsProfile[];
}

export function CharterSetupScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { user, orgId, accountType } = useAuth();
  const { account, loading: accountLoading } = useCharterAccount(orgId);

  const [step, setStep] = React.useState<Step>('Basics');
  const [draft, setDraft] = React.useState<Draft>(() => emptyDraft());
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const seedRef = React.useRef(false);

  // Seed from the existing org doc once it's loaded (handles re-entry
  // from settings + resuming an in-progress onboarding).
  React.useEffect(() => {
    if (seedRef.current || !account) return;
    seedRef.current = true;
    setDraft({
      name: account.name && account.name !== '—' ? account.name : '',
      contactEmail: account.contactEmail,
      contactPhone: account.contactPhone,
      description: account.description ?? '',
      fleet: account.fleet,
      harbors: account.harbors,
      operationsProfile: account.operationsProfile,
    });
  }, [account]);

  const stepIdx = STEPS.indexOf(step);
  const advance = () => setStep(STEPS[Math.min(STEPS.length - 1, stepIdx + 1)]);
  const retreat = () => setStep(STEPS[Math.max(0, stepIdx - 1)]);

  const stepValid = (s: Step): boolean => {
    switch (s) {
      case 'Basics':     return basicsValid(draft);
      case 'Fleet':      return draft.fleet.length > 0 && draft.fleet.every(vesselValid);
      case 'Harbors':    return draft.harbors.length > 0 && draft.harbors.every(harborValid);
      case 'Operations': return draft.operationsProfile.length > 0 && draft.operationsProfile.every(profileValid);
      case 'Review':     return STEPS.slice(0, 4).every((s2) => stepValid(s2));
    }
  };

  const onLaunch = async () => {
    if (!orgId) { setSaveError('No orgId on your account — re-provision via the dev callable.'); return; }
    if (!stepValid('Review')) { setSaveError('Some required fields are still empty. Use the stepper to jump back.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await saveOnboarding(orgId, {
        name: draft.name.trim(),
        contactEmail: draft.contactEmail.trim(),
        contactPhone: draft.contactPhone.trim(),
        description: draft.description.trim() || null,
        fleet: draft.fleet,
        harbors: draft.harbors,
        operationsProfile: draft.operationsProfile,
      });
      onNavigate?.('charter-home');
    } catch (e) {
      setSaveError((e as Error).message || 'Could not save onboarding');
    } finally {
      setSaving(false);
    }
  };

  // ── Render guard for the not-yet-charter case ──
  if (accountType !== 'charter') {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.kicker}>CHARTER SETUP</Text>
          <Text style={styles.title}>You're not provisioned as a charter operator yet.</Text>
          <Text style={styles.body}>
            Your <Text style={styles.mono}>users/{user?.uid ?? '???'}.accountType</Text> is{' '}
            <Text style={styles.mono}>{accountType}</Text>. The onboarding wizard expects{' '}
            <Text style={styles.mono}>charter</Text>. If you have an invite or a sales contact, ask
            them to flip the role. Self-service provisioning is dev-only via the
            <Text style={styles.mono}> provisionCharterOperator</Text> callable.
          </Text>
          <Pressable onPress={() => onNavigate?.('dashboard')} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Back to dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (accountLoading) {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.body}>Reading your charter org…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.wizardCard}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>CHARTER ONBOARDING</Text>
            <Text style={styles.title}>{account?.setupComplete ? 'Edit org settings' : 'Set up your charter org'}</Text>
            <Text style={styles.subtitle}>Step {stepIdx + 1} of {STEPS.length} — {step}</Text>
          </View>
        </View>

        <Stepper current={step} onJump={(s) => setStep(s)} stepValid={stepValid} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {step === 'Basics'     && <BasicsStep   draft={draft} setDraft={setDraft} />}
          {step === 'Fleet'      && <FleetStep    draft={draft} setDraft={setDraft} />}
          {step === 'Harbors'    && <HarborsStep  draft={draft} setDraft={setDraft} />}
          {step === 'Operations' && <OperationsStep draft={draft} setDraft={setDraft} />}
          {step === 'Review'     && <ReviewStep   draft={draft} stepValid={stepValid} onJump={setStep} saveError={saveError} />}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={retreat} disabled={stepIdx === 0} style={[styles.footerBtn, stepIdx === 0 && styles.footerBtnDisabled]}>
            <Text style={[styles.footerBtnText, stepIdx === 0 && styles.footerBtnTextDisabled]}>← Back</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {step === 'Review' ? (
            <Pressable
              onPress={onLaunch}
              disabled={!stepValid('Review') || saving}
              style={[styles.footerBtn, styles.footerBtnPrimary, (!stepValid('Review') || saving) && styles.footerBtnDisabled]}
            >
              <Text style={[styles.footerBtnText, styles.footerBtnTextPrimary]}>
                {saving ? 'Saving…' : 'Launch Charter Dashboard'}
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
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────

function Stepper({ current, onJump, stepValid }: { current: Step; onJump: (s: Step) => void; stepValid: (s: Step) => boolean }) {
  const currentIdx = STEPS.indexOf(current);
  return (
    <View style={styles.stepperRow}>
      {STEPS.map((s, i) => {
        const isCurrent = s === current;
        // Only allow jumping forward if all prior steps validate.
        const priorValid = STEPS.slice(0, i).every((p) => stepValid(p));
        const disabled = i > currentIdx && !priorValid;
        return (
          <Pressable
            key={s}
            onPress={() => !disabled && onJump(s)}
            style={[styles.stepperItem, isCurrent && styles.stepperItemActive]}
          >
            <Text style={[styles.stepperNum, isCurrent && styles.stepperNumActive, disabled && styles.stepperMuted]}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <Text style={[styles.stepperLabel, isCurrent && styles.stepperLabelActive, disabled && styles.stepperMuted]}>{s}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 1: Basics ──────────────────────────────────────────────────

function BasicsStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  return (
    <View style={styles.stepWrap}>
      <Text style={styles.stepHint}>
        The fundamentals — these surface on the float-plan share, the trip planner, and any future
        billing tools. You can edit any of this later from <Text style={styles.mono}>/charter/settings</Text>.
      </Text>
      <Field label="Charter company name *">
        <TextInput value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Blue Water Charters" placeholderTextColor={colors.text4} style={styles.input} />
      </Field>
      <View style={styles.row2}>
        <Field label="Contact email *">
          <TextInput value={draft.contactEmail} onChangeText={(v) => setDraft((d) => ({ ...d, contactEmail: v }))} placeholder="captain@bluewater.com" placeholderTextColor={colors.text4} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
        </Field>
        <Field label="Contact phone *">
          <TextInput value={draft.contactPhone} onChangeText={(v) => setDraft((d) => ({ ...d, contactPhone: v }))} placeholder="(808) 555-0142" placeholderTextColor={colors.text4} keyboardType="phone-pad" style={styles.input} />
        </Field>
      </View>
      <Field label="Brief description (optional)">
        <TextInput value={draft.description} onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))} placeholder="Family-owned dive charter operating out of Haleiwa since 2008…" placeholderTextColor={colors.text4} multiline numberOfLines={3} style={[styles.input, styles.textarea]} />
      </Field>
    </View>
  );
}

// ─── Step 2: Fleet ──────────────────────────────────────────────────

function FleetStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  const addVessel = () => setDraft((d) => ({ ...d, fleet: [...d.fleet, emptyVessel()] }));
  const updateVessel = (i: number, patch: Partial<Vessel>) =>
    setDraft((d) => ({ ...d, fleet: d.fleet.map((v, idx) => idx === i ? { ...v, ...patch } : v) }));
  const removeVessel = (i: number) => setDraft((d) => ({ ...d, fleet: d.fleet.filter((_, idx) => idx !== i) }));

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.stepHint}>
        At least one vessel is required. The fleet drives capacity checks on trip creation and seeds
        the per-trip pre-departure safety-gear checklist.
      </Text>
      {draft.fleet.map((v, i) => (
        <VesselCard
          key={v.vesselId}
          vessel={v}
          index={i}
          canRemove={draft.fleet.length > 1}
          onPatch={(p) => updateVessel(i, p)}
          onRemove={() => removeVessel(i)}
        />
      ))}
      <Pressable onPress={addVessel} style={styles.addEntryBtn}>
        <Text style={styles.addEntryText}>+ Add another vessel</Text>
      </Pressable>
    </View>
  );
}

export function VesselCard({
  vessel, index, canRemove, onPatch, onRemove,
}: {
  vessel: Vessel;
  index: number;
  canRemove: boolean;
  onPatch: (patch: Partial<Vessel>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.subCard}>
      <View style={styles.subCardHeader}>
        <Text style={styles.subCardLabel}>VESSEL {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <Field label="Vessel name *">
        <TextInput value={vessel.name} onChangeText={(v) => onPatch({ name: v })} placeholder="Kaimana" placeholderTextColor={colors.text4} style={styles.input} />
      </Field>
      <Field label="Type">
        <ChipSelect
          options={VESSEL_TYPE_OPTIONS}
          value={vessel.type}
          onChange={(v) => onPatch({ type: v, typeFreeText: v === 'other' ? vessel.typeFreeText ?? '' : null })}
        />
      </Field>
      {vessel.type === 'other' ? (
        <Field label="Vessel type (write-in)">
          <TextInput value={vessel.typeFreeText ?? ''} onChangeText={(v) => onPatch({ typeFreeText: v })} placeholder="e.g. Trimaran" placeholderTextColor={colors.text4} style={styles.input} />
        </Field>
      ) : null}
      <View style={styles.row2}>
        <NumberStepper label="Length (ft)" value={vessel.lengthFt || null} onChange={(v) => onPatch({ lengthFt: v ?? 0 })} step={1} min={10} max={150} unit="ft" />
        <NumberStepper label="Passenger capacity" value={vessel.passengerCapacity || null} onChange={(v) => onPatch({ passengerCapacity: v ?? 0 })} step={1} min={1} max={150} unit="ppl" />
      </View>
      <View style={styles.row2}>
        <NumberStepper label="Dive capacity (optional)" value={vessel.diveCapacity} onChange={(v) => onPatch({ diveCapacity: v })} step={1} min={0} max={150} unit="divers" />
        <Field label="Engine">
          <ChipSelect
            options={ENGINE_OPTIONS}
            value={vessel.engineConfig}
            onChange={(v) => onPatch({ engineConfig: v })}
          />
        </Field>
      </View>
      <Field label="Safety gear on board">
        <View style={styles.safetyGrid}>
          <ToggleRow label="O2 Kit"        value={vessel.safetyGear.o2Kit}        onChange={(v) => onPatch({ safetyGear: { ...vessel.safetyGear, o2Kit: v } })} />
          <ToggleRow label="AED"           value={vessel.safetyGear.aed}          onChange={(v) => onPatch({ safetyGear: { ...vessel.safetyGear, aed: v } })} />
          <ToggleRow label="First Aid Kit" value={vessel.safetyGear.firstAidKit}  onChange={(v) => onPatch({ safetyGear: { ...vessel.safetyGear, firstAidKit: v } })} />
          <ToggleRow label="EPIRB"         value={vessel.safetyGear.epirb}        onChange={(v) => onPatch({ safetyGear: { ...vessel.safetyGear, epirb: v } })} />
          <ToggleRow label="Life Rafts"    value={vessel.safetyGear.lifeRafts}    onChange={(v) => onPatch({ safetyGear: { ...vessel.safetyGear, lifeRafts: v } })} />
          <ToggleRow label="VHF Radio"     value={vessel.safetyGear.vhfRadio}     onChange={(v) => onPatch({ safetyGear: { ...vessel.safetyGear, vhfRadio: v } })} />
        </View>
      </Field>
      <Field label="Notes (optional)">
        <TextInput value={vessel.notes ?? ''} onChangeText={(v) => onPatch({ notes: v || null })} placeholder="Any notes specific to this vessel" placeholderTextColor={colors.text4} multiline numberOfLines={2} style={[styles.input, styles.textarea]} />
      </Field>
    </View>
  );
}

// ─── Step 3: Harbors ────────────────────────────────────────────────

function HarborsStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  const addHarbor = () => setDraft((d) => ({ ...d, harbors: [...d.harbors, emptyHarbor()] }));
  const updateHarbor = (i: number, patch: Partial<OrgHarbor>) =>
    setDraft((d) => ({ ...d, harbors: d.harbors.map((h, idx) => idx === i ? { ...h, ...patch } : h) }));
  const removeHarbor = (i: number) => setDraft((d) => ({ ...d, harbors: d.harbors.filter((_, idx) => idx !== i) }));

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.stepHint}>
        At least one harbor required. Home vs Loading matters — the route planner pulls crossing
        conditions from the LOADING harbor (where guests board), not the storage harbor. If they're
        the same, pick Both.
      </Text>
      {draft.harbors.map((h, i) => (
        <HarborCard
          key={h.harborId}
          harbor={h}
          index={i}
          fleet={draft.fleet}
          canRemove={draft.harbors.length > 1}
          onPatch={(p) => updateHarbor(i, p)}
          onRemove={() => removeHarbor(i)}
        />
      ))}
      <Pressable onPress={addHarbor} style={styles.addEntryBtn}>
        <Text style={styles.addEntryText}>+ Add another harbor</Text>
      </Pressable>
    </View>
  );
}

export function HarborCard({
  harbor, index, fleet, canRemove, onPatch, onRemove,
}: {
  harbor: OrgHarbor;
  index: number;
  fleet: Vessel[];
  canRemove: boolean;
  onPatch: (patch: Partial<OrgHarbor>) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = React.useState('');
  const matches = React.useMemo(() => searchHarborPresets(search), [search]);
  const pickPreset = (p: HarborPreset) => {
    onPatch({ name: p.name, lat: p.lat, lng: p.lng });
    setSearch('');
  };
  const toggleVessel = (vesselId: string) => {
    onPatch({
      vesselIds: harbor.vesselIds.includes(vesselId)
        ? harbor.vesselIds.filter((v) => v !== vesselId)
        : [...harbor.vesselIds, vesselId],
    });
  };
  return (
    <View style={styles.subCard}>
      <View style={styles.subCardHeader}>
        <Text style={styles.subCardLabel}>HARBOR {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      <Field label="Search Hawaii harbors">
        <TextInput value={search} onChangeText={setSearch} placeholder="Haleiwa, Lahaina, Honokohau…" placeholderTextColor={colors.text4} style={styles.input} />
        {matches.length > 0 ? (
          <View style={styles.matchList}>
            {matches.map((m) => (
              <Pressable key={m.id} onPress={() => pickPreset(m)} style={styles.matchRow}>
                <Text style={styles.matchName}>{m.name}</Text>
                <Text style={styles.matchMeta}>{m.island} · {m.lat.toFixed(3)}, {m.lng.toFixed(3)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Field>

      <Field label="Harbor name *">
        <TextInput value={harbor.name} onChangeText={(v) => onPatch({ name: v })} placeholder="Haleiwa Small Boat Harbor" placeholderTextColor={colors.text4} style={styles.input} />
      </Field>
      <View style={styles.row2}>
        <Field label="Latitude *">
          <TextInput value={String(harbor.lat || '')} onChangeText={(v) => onPatch({ lat: parseFloat(sanitizeCoord(v)) || 0 })} placeholder="21.5915" placeholderTextColor={colors.text4} keyboardType="numeric" style={styles.input} />
        </Field>
        <Field label="Longitude *">
          <TextInput value={String(harbor.lng || '')} onChangeText={(v) => onPatch({ lng: parseFloat(sanitizeCoord(v)) || 0 })} placeholder="-158.1098" placeholderTextColor={colors.text4} keyboardType="numeric" style={styles.input} />
        </Field>
      </View>

      <Field label="Role">
        <ChipSelect
          options={HARBOR_ROLE_OPTIONS}
          value={harbor.role}
          onChange={(v) => onPatch({ role: v })}
        />
      </Field>

      <Field label="Vessels operating from this harbor">
        {fleet.length === 0 ? (
          <Text style={styles.muted}>Add at least one vessel in Step 2 first.</Text>
        ) : (
          <View style={styles.chipRow}>
            {fleet.map((v) => {
              const active = harbor.vesselIds.includes(v.vesselId);
              return (
                <Pressable
                  key={v.vesselId}
                  onPress={() => toggleVessel(v.vesselId)}
                  style={[styles.choiceChip, active && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{v.name || '(unnamed)'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Field>

      <Field label="Notes (optional)">
        <TextInput value={harbor.notes ?? ''} onChangeText={(v) => onPatch({ notes: v || null })} placeholder="Load at slip C-12…" placeholderTextColor={colors.text4} multiline numberOfLines={2} style={[styles.input, styles.textarea]} />
      </Field>
    </View>
  );
}

// ─── Step 4: Operations ────────────────────────────────────────────

function OperationsStep({ draft, setDraft }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  const addProfile = () => setDraft((d) => ({
    ...d,
    operationsProfile: [...d.operationsProfile, emptyProfile(d.harbors[0]?.harborId ?? '', d.fleet[0]?.vesselId ?? '')],
  }));
  const updateProfile = (i: number, patch: Partial<OperationsProfile>) =>
    setDraft((d) => ({ ...d, operationsProfile: d.operationsProfile.map((p, idx) => idx === i ? { ...p, ...patch } : p) }));
  const removeProfile = (i: number) => setDraft((d) => ({ ...d, operationsProfile: d.operationsProfile.filter((_, idx) => idx !== i) }));

  return (
    <View style={styles.stepWrap}>
      <Text style={styles.stepHint}>
        For each trip type you run, define the defaults so the trip planner pre-fills harbor, vessel,
        duration, and departure-time chips. A captain running the same 8am North Shore charter every
        Tuesday picks "Dive Charter" once and it's done.
      </Text>
      {draft.operationsProfile.map((p, i) => (
        <ProfileCard
          key={p.profileId}
          profile={p}
          index={i}
          harbors={draft.harbors}
          fleet={draft.fleet}
          canRemove={draft.operationsProfile.length > 1}
          onPatch={(patch) => updateProfile(i, patch)}
          onRemove={() => removeProfile(i)}
        />
      ))}
      <Pressable onPress={addProfile} style={styles.addEntryBtn}>
        <Text style={styles.addEntryText}>+ Add another trip type</Text>
      </Pressable>
    </View>
  );
}

export function ProfileCard({
  profile, index, harbors, fleet, canRemove, onPatch, onRemove,
}: {
  profile: OperationsProfile;
  index: number;
  harbors: OrgHarbor[];
  fleet: Vessel[];
  canRemove: boolean;
  onPatch: (patch: Partial<OperationsProfile>) => void;
  onRemove: () => void;
}) {
  const [newTime, setNewTime] = React.useState('');
  const addTime = () => {
    const t = newTime.trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) return;
    if (profile.typicalDepartureTimes.includes(t)) return;
    onPatch({ typicalDepartureTimes: [...profile.typicalDepartureTimes, t].sort() });
    setNewTime('');
  };
  const removeTime = (t: string) => onPatch({ typicalDepartureTimes: profile.typicalDepartureTimes.filter((x) => x !== t) });

  const addArea = () => onPatch({ destinationAreas: [...profile.destinationAreas, { label: '', lat: 0, lng: 0, radiusMiles: 5 }] });
  const updateArea = (i: number, patch: Partial<DestinationArea>) =>
    onPatch({ destinationAreas: profile.destinationAreas.map((a, idx) => idx === i ? { ...a, ...patch } : a) });
  const removeArea = (i: number) => onPatch({ destinationAreas: profile.destinationAreas.filter((_, idx) => idx !== i) });

  return (
    <View style={styles.subCard}>
      <View style={styles.subCardHeader}>
        <Text style={styles.subCardLabel}>TRIP TYPE {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      <Field label="Trip type">
        <ChipSelect
          options={OPS_TRIP_TYPE_OPTIONS}
          value={profile.tripType}
          onChange={(v) => onPatch({ tripType: v, tripTypeFreeText: v === 'other' ? profile.tripTypeFreeText ?? '' : null })}
        />
      </Field>
      {profile.tripType === 'other' ? (
        <Field label="Trip type (write-in)">
          <TextInput value={profile.tripTypeFreeText ?? ''} onChangeText={(v) => onPatch({ tripTypeFreeText: v })} placeholder="e.g. Photography charter" placeholderTextColor={colors.text4} style={styles.input} />
        </Field>
      ) : null}

      <View style={styles.row2}>
        <Field label="Default departure harbor">
          {harbors.length === 0 ? <Text style={styles.muted}>Add a harbor in Step 3 first.</Text> : (
            <View style={styles.chipRow}>
              {harbors.map((h) => {
                const active = profile.defaultDepartureHarborId === h.harborId;
                return (
                  <Pressable key={h.harborId} onPress={() => onPatch({ defaultDepartureHarborId: h.harborId })} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{h.name || '(unnamed)'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Field>
        <Field label="Default vessel">
          {fleet.length === 0 ? <Text style={styles.muted}>Add a vessel in Step 2 first.</Text> : (
            <View style={styles.chipRow}>
              {fleet.map((v) => {
                const active = profile.defaultVesselId === v.vesselId;
                return (
                  <Pressable key={v.vesselId} onPress={() => onPatch({ defaultVesselId: v.vesselId })} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{v.name || '(unnamed)'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Field>
      </View>

      <NumberStepper label="Typical duration (hours)" value={profile.typicalDurationHrs || null} onChange={(v) => onPatch({ typicalDurationHrs: v ?? 0 })} step={0.5} min={0.5} max={24} unit="hrs" />

      <Field label="Typical departure times">
        <View style={styles.timeChipsRow}>
          {profile.typicalDepartureTimes.map((t) => (
            <Pressable key={t} onPress={() => removeTime(t)} style={styles.timeChip}>
              <Text style={styles.timeChipText}>{t}</Text>
              <Text style={styles.timeChipX}>×</Text>
            </Pressable>
          ))}
          <View style={styles.timeChipAdd}>
            <TextInput value={newTime} onChangeText={setNewTime} onSubmitEditing={addTime} placeholder="07:00" placeholderTextColor={colors.text4} style={styles.timeChipInput} />
            <Pressable onPress={addTime} style={styles.timeChipAddBtn}>
              <Text style={styles.timeChipAddText}>+</Text>
            </Pressable>
          </View>
        </View>
      </Field>

      <Field label="Destination areas (loose route-planner seeds)">
        {profile.destinationAreas.map((a, i) => (
          <View key={i} style={styles.areaRow}>
            <TextInput value={a.label} onChangeText={(v) => updateArea(i, { label: v })} placeholder="North Shore reef system" placeholderTextColor={colors.text4} style={[styles.input, { flex: 2 }]} />
            <TextInput value={String(a.lat || '')} onChangeText={(v) => updateArea(i, { lat: parseFloat(sanitizeCoord(v)) || 0 })} placeholder="Lat" placeholderTextColor={colors.text4} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
            <TextInput value={String(a.lng || '')} onChangeText={(v) => updateArea(i, { lng: parseFloat(sanitizeCoord(v)) || 0 })} placeholder="Lng" placeholderTextColor={colors.text4} keyboardType="numeric" style={[styles.input, { flex: 1 }]} />
            <TextInput value={String(a.radiusMiles || '')} onChangeText={(v) => updateArea(i, { radiusMiles: parseFloat(v.replace(/[^0-9.]/g, '')) || 0 })} placeholder="mi" placeholderTextColor={colors.text4} keyboardType="numeric" style={[styles.input, { width: 60 }]} />
            <Pressable onPress={() => removeArea(i)} style={styles.removeBtn}><Text style={styles.removeBtnText}>×</Text></Pressable>
          </View>
        ))}
        <Pressable onPress={addArea} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>+ Add destination area</Text>
        </Pressable>
      </Field>

      <Field label="Notes (optional)">
        <TextInput value={profile.notes ?? ''} onChangeText={(v) => onPatch({ notes: v || null })} placeholder="e.g. Sunset runs Apr–Oct only" placeholderTextColor={colors.text4} multiline numberOfLines={2} style={[styles.input, styles.textarea]} />
      </Field>
    </View>
  );
}

// ─── Step 5: Review ────────────────────────────────────────────────

function ReviewStep({ draft, stepValid, onJump, saveError }: { draft: Draft; stepValid: (s: Step) => boolean; onJump: (s: Step) => void; saveError: string | null }) {
  return (
    <View style={styles.stepWrap}>
      <ReviewBlock label="Organization" valid={stepValid('Basics')} onEdit={() => onJump('Basics')}>
        <Text style={styles.reviewBig}>{draft.name || '—'}</Text>
        <Text style={styles.reviewMeta}>{draft.contactEmail || '—'} · {draft.contactPhone || '—'}</Text>
        {draft.description ? <Text style={styles.reviewMeta}>{draft.description}</Text> : null}
      </ReviewBlock>

      <ReviewBlock label={`Fleet · ${draft.fleet.length}`} valid={stepValid('Fleet')} onEdit={() => onJump('Fleet')}>
        {draft.fleet.length === 0 ? <Text style={styles.reviewMuted}>No vessels.</Text> : draft.fleet.map((v) => (
          <Text key={v.vesselId} style={styles.reviewLine}>
            · {v.name || '(unnamed)'} — {VESSEL_TYPE_OPTIONS.find((o) => o.id === v.type)?.label ?? v.type}, {v.lengthFt}ft, {v.passengerCapacity}-pax, {ENGINE_OPTIONS.find((o) => o.id === v.engineConfig)?.label ?? v.engineConfig}
          </Text>
        ))}
      </ReviewBlock>

      <ReviewBlock label={`Harbors · ${draft.harbors.length}`} valid={stepValid('Harbors')} onEdit={() => onJump('Harbors')}>
        {draft.harbors.length === 0 ? <Text style={styles.reviewMuted}>No harbors.</Text> : draft.harbors.map((h) => (
          <Text key={h.harborId} style={styles.reviewLine}>
            · {h.name || '(unnamed)'} — {h.role}, {h.vesselIds.length} vessel{h.vesselIds.length === 1 ? '' : 's'}
          </Text>
        ))}
      </ReviewBlock>

      <ReviewBlock label={`Operations · ${draft.operationsProfile.length}`} valid={stepValid('Operations')} onEdit={() => onJump('Operations')}>
        {draft.operationsProfile.length === 0 ? <Text style={styles.reviewMuted}>No trip-type profiles.</Text> : draft.operationsProfile.map((p) => (
          <Text key={p.profileId} style={styles.reviewLine}>
            · {OPS_TRIP_TYPE_OPTIONS.find((o) => o.id === p.tripType)?.label ?? p.tripType} — {p.typicalDurationHrs}h, departs {p.typicalDepartureTimes.join(' / ') || '—'}, {p.destinationAreas.length} area{p.destinationAreas.length === 1 ? '' : 's'}
          </Text>
        ))}
      </ReviewBlock>

      {saveError ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not save</Text>
          <Text style={styles.errBody}>{saveError}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewBlock({ label, valid, onEdit, children }: { label: string; valid: boolean; onEdit: () => void; children: React.ReactNode }) {
  return (
    <View style={[styles.reviewBlock, !valid && styles.reviewBlockInvalid]}>
      <View style={styles.reviewBlockHeader}>
        <Text style={styles.reviewLabel}>{label}{valid ? '' : ' · NEEDS WORK'}</Text>
        <Pressable onPress={onEdit} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>Edit</Text>
        </Pressable>
      </View>
      <View style={{ gap: 4, marginTop: 6 }}>{children}</View>
    </View>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Validation + defaults ─────────────────────────────────────────

function emptyDraft(): Draft {
  return {
    name: '',
    contactEmail: '',
    contactPhone: '',
    description: '',
    fleet: [emptyVessel()],
    harbors: [emptyHarbor()],
    operationsProfile: [emptyProfile('', '')],
  };
}

export function emptyVessel(): Vessel {
  return {
    vesselId: newVesselId(),
    name: '',
    type: 'center_console',
    typeFreeText: null,
    lengthFt: 0,
    passengerCapacity: 0,
    diveCapacity: null,
    engineConfig: 'twin_outboard',
    safetyGear: { o2Kit: true, aed: false, firstAidKit: true, epirb: false, lifeRafts: false, vhfRadio: true },
    notes: null,
  };
}

export function emptyHarbor(): OrgHarbor {
  return {
    harborId: newHarborId(),
    name: '',
    lat: 0,
    lng: 0,
    role: 'both',
    vesselIds: [],
    notes: null,
  };
}

export function emptyProfile(defaultHarborId: string, defaultVesselId: string): OperationsProfile {
  return {
    profileId: newProfileId(),
    tripType: 'dive_charter',
    tripTypeFreeText: null,
    defaultDepartureHarborId: defaultHarborId,
    defaultVesselId,
    typicalDurationHrs: 5,
    typicalDepartureTimes: [],
    destinationAreas: [],
    notes: null,
  };
}

function basicsValid(d: Draft): boolean {
  return d.name.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail.trim())
    && d.contactPhone.trim().length > 0;
}

export function vesselValid(v: Vessel): boolean {
  return v.name.trim().length > 0
    && v.lengthFt > 0
    && v.passengerCapacity > 0
    && (v.type !== 'other' || (v.typeFreeText ?? '').trim().length > 0);
}

export function harborValid(h: OrgHarbor): boolean {
  return h.name.trim().length > 0
    && h.lat >= -90 && h.lat <= 90 && h.lat !== 0
    && h.lng >= -180 && h.lng <= 180 && h.lng !== 0;
}

export function profileValid(p: OperationsProfile): boolean {
  return !!p.defaultDepartureHarborId
    && !!p.defaultVesselId
    && p.typicalDurationHrs > 0
    && (p.tripType !== 'other' || (p.tripTypeFreeText ?? '').trim().length > 0);
}

export function sanitizeCoord(s: string): string {
  let out = s.replace(/[^0-9.\-]/g, '');
  if (out.length > 0) {
    const first = out[0] === '-' ? '-' : '';
    out = first + out.slice(first.length).replace(/-/g, '');
  }
  const dot = out.indexOf('.');
  if (dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '');
  return out;
}

// ─── Suppress unused-import warnings ───────────────────────────────

// HAWAII_HARBORS is re-exported by hawaiiHarbors.ts; importing it here
// keeps the type-test reachable in case the searchHarborPresets API
// changes. _SafetyGear keeps the SafetyGear shape pinned.
const _harborsSentinel: typeof HAWAII_HARBORS | null = null;
const _safetySentinel: SafetyGear | null = null;
void _harborsSentinel; void _safetySentinel;

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 24, alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, padding: 28, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 18 },
  wizardCard: { width: '100%', maxWidth: 760, height: '92%', backgroundColor: colors.surface0, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, overflow: 'hidden' },

  header: { padding: 20, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  kicker: { fontFamily: fonts.mono, fontSize: 11, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 22, fontWeight: '800', color: colors.text1, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, letterSpacing: 0.8, marginTop: 4 },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text2, lineHeight: 22 },
  mono: { fontFamily: fonts.mono, color: colors.accent, fontSize: 13 },

  stepperRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  stepperItem: { flex: 1, padding: 8, gap: 2, borderRadius: radius.sm, alignItems: 'center' },
  stepperItemActive: { backgroundColor: colors.surface1 },
  stepperNum: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, fontWeight: '700' },
  stepperNumActive: { color: colors.accent },
  stepperLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontWeight: '600' },
  stepperLabelActive: { color: colors.text1 },
  stepperMuted: { color: colors.text4, opacity: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  stepWrap: { gap: 16 },
  stepHint: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, lineHeight: 20 },

  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  input: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, fontFamily: fonts.body, fontSize: 13, color: colors.text1 },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  muted: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choiceChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  choiceChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.10)' },
  choiceText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text2 },
  choiceTextActive: { color: colors.text1 },

  subCard: { gap: 12, padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  subCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subCardLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: '#F73726' },
  removeBtnText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: '#F73726' },

  safetyGrid: { gap: 6 },
  matchList: { gap: 2, padding: 4, borderRadius: radius.sm, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  matchRow: { padding: 8, borderRadius: radius.sm, gap: 2 },
  matchName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  matchMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3 },

  timeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  timeChipText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.bg },
  timeChipX: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.bg },
  timeChipAdd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeChipInput: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0, fontFamily: fonts.mono, fontSize: 12, color: colors.text1, width: 80 },
  timeChipAddBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  timeChipAddText: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.text2 },

  areaRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },

  smallBtn: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  smallBtnText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text2 },

  addEntryBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  addEntryText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  reviewBlock: { padding: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline, gap: 4 },
  reviewBlockInvalid: { borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.06)' },
  reviewBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  reviewBig: { fontFamily: fonts.display, fontSize: 16, fontWeight: '700', color: colors.text1 },
  reviewMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, marginTop: 2 },
  reviewLine: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 18 },
  reviewMuted: { fontFamily: fonts.body, fontSize: 12, color: colors.text4, fontStyle: 'italic' },

  errCard: { padding: 14, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726', gap: 4 },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.surface1 },
  footerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  footerBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  footerBtnDisabled: { opacity: 0.4 },
  footerBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  footerBtnTextPrimary: { color: colors.bg },
  footerBtnTextDisabled: { color: colors.text4 },

  primaryBtn: { alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.accent },
  primaryBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
});
