// CharterSpotsScreen — Phase 5: real spot library list + add/edit modal.
//
// Each row is a SpotListCard reading its own 7-day forecast via
// useSpotReport (linkedPublicSpotId when set; the spot's own id
// otherwise — which probably returns "no data" for unlinked spots).
// Good Window alert toggle writes through saveCharterSpot directly
// from the card. Cards expose an Edit button that pops the modal.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { SpotListCard } from './SpotListCard';
import { SpotEditModal } from './SpotEditModal';
import { useCharterSpots } from './useCharterData';
import { useAuth } from '../hooks/useAuth';
import type { CharterSpot, TripType } from './types';
import type { NavigateFn } from '../router';

type Filter = 'all' | 'linked' | 'unlinked' | 'with-alerts';

export function CharterSpotsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { orgId } = useAuth();
  const { spots, loading, error } = useCharterSpots(orgId);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [tripTypeFilter, setTripTypeFilter] = React.useState<TripType | 'all'>('all');
  const [editing, setEditing] = React.useState<CharterSpot | null>(null);
  const [creating, setCreating] = React.useState(false);

  const filtered = React.useMemo(() => {
    return spots.filter((s) => {
      if (filter === 'linked'      && !s.linkedPublicSpotId) return false;
      if (filter === 'unlinked'    &&  s.linkedPublicSpotId) return false;
      if (filter === 'with-alerts' && !s.goodWindowAlertsEnabled) return false;
      if (tripTypeFilter !== 'all' && !s.tripTypes.includes(tripTypeFilter)) return false;
      return true;
    });
  }, [spots, filter, tripTypeFilter]);

  return (
    <CharterShell active="charter-spots" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Spots</Text>
          <Text style={styles.subtitle}>
            Your private spot library. Link to public KaiCast spots for forecast data; keep
            captain's-only spots private.
          </Text>
        </View>
        <Pressable
          onPress={() => orgId && setCreating(true)}
          disabled={!orgId}
          style={[styles.createBtn, !orgId && styles.createBtnDisabled]}
        >
          <Text style={[styles.createBtnText, !orgId && styles.createBtnTextDisabled]}>+ Add spot</Text>
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <FilterGroup label="Show" options={[
          { id: 'all', label: 'All' },
          { id: 'linked', label: 'Linked to public' },
          { id: 'unlinked', label: 'Private only' },
          { id: 'with-alerts', label: 'Alerts on' },
        ]} value={filter} onChange={setFilter} />
        <FilterGroup label="Trip type" options={[
          { id: 'all', label: 'All' },
          { id: 'dive', label: 'Scuba' },
          { id: 'freedive', label: 'Freedive' },
          { id: 'snorkel', label: 'Snorkel' },
          { id: 'spearfishing', label: 'Spear' },
        ]} value={tripTypeFilter} onChange={setTripTypeFilter} />
        <Text style={styles.filterMeta}>{filtered.length} of {spots.length} spots</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Reading spot library…</Text>
        </View>
      ) : error ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not load spots</Text>
          <Text style={styles.errBody}>{error}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {spots.length === 0 ? "Library is empty." : "No spots match the current filters."}
          </Text>
          <Text style={styles.emptyBody}>
            {spots.length === 0
              ? "Hit + Add spot to start building your library. Spots can stay private to your org, or link to a canonical KaiCast spot for full forecast data."
              : "Loosen the filters above to see more entries."}
          </Text>
          {spots.length === 0 && orgId ? (
            <Pressable onPress={() => setCreating(true)} style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>+ Add your first spot →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.spotsStack}>
          {filtered.map((s) => (
            <SpotListCard
              key={s.id}
              orgId={orgId!}
              spot={s}
              onEdit={() => setEditing(s)}
            />
          ))}
        </View>
      )}

      {(creating || editing) && orgId ? (
        <SpotEditModal
          orgId={orgId}
          existing={editing ?? undefined}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      ) : null}
    </CharterShell>
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
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 640 },
  createBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.accent },
  createBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  createBtnDisabled: { backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  createBtnTextDisabled: { color: colors.text4 },

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

  spotsStack: { gap: 12 },
});
