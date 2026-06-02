// CharterCrewScreen — Phase 6: real roster + cert-tracking. Each row
// is a CrewListCard with inline cert badges; cards glow red when any
// cert is expired and amber when any cert expires inside 60 days.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { CrewListCard } from './CrewListCard';
import { CrewEditModal } from './CrewEditModal';
import { useCharterCrew, crewWorstCertTier } from './useCharterData';
import { useAuth } from '../hooks/useAuth';
import type { CrewMember, CrewRole } from './types';
import type { NavigateFn } from '../router';

type RoleFilter = CrewRole | 'all';
type CertFilter = 'all' | 'expired' | 'expiring-soon' | 'ok';

export function CharterCrewScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { orgId } = useAuth();
  const { crew, loading, error } = useCharterCrew(orgId);
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all');
  const [certFilter, setCertFilter] = React.useState<CertFilter>('all');
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing]   = React.useState<CrewMember | null>(null);

  const filtered = React.useMemo(() => {
    return crew.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (certFilter !== 'all' && crewWorstCertTier(m) !== certFilter) return false;
      return true;
    });
  }, [crew, roleFilter, certFilter]);

  // Summary counts pinned across the top so a captain sees the
  // expired/expiring backlog at a glance.
  const counts = React.useMemo(() => {
    let expired = 0, expiring = 0;
    for (const m of crew) {
      const t = crewWorstCertTier(m);
      if (t === 'expired') expired++;
      else if (t === 'expiring-soon') expiring++;
    }
    return { total: crew.length, expired, expiring };
  }, [crew]);

  return (
    <CharterShell active="charter-crew" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Crew</Text>
          <Text style={styles.subtitle}>
            Roster + cert tracking. Certs expiring inside 60 days flag yellow; expired flag red.
          </Text>
        </View>
        <Pressable
          onPress={() => orgId && setCreating(true)}
          disabled={!orgId}
          style={[styles.createBtn, !orgId && styles.createBtnDisabled]}
        >
          <Text style={[styles.createBtnText, !orgId && styles.createBtnTextDisabled]}>+ Add crew</Text>
        </Pressable>
      </View>

      {/* Summary stat row */}
      {counts.total > 0 ? (
        <View style={styles.statRow}>
          <Stat label="On roster"     value={counts.total}    tone="neutral" />
          <Stat label="Expiring soon" value={counts.expiring} tone="warn" />
          <Stat label="Expired"       value={counts.expired}  tone="danger" />
        </View>
      ) : null}

      {/* Filters */}
      <View style={styles.filtersRow}>
        <FilterGroup label="Role" options={[
          { id: 'all', label: 'All' },
          { id: 'owner', label: 'Owner' },
          { id: 'captain', label: 'Captain' },
          { id: 'divemaster', label: 'Divemaster' },
          { id: 'deckhand', label: 'Deckhand' },
        ]} value={roleFilter} onChange={setRoleFilter} />
        <FilterGroup label="Cert state" options={[
          { id: 'all', label: 'All' },
          { id: 'expired', label: 'Expired' },
          { id: 'expiring-soon', label: 'Expiring' },
          { id: 'ok', label: 'OK' },
        ]} value={certFilter} onChange={setCertFilter} />
        <Text style={styles.filterMeta}>{filtered.length} of {crew.length}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Reading roster…</Text>
        </View>
      ) : error ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not load roster</Text>
          <Text style={styles.errBody}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {crew.length === 0 ? 'Roster is empty.' : 'No crew match the current filters.'}
          </Text>
          <Text style={styles.emptyBody}>
            {crew.length === 0
              ? 'Hit + Add crew to build the roster. Each crew member can carry a cert list — expiry warnings show up everywhere they appear (trip planner, this screen).'
              : 'Loosen the filters above to see more entries.'}
          </Text>
          {crew.length === 0 && orgId ? (
            <Pressable onPress={() => setCreating(true)} style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>+ Add your first crew →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.crewStack}>
          {filtered.map((m) => (
            <CrewListCard key={m.id} member={m} onEdit={() => setEditing(m)} />
          ))}
        </View>
      )}

      {(creating || editing) && orgId ? (
        <CrewEditModal
          orgId={orgId}
          existing={editing ?? undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      ) : null}
    </CharterShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? '#F73726'
              : tone === 'warn'   ? '#F5A623'
                                  : colors.text1;
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterGroup<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const active = o.id === value;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 600 },
  createBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  createBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  createBtnDisabled: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  createBtnTextDisabled: { color: colors.text4 },

  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, padding: 14, borderRadius: radius.md,
    backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong,
    gap: 4,
  },
  statValue: { fontFamily: fonts.display, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },

  filtersRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20, paddingHorizontal: 4 },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterGroupLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  filterBtnActive: { backgroundColor: colors.surface1, borderColor: colors.accent },
  filterText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text3 },
  filterTextActive: { color: colors.text1 },
  filterMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginLeft: 'auto' },

  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },
  errCard: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  emptyCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline, gap: 10 },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
  emptyCta: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  emptyCtaText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.accent },

  crewStack: { gap: 12 },
});
