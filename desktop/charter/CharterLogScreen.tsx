// CharterLogScreen — Phase 4: real file-a-log picker + archive list +
// per-trip forecast-vs-reality delta panel.
//
//  File tab — lists trips that have departed but don't yet have a
//    captainsLog. Click → CaptainsLogFiler modal walks the 8 blocks.
//  Archive tab — list of completed trips with logs. Click a card to
//    inline-expand the delta panel below.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { CaptainsLogFiler } from './CaptainsLogFiler';
import { TripDetailDelta } from './TripDetailDelta';
import {
  useCharterSpots, useTripsAwaitingLog, useTripsWithLog,
} from './useCharterData';
import { useAuth } from '../hooks/useAuth';
import type { Trip } from './types';
import type { NavigateFn } from '../router';

export function CharterLogScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { orgId } = useAuth();
  const [view, setView] = React.useState<'file' | 'archive'>('file');
  const [filingTrip, setFilingTrip] = React.useState<Trip | null>(null);
  const [expandedTripId, setExpandedTripId] = React.useState<string | null>(null);

  // Archive filters
  const [accuracyFilter, setAccuracyFilter] = React.useState<'all' | 'matched' | 'better' | 'worse'>('all');
  const [incidentFilter, setIncidentFilter] = React.useState<'all' | 'none' | 'minor' | 'serious'>('all');

  const awaiting = useTripsAwaitingLog(orgId);
  const archived = useTripsWithLog(orgId);
  const { spots: orgSpots } = useCharterSpots(orgId);

  const filteredArchive = React.useMemo(() => {
    return archived.trips.filter((t) => {
      const log = t.captainsLog;
      if (!log) return false;
      if (accuracyFilter !== 'all' && log.forecastAccuracy !== accuracyFilter) return false;
      if (incidentFilter !== 'all' && log.incidentFlag !== incidentFilter) return false;
      return true;
    });
  }, [archived.trips, accuracyFilter, incidentFilter]);

  return (
    <CharterShell active="charter-log" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Captain's Log</Text>
          <Text style={styles.subtitle}>
            File post-trip notes; the delta against the original forecast becomes ground-truth for
            the abyss scoring pipeline.
          </Text>
        </View>
        <View style={styles.tabRow}>
          <Pressable onPress={() => setView('file')}    style={[styles.tabBtn, view === 'file' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, view === 'file' && styles.tabTextActive]}>
              File a log {awaiting.trips.length > 0 ? <Text style={styles.tabBadge}>{awaiting.trips.length}</Text> : null}
            </Text>
          </Pressable>
          <Pressable onPress={() => setView('archive')} style={[styles.tabBtn, view === 'archive' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, view === 'archive' && styles.tabTextActive]}>Archive</Text>
          </Pressable>
        </View>
      </View>

      {view === 'file' ? (
        <FileTab
          loading={awaiting.loading}
          error={awaiting.error}
          trips={awaiting.trips}
          orgSpots={orgSpots}
          onPickTrip={(t) => setFilingTrip(t)}
        />
      ) : (
        <ArchiveTab
          loading={archived.loading}
          error={archived.error}
          trips={filteredArchive}
          totalCount={archived.trips.length}
          orgSpots={orgSpots}
          accuracy={accuracyFilter}
          incident={incidentFilter}
          onAccuracy={setAccuracyFilter}
          onIncident={setIncidentFilter}
          expandedTripId={expandedTripId}
          onExpand={(id) => setExpandedTripId((prev) => (prev === id ? null : id))}
        />
      )}

      {filingTrip && orgId ? (
        <CaptainsLogFiler
          orgId={orgId}
          trip={filingTrip}
          onClose={() => setFilingTrip(null)}
          onFiled={() => setFilingTrip(null)}
        />
      ) : null}
    </CharterShell>
  );
}

// ─── File-a-log tab ──────────────────────────────────────────────────

function FileTab({
  loading, error, trips, orgSpots, onPickTrip,
}: {
  loading: boolean;
  error: string | null;
  trips: Trip[];
  orgSpots: ReturnType<typeof useCharterSpots>['spots'];
  onPickTrip: (t: Trip) => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Reading trips awaiting a log…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.errCard}>
        <Text style={styles.errTitle}>Could not load trips</Text>
        <Text style={styles.errBody}>{error}</Text>
      </View>
    );
  }
  if (trips.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Nothing to log right now.</Text>
        <Text style={styles.emptyBody}>
          Trips show up here once they've departed and don't yet have a captain's log filed. Plan a
          trip from /charter/trips first, then come back after departure.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sectionMeta}>{trips.length} {trips.length === 1 ? 'trip' : 'trips'} awaiting a log</Text>
      {trips.map((t) => (
        <Pressable key={t.id} onPress={() => onPickTrip(t)} style={styles.fileRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fileRowTitle}>{formatTripName(t, orgSpots)}</Text>
            <Text style={styles.fileRowMeta}>
              {t.tripType.toUpperCase()} · {t.headcount} {t.headcount === 1 ? 'passenger' : 'passengers'}
              {t.crew.length > 0 ? ` · ${t.crew.length} crew` : ''}
            </Text>
          </View>
          <View style={styles.fileRowCta}>
            <Text style={styles.fileRowCtaText}>File log →</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Archive tab ─────────────────────────────────────────────────────

function ArchiveTab({
  loading, error, trips, totalCount, orgSpots,
  accuracy, incident, onAccuracy, onIncident,
  expandedTripId, onExpand,
}: {
  loading: boolean;
  error: string | null;
  trips: Trip[];
  totalCount: number;
  orgSpots: ReturnType<typeof useCharterSpots>['spots'];
  accuracy: 'all' | 'matched' | 'better' | 'worse';
  incident: 'all' | 'none' | 'minor' | 'serious';
  onAccuracy: (v: 'all' | 'matched' | 'better' | 'worse') => void;
  onIncident: (v: 'all' | 'none' | 'minor' | 'serious') => void;
  expandedTripId: string | null;
  onExpand: (id: string) => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Reading archived logs…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.errCard}>
        <Text style={styles.errTitle}>Could not load archive</Text>
        <Text style={styles.errBody}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Filter row */}
      <View style={styles.filterRow}>
        <FilterChip label="Forecast" options={[
          { id: 'all', label: 'All' },
          { id: 'matched', label: 'Matched' },
          { id: 'better', label: 'Better' },
          { id: 'worse', label: 'Worse' },
        ]} value={accuracy} onChange={onAccuracy} />
        <FilterChip label="Incident" options={[
          { id: 'all', label: 'All' },
          { id: 'none', label: 'None' },
          { id: 'minor', label: 'Minor' },
          { id: 'serious', label: 'Serious' },
        ]} value={incident} onChange={onIncident} />
        <Text style={styles.filterMeta}>{trips.length} of {totalCount} logs</Text>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{totalCount === 0 ? 'Archive is empty.' : 'No logs match the current filters.'}</Text>
          <Text style={styles.emptyBody}>
            {totalCount === 0
              ? 'File your first log from the "File a log" tab to start building the archive.'
              : 'Loosen the filters above to see more entries.'}
          </Text>
        </View>
      ) : (
        trips.map((t) => (
          <View key={t.id} style={styles.archiveCard}>
            <Pressable onPress={() => onExpand(t.id)} style={styles.archiveHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.archiveTitle}>{formatTripName(t, orgSpots)}</Text>
                <Text style={styles.archiveMeta}>
                  {t.tripType.toUpperCase()} ·{' '}
                  forecast {t.captainsLog?.forecastAccuracy ?? '—'}
                  {t.captainsLog?.incidentFlag && t.captainsLog.incidentFlag !== 'none'
                    ? ` · ${t.captainsLog.incidentFlag} incident`
                    : ''}
                </Text>
              </View>
              <Text style={styles.archiveExpand}>{expandedTripId === t.id ? '▲' : '▼'}</Text>
            </Pressable>
            {expandedTripId === t.id ? (
              <View style={{ marginTop: 12 }}>
                <TripDetailDelta trip={t} />
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function FilterChip<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.filterChipGroup}>
      <Text style={styles.filterChipLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {options.map((o) => {
          const active = o.id === value;
          return (
            <Pressable
              key={o.id}
              onPress={() => onChange(o.id)}
              style={[styles.filterChipBtn, active && styles.filterChipBtnActive]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatTripName(t: Trip, orgSpots: ReturnType<typeof useCharterSpots>['spots']): string {
  const dateStr = t.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const primary = orgSpots.find((s) => s.id === t.spots[0])?.name ?? t.spots[0] ?? '—';
  return `${dateStr} · ${t.departureTime} · ${primary}`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, fontWeight: '800', color: colors.text1, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, marginTop: 4, maxWidth: 640 },

  tabRow: { flexDirection: 'row', padding: 3, gap: 2, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.sm },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm - 2 },
  tabBtnActive: { backgroundColor: colors.surface2 },
  tabText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.text3 },
  tabTextActive: { color: colors.text1 },
  tabBadge: {
    fontFamily: fonts.mono, fontSize: 10, fontWeight: '800',
    color: colors.bg, backgroundColor: colors.accent,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginLeft: 6,
  },

  // file tab
  sectionMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, letterSpacing: 0.5 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  fileRowTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text1 },
  fileRowMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 4, letterSpacing: 0.3 },
  fileRowCta: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.accent },
  fileRowCtaText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.bg },

  // archive
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, paddingHorizontal: 4 },
  filterChipGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChipLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  filterChipBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  filterChipBtnActive: { backgroundColor: colors.surface1, borderColor: colors.accent },
  filterChipText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text3 },
  filterChipTextActive: { color: colors.text1 },
  filterMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginLeft: 'auto' },

  archiveCard: { padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  archiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  archiveTitle: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text1 },
  archiveMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 4 },
  archiveExpand: { fontFamily: fonts.mono, fontSize: 14, color: colors.text3 },

  // shared
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },
  errCard: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  emptyCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline, gap: 8 },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
});
