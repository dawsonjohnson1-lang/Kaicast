// CharterLogScreen — standalone captain's log (Phase 1 rework).
//
//  File tab  — one button: start a new log. The StandaloneLogFiler walks
//    the day/vessel/spot/conditions blocks. NO trip picker — a log no
//    longer requires a trip to exist.
//  Archive tab — the org's filed standalone logs (top-level charter_logs
//    filtered to this operator), newest first, with an incident filter.
//
// Who can file is gated on canFillCaptainLog (charter/permissions.ts):
// the org owner (accountType === 'charter') always can; everyone else
// needs a captain's license number on their user settings. Mirrored in
// firestore.rules (hasCaptainsLicense) — UI hiding isn't the only gate.

import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CharterShell } from './CharterShell';
import { StandaloneLogFiler } from './StandaloneLogFiler';
import { useCharterAccount, useCharterSpots, useCharterCrew } from './useCharterData';
import { useCharterLogs } from './useCharterLogs';
import { useAuth } from '../hooks/useAuth';
import { useUserSettings } from '../hooks/useUserSettings';
import { canFillCaptainLog } from './permissions';
import { TRIP_TYPE_LABEL, type StandaloneLog } from './standaloneLog';
import type { NavigateFn } from '../router';

export function CharterLogScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const auth = useAuth();
  const { orgId, user } = auth;
  const [view, setView] = React.useState<'file' | 'archive'>('file');
  const [filing, setFiling] = React.useState(false);
  const [incidentFilter, setIncidentFilter] = React.useState<'all' | 'none' | 'minor' | 'serious'>('all');

  // License gate — owner (charter admin) always; everyone else needs a
  // captain's license on their user settings. Same predicate as the
  // firestore.rules charter_logs rule.
  const { settings } = useUserSettings(user?.uid ?? null);
  const canFill = canFillCaptainLog(auth.accountType === 'charter', settings?.captainLicense);

  const { account } = useCharterAccount(orgId);
  const { spots } = useCharterSpots(orgId);
  const { crew } = useCharterCrew(orgId);
  const { logs, loading, error } = useCharterLogs(orgId);

  const filteredLogs = React.useMemo(
    () => (incidentFilter === 'all' ? logs : logs.filter((l) => l.incident === incidentFilter)),
    [logs, incidentFilter],
  );

  const filedBy = {
    uid: user?.uid ?? '',
    name: user?.displayName ?? user?.email ?? 'Captain',
  };

  return (
    <CharterShell active="charter-log" onNavigate={onNavigate}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Captain's Log</Text>
          <Text style={styles.subtitle}>
            Standalone day logs — record what ran, the conditions you saw, crew on duty, and any
            incidents. No trip required.
          </Text>
        </View>
        <View style={styles.tabRow}>
          <Pressable onPress={() => setView('file')} style={[styles.tabBtn, view === 'file' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, view === 'file' && styles.tabTextActive]}>File a log</Text>
          </Pressable>
          <Pressable onPress={() => setView('archive')} style={[styles.tabBtn, view === 'archive' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, view === 'archive' && styles.tabTextActive]}>
              Archive {logs.length > 0 ? <Text style={styles.tabBadge}>{logs.length}</Text> : null}
            </Text>
          </Pressable>
        </View>
      </View>

      {view === 'file' ? (
        <View style={styles.fileCard}>
          {!canFill ? (
            <>
              <Text style={styles.fileTitle}>Captain's license required</Text>
              <Text style={styles.fileBody}>
                Filing a captain's log requires a captain's license number on your profile. Add yours
                in Profile, then come back — or ask the org owner to file.
              </Text>
              <Pressable style={styles.secondaryCta} onPress={() => onNavigate?.('profile')}>
                <Text style={styles.secondaryCtaText}>Open profile settings →</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.fileTitle}>Log today's operation</Text>
              <Text style={styles.fileBody}>
                One entry covers the whole day for a vessel. Add a lightweight row per trip — type,
                hours, guests — or file with none for a weather-out day. FareHarbor sync will pre-fill
                rows when it lands.
              </Text>
              <Pressable style={styles.primaryCta} onPress={() => setFiling(true)}>
                <Text style={styles.primaryCtaText}>Start a new log →</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <ArchiveTab
          loading={loading}
          error={error}
          logs={filteredLogs}
          total={logs.length}
          spotName={(id) => spots.find((s) => s.id === id)?.name ?? id}
          incident={incidentFilter}
          onIncident={setIncidentFilter}
        />
      )}

      {filing && orgId && canFill ? (
        <StandaloneLogFiler
          orgId={orgId}
          vessels={account?.fleet ?? []}
          spots={spots}
          crew={crew}
          filedBy={filedBy}
          onClose={() => setFiling(false)}
          onFiled={() => { setFiling(false); setView('archive'); }}
        />
      ) : null}
    </CharterShell>
  );
}

function ArchiveTab({
  loading, error, logs, total, spotName, incident, onIncident,
}: {
  loading: boolean;
  error: string | null;
  logs: StandaloneLog[];
  total: number;
  spotName: (id: string) => string;
  incident: 'all' | 'none' | 'minor' | 'serious';
  onIncident: (v: 'all' | 'none' | 'minor' | 'serious') => void;
}) {
  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Reading filed logs…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.errCard}>
        <Text style={styles.errTitle}>Could not load logs</Text>
        <Text style={styles.errBody}>{error}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.filterRow}>
        {(['all', 'none', 'minor', 'serious'] as const).map((id) => (
          <Pressable key={id} onPress={() => onIncident(id)} style={[styles.filterChip, incident === id && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, incident === id && styles.filterChipTextActive]}>
              {id === 'all' ? 'All' : id === 'none' ? 'No incident' : `${id[0].toUpperCase()}${id.slice(1)} incident`}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.filterMeta}>{logs.length} of {total}</Text>
      </View>

      {logs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{total === 0 ? 'Archive is empty.' : 'No logs match the filter.'}</Text>
          <Text style={styles.emptyBody}>
            {total === 0 ? 'File your first log from the "File a log" tab.' : 'Loosen the filter to see more.'}
          </Text>
        </View>
      ) : (
        logs.map((l) => (
          <View key={l.logId} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>
                {new Date(l.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' })}
                {'  ·  '}{l.vesselName || '—'}
              </Text>
              {l.incident !== 'none' ? (
                <Text style={[styles.incidentBadge, l.incident === 'serious' && styles.incidentBadgeSerious]}>{l.incident}</Text>
              ) : null}
            </View>
            <Text style={styles.logMeta}>
              {l.spotIds.map(spotName).join(', ') || 'No spots'}
              {l.tripCount != null ? `  ·  ${l.tripCount} ${l.tripCount === 1 ? 'trip' : 'trips'}` : ''}
              {l.durationHours != null ? `  ·  ${l.durationHours}h` : ''}
              {l.crew.length ? `  ·  ${l.crew.length} crew` : ''}
            </Text>
            {l.trips.length > 0 ? (
              <Text style={styles.logTrips}>
                {l.trips
                  .map((t) => (t.type === 'other' ? t.tripTypeCustom || 'Custom' : TRIP_TYPE_LABEL[t.type]))
                  .join('  ·  ')}
              </Text>
            ) : null}
            {l.seaState || l.windObserved || l.visibilityFt != null ? (
              <Text style={styles.logCond}>
                {[l.seaState && `Sea: ${l.seaState}`, l.windObserved && `Wind: ${l.windObserved}`, l.visibilityFt != null && `Vis: ${l.visibilityFt}ft`].filter(Boolean).join('   ')}
              </Text>
            ) : null}
            {l.notes ? <Text style={styles.logNotes} numberOfLines={2}>{l.notes}</Text> : null}
            <Text style={styles.logFiledBy}>Filed by {l.filedByName}</Text>
          </View>
        ))
      )}
    </View>
  );
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
  tabBadge: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: colors.bg, backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginLeft: 6 },

  fileCard: { padding: 22, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong, gap: 10, alignItems: 'flex-start' },
  fileTitle: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  fileBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20, maxWidth: 560 },
  primaryCta: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.accent },
  primaryCtaText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bg },
  secondaryCta: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong },
  secondaryCtaText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text1 },

  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0 },
  filterChipActive: { backgroundColor: colors.surface1, borderColor: colors.accent },
  filterChipText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text3 },
  filterChipTextActive: { color: colors.text1 },
  filterMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginLeft: 'auto' },

  logCard: { padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface0, gap: 5 },
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  logTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text1 },
  incidentBadge: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, textTransform: 'uppercase' },
  incidentBadgeSerious: { color: '#F73726', backgroundColor: 'rgba(247,55,38,0.12)' },
  logMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3 },
  logTrips: { fontFamily: fonts.body, fontSize: 11, color: colors.text2 },
  logCond: { fontFamily: fonts.mono, fontSize: 11, color: colors.text2 },
  logNotes: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 18 },
  logFiledBy: { fontFamily: fonts.mono, fontSize: 10, color: colors.text4, marginTop: 2 },

  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },
  errCard: { padding: 18, borderRadius: radius.md, backgroundColor: 'rgba(247,55,38,0.10)', borderWidth: 1, borderColor: '#F73726' },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },
  emptyCard: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline, gap: 8 },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text2, lineHeight: 20 },
});
