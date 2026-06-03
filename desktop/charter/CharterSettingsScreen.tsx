// CharterSettingsScreen — tabbed editor for the operations profile.
// Sits at /charter/settings. Each tab reuses the same VesselCard /
// HarborCard / ProfileCard components the wizard uses (exported from
// CharterSetupScreen) but with per-tab Save buttons that persist the
// matching slice of charter_accounts/{orgId}. setupComplete is NOT
// touched — only the wizard's "Launch" can flip that.

import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useAuth } from '../hooks/useAuth';
import { CharterShell } from './CharterShell';
import { useCharterAccount } from './useCharterData';
import {
  VesselCard, HarborCard, ProfileCard,
  emptyVessel, emptyHarbor, emptyProfile,
  vesselValid, harborValid, profileValid,
} from './CharterSetupScreen';
import {
  updateOrgBasics, updateOrgFleet, updateOrgHarbors, updateOrgOperations,
} from './saveOnboarding';
import type {
  CharterAccount, Vessel, OrgHarbor, OperationsProfile,
} from './types';
import type { NavigateFn } from '../router';
import { FareHarborTab } from './fareharbor/FareHarborTab';

const TABS = ['Organization', 'Fleet', 'Harbors', 'Operations', 'FareHarbor', 'Account'] as const;
type Tab = (typeof TABS)[number];

export function CharterSettingsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { user, orgId } = useAuth();
  const { account, loading, error } = useCharterAccount(orgId);
  const [tab, setTab] = React.useState<Tab>('Organization');

  if (loading) {
    return (
      <CharterShell active="charter-settings" onNavigate={onNavigate}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Reading charter org…</Text>
        </View>
      </CharterShell>
    );
  }
  if (error) {
    return (
      <CharterShell active="charter-settings" onNavigate={onNavigate}>
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not load settings</Text>
          <Text style={styles.errBody}>{error}</Text>
        </View>
      </CharterShell>
    );
  }
  if (!account || !orgId) {
    return (
      <CharterShell active="charter-settings" onNavigate={onNavigate}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No charter org doc yet.</Text>
          <Text style={styles.emptyBody}>Finish onboarding first — head to /charter/setup.</Text>
          <Pressable onPress={() => onNavigate?.('charter-setup')} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Open onboarding →</Text>
          </Pressable>
        </View>
      </CharterShell>
    );
  }

  return (
    <CharterShell active="charter-settings" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>SETTINGS</Text>
          <Text style={styles.title}>{account.name}</Text>
          <Text style={styles.subtitle}>
            org id <Text style={styles.mono}>{orgId}</Text> · {account.setupComplete ? 'setup complete' : 'setup incomplete — finish at /charter/setup'}
          </Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Organization' && <OrganizationTab orgId={orgId} account={account} />}
      {tab === 'Fleet'        && <FleetTab        orgId={orgId} account={account} />}
      {tab === 'Harbors'      && <HarborsTab      orgId={orgId} account={account} />}
      {tab === 'Operations'   && <OperationsTab   orgId={orgId} account={account} />}
      {tab === 'FareHarbor'   && <FareHarborTab   orgId={orgId} account={account} />}
      {tab === 'Account'      && <AccountTab      account={account} signedInEmail={user?.email ?? ''} />}
    </CharterShell>
  );
}

// ─── Organization tab ───────────────────────────────────────────────

function OrganizationTab({ orgId, account }: { orgId: string; account: CharterAccount }) {
  const [name, setName] = React.useState(account.name);
  const [contactEmail, setContactEmail] = React.useState(account.contactEmail);
  const [contactPhone, setContactPhone] = React.useState(account.contactPhone);
  const [description, setDescription]   = React.useState(account.description ?? '');
  const { save, saving, error, savedAt } = useSaver();

  // Re-seed if the underlying doc changes mid-edit (shouldn't happen
  // often but matters when multiple admins are looking at the same
  // settings screen).
  React.useEffect(() => {
    setName(account.name);
    setContactEmail(account.contactEmail);
    setContactPhone(account.contactPhone);
    setDescription(account.description ?? '');
  }, [account.name, account.contactEmail, account.contactPhone, account.description]);

  const dirty =
    name !== account.name
    || contactEmail !== account.contactEmail
    || contactPhone !== account.contactPhone
    || (description ?? '') !== (account.description ?? '');
  const valid =
    name.trim().length > 0
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
    && contactPhone.trim().length > 0;

  const onSave = () => save(() => updateOrgBasics(orgId, {
    name: name.trim(),
    contactEmail: contactEmail.trim(),
    contactPhone: contactPhone.trim(),
    description: description.trim() || null,
  }));

  return (
    <Section title="Organization" footer={<SaveBar dirty={dirty} valid={valid} saving={saving} savedAt={savedAt} onSave={onSave} error={error} />}>
      <Field label="Charter company name *">
        <TextInput value={name} onChangeText={setName} placeholder="Blue Water Charters" placeholderTextColor={colors.text4} style={styles.input} />
      </Field>
      <View style={styles.row2}>
        <Field label="Contact email *">
          <TextInput value={contactEmail} onChangeText={setContactEmail} placeholder="captain@bluewater.com" placeholderTextColor={colors.text4} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
        </Field>
        <Field label="Contact phone *">
          <TextInput value={contactPhone} onChangeText={setContactPhone} placeholder="(808) 555-0142" placeholderTextColor={colors.text4} keyboardType="phone-pad" style={styles.input} />
        </Field>
      </View>
      <Field label="Description (optional)">
        <TextInput value={description} onChangeText={setDescription} placeholder="Family-owned dive charter…" placeholderTextColor={colors.text4} multiline numberOfLines={3} style={[styles.input, styles.textarea]} />
      </Field>
    </Section>
  );
}

// ─── Fleet tab ──────────────────────────────────────────────────────

function FleetTab({ orgId, account }: { orgId: string; account: CharterAccount }) {
  const [fleet, setFleet] = React.useState<Vessel[]>(() => account.fleet.length > 0 ? account.fleet : [emptyVessel()]);
  const { save, saving, error, savedAt } = useSaver();

  React.useEffect(() => {
    setFleet(account.fleet.length > 0 ? account.fleet : [emptyVessel()]);
    // Don't include emptyVessel in the dep array (new ref each render) — only re-seed when the doc fleet array changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.fleet]);

  const dirty   = !shallowEqualFleet(fleet, account.fleet);
  const valid   = fleet.length > 0 && fleet.every(vesselValid);

  const onSave = () => save(() => updateOrgFleet(orgId, fleet));

  return (
    <Section
      title={`Fleet (${fleet.length})`}
      footer={<SaveBar dirty={dirty} valid={valid} saving={saving} savedAt={savedAt} onSave={onSave} error={error} />}
    >
      {fleet.map((v, i) => (
        <VesselCard
          key={v.vesselId}
          vessel={v}
          index={i}
          canRemove={fleet.length > 1}
          onPatch={(p) => setFleet((arr) => arr.map((x, idx) => idx === i ? { ...x, ...p } : x))}
          onRemove={() => setFleet((arr) => arr.filter((_, idx) => idx !== i))}
        />
      ))}
      <Pressable onPress={() => setFleet((arr) => [...arr, emptyVessel()])} style={styles.addEntryBtn}>
        <Text style={styles.addEntryText}>+ Add another vessel</Text>
      </Pressable>
    </Section>
  );
}

// ─── Harbors tab ────────────────────────────────────────────────────

function HarborsTab({ orgId, account }: { orgId: string; account: CharterAccount }) {
  const [harbors, setHarbors] = React.useState<OrgHarbor[]>(() => account.harbors.length > 0 ? account.harbors : [emptyHarbor()]);
  const { save, saving, error, savedAt } = useSaver();

  React.useEffect(() => {
    setHarbors(account.harbors.length > 0 ? account.harbors : [emptyHarbor()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.harbors]);

  const dirty = !shallowEqualHarbors(harbors, account.harbors);
  const valid = harbors.length > 0 && harbors.every(harborValid);

  const onSave = () => save(() => updateOrgHarbors(orgId, harbors));

  return (
    <Section
      title={`Harbors (${harbors.length})`}
      footer={<SaveBar dirty={dirty} valid={valid} saving={saving} savedAt={savedAt} onSave={onSave} error={error} />}
    >
      {harbors.map((h, i) => (
        <HarborCard
          key={h.harborId}
          harbor={h}
          index={i}
          fleet={account.fleet}
          canRemove={harbors.length > 1}
          onPatch={(p) => setHarbors((arr) => arr.map((x, idx) => idx === i ? { ...x, ...p } : x))}
          onRemove={() => setHarbors((arr) => arr.filter((_, idx) => idx !== i))}
        />
      ))}
      <Pressable onPress={() => setHarbors((arr) => [...arr, emptyHarbor()])} style={styles.addEntryBtn}>
        <Text style={styles.addEntryText}>+ Add another harbor</Text>
      </Pressable>
    </Section>
  );
}

// ─── Operations tab ─────────────────────────────────────────────────

function OperationsTab({ orgId, account }: { orgId: string; account: CharterAccount }) {
  const [profiles, setProfiles] = React.useState<OperationsProfile[]>(() =>
    account.operationsProfile.length > 0
      ? account.operationsProfile
      : [emptyProfile(account.harbors[0]?.harborId ?? '', account.fleet[0]?.vesselId ?? '')]);
  const { save, saving, error, savedAt } = useSaver();

  React.useEffect(() => {
    setProfiles(account.operationsProfile.length > 0
      ? account.operationsProfile
      : [emptyProfile(account.harbors[0]?.harborId ?? '', account.fleet[0]?.vesselId ?? '')]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.operationsProfile]);

  const dirty = !shallowEqualProfiles(profiles, account.operationsProfile);
  const valid = profiles.length > 0 && profiles.every(profileValid);

  const onSave = () => save(() => updateOrgOperations(orgId, profiles));

  return (
    <Section
      title={`Operations (${profiles.length})`}
      footer={<SaveBar dirty={dirty} valid={valid} saving={saving} savedAt={savedAt} onSave={onSave} error={error} />}
    >
      {profiles.map((p, i) => (
        <ProfileCard
          key={p.profileId}
          profile={p}
          index={i}
          harbors={account.harbors}
          fleet={account.fleet}
          canRemove={profiles.length > 1}
          onPatch={(patch) => setProfiles((arr) => arr.map((x, idx) => idx === i ? { ...x, ...patch } : x))}
          onRemove={() => setProfiles((arr) => arr.filter((_, idx) => idx !== i))}
        />
      ))}
      <Pressable
        onPress={() => setProfiles((arr) => [...arr, emptyProfile(account.harbors[0]?.harborId ?? '', account.fleet[0]?.vesselId ?? '')])}
        style={styles.addEntryBtn}
      >
        <Text style={styles.addEntryText}>+ Add another trip type</Text>
      </Pressable>
    </Section>
  );
}

// ─── Account tab ────────────────────────────────────────────────────

function AccountTab({ account, signedInEmail }: { account: CharterAccount; signedInEmail: string }) {
  return (
    <Section title="Account">
      <View style={styles.kvCard}>
        <KvRow label="Charter org id"    value={account.orgId} />
        <KvRow label="Status"            value={account.setupComplete ? 'Active' : 'Setup incomplete'} />
        <KvRow label="Created"           value={account.createdAt ? account.createdAt.toLocaleString() : '—'} />
        <KvRow label="Last updated"      value={account.updatedAt ? account.updatedAt.toLocaleString() : '—'} />
        <KvRow label="Signed in as"      value={signedInEmail || '—'} />
      </View>

      <View style={styles.kvCard}>
        <Text style={styles.subSection}>BILLING & SUBSCRIPTION</Text>
        <Text style={styles.muted}>
          Charter billing isn't wired yet. When it lands you'll see plan tier, next renewal, and
          payment-method management here. For now your org is on the dev / pilot tier with no
          billing attached.
        </Text>
      </View>

      <View style={styles.dangerCard}>
        <Text style={[styles.subSection, { color: '#F73726' }]}>DANGER ZONE</Text>
        <Text style={styles.muted}>
          Org deletion isn't self-serve. To delete this charter org and every trip, log, spot, crew
          member, and alert under it, email <Text style={styles.mono}>support@kaicast.app</Text>{' '}
          with the org id above. We require an out-of-band confirmation because deletion is
          irreversible and affects every crew member's read access.
        </Text>
        <Pressable disabled style={styles.dangerBtnDisabled}>
          <Text style={styles.dangerBtnDisabledText}>Delete org (email-only)</Text>
        </Pressable>
      </View>
    </Section>
  );
}

// ─── Shared ────────────────────────────────────────────────────────

function Section({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView style={styles.sectionScroll} contentContainerStyle={styles.sectionScrollContent}>
        {children}
      </ScrollView>
      {footer ?? null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function SaveBar({
  dirty, valid, saving, savedAt, onSave, error,
}: {
  dirty: boolean; valid: boolean; saving: boolean; savedAt: Date | null; onSave: () => void; error: string | null;
}) {
  const status =
    error      ? <Text style={styles.saveBarErr}>Couldn't save: {error}</Text>
    : saving   ? <Text style={styles.saveBarMeta}>Saving…</Text>
    : !dirty   ? savedAt
        ? <Text style={styles.saveBarMeta}>Saved {ago(savedAt)}</Text>
        : <Text style={styles.saveBarMeta}>No unsaved changes</Text>
    : !valid   ? <Text style={styles.saveBarErr}>Some required fields are still empty.</Text>
    :            <Text style={styles.saveBarMeta}>You have unsaved changes.</Text>;
  return (
    <View style={styles.saveBar}>
      {status}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={onSave}
        disabled={!dirty || !valid || saving}
        style={[styles.saveBtn, (!dirty || !valid || saving) && styles.saveBtnDisabled]}
      >
        <Text style={[styles.saveBtnText, (!dirty || !valid || saving) && styles.saveBtnTextDisabled]}>
          {saving ? 'Saving…' : 'Save changes'}
        </Text>
      </Pressable>
    </View>
  );
}

function useSaver() {
  const [saving, setSaving] = React.useState(false);
  const [error, setError]   = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const save = React.useCallback(async (fn: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      setSavedAt(new Date());
    } catch (e) {
      setError((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, []);
  return { save, saving, error, savedAt };
}

function ago(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// Cheap "did this array change at all" check — JSON.stringify is fine
// for the size of these arrays (a few vessels / harbors / profiles).
// Avoids a deeper structural compare that's not worth the cost.
function shallowEqualFleet(a: Vessel[], b: Vessel[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function shallowEqualHarbors(a: OrgHarbor[], b: OrgHarbor[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function shallowEqualProfiles(a: OperationsProfile[], b: OperationsProfile[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { gap: 4 },
  kicker: { fontFamily: fonts.mono, fontSize: 11, color: colors.accent, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: fonts.display, fontSize: 26, fontWeight: '800', color: colors.text1, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4 },
  mono: { fontFamily: fonts.mono, color: colors.accent, fontSize: 12 },

  tabBar: { flexDirection: 'row', padding: 3, gap: 2, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.sm, alignSelf: 'flex-start' },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm - 2 },
  tabBtnActive: { backgroundColor: colors.surface2 },
  tabBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text3 },
  tabBtnTextActive: { color: colors.text1 },

  section: { gap: 14 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  sectionScroll: { maxHeight: 540 },
  sectionScrollContent: { gap: 16, paddingBottom: 8 },

  fieldLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  input: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, fontFamily: fonts.body, fontSize: 13, color: colors.text1 },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },

  addEntryBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  addEntryText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.hairline },
  saveBarMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },
  saveBarErr: { fontFamily: fonts.body, fontSize: 12, color: '#F73726' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  saveBtnDisabled: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  saveBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  saveBtnTextDisabled: { color: colors.text4 },

  kvCard: { padding: 16, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  kvLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, fontWeight: '600', letterSpacing: 0.5 },
  kvValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.text1 },
  subSection: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },

  dangerCard: { padding: 16, borderRadius: radius.sm, backgroundColor: 'rgba(247,55,38,0.06)', borderWidth: 1, borderColor: '#F73726', gap: 10 },
  dangerBtnDisabled: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  dangerBtnDisabledText: { fontFamily: fonts.body, fontSize: 12, color: colors.text4, fontWeight: '600' },

  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },
  errCard: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  emptyCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline, gap: 10 },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  primaryBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  primaryBtnText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.bg },
});
