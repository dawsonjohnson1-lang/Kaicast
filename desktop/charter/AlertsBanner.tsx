// AlertsBanner — Good Window alerts surfaced on the charter home.
// Collapses to a single-line banner when there are unread alerts;
// expands on tap to show each individual alert with a "mark read"
// action. Hidden entirely when there's nothing to surface.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useCharterAlerts, markAlertRead } from './useCharterAlerts';
import type { CharterAlert } from './types';
import type { NavigateFn } from '../router';

export function AlertsBanner({ orgId, onNavigate }: { orgId: string | null | undefined; onNavigate?: NavigateFn }) {
  const { alerts, unreadCount } = useCharterAlerts(orgId);
  const [expanded, setExpanded] = React.useState(false);

  // Filter to unread + alerts within the last 72 hours; older read
  // ones live on the spots screen if we ever want a full history.
  const recent = React.useMemo(() => {
    const cutoff = Date.now() - 72 * 3600 * 1000;
    return alerts.filter((a) =>
      !a.read || (a.createdAt && a.createdAt.getTime() >= cutoff),
    );
  }, [alerts]);

  if (recent.length === 0) return null;

  return (
    <View style={styles.banner}>
      <Pressable style={styles.bannerHead} onPress={() => setExpanded((e) => !e)}>
        <View style={styles.bell}><Text style={styles.bellIcon}>🔔</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {unreadCount > 0
              ? `${unreadCount} spot${unreadCount === 1 ? '' : 's'} just opened up`
              : `${recent.length} recent Good Window alert${recent.length === 1 ? '' : 's'}`}
          </Text>
          <Text style={styles.subtitle}>
            {expanded ? 'Tap to collapse' : 'Tap to see which spots crossed back into Good or better.'}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.alertsList}>
          {recent.map((a) => (
            <AlertRow key={a.id} alert={a} orgId={orgId!} onNavigate={onNavigate} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AlertRow({ alert, orgId, onNavigate }: { alert: CharterAlert; orgId: string; onNavigate?: NavigateFn }) {
  const [busy, setBusy] = React.useState(false);
  const onMarkRead = async () => {
    if (alert.read || busy) return;
    setBusy(true);
    try { await markAlertRead(orgId, alert.id); }
    catch { /* swallow — banner doesn't need to crash on a single failure */ }
    finally { setBusy(false); }
  };
  const tierColor =
    alert.newTier === 'excellent' ? '#09A1FB' :
    alert.newTier === 'great' || alert.newTier === 'good' ? '#3DDC84' :
    colors.text2;
  return (
    <View style={[styles.row, alert.read && styles.rowRead]}>
      <View style={[styles.tierPill, { borderColor: tierColor }]}>
        <Text style={[styles.tierPillText, { color: tierColor }]}>{alert.newTier.toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{alert.charterSpotName}</Text>
        <Text style={styles.rowMeta}>
          {humanCreated(alert.createdAt)} · was {alert.previousTier} → now {alert.newTier}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable onPress={() => onNavigate?.('charter-trips')} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>Plan a trip →</Text>
        </Pressable>
        {!alert.read ? (
          <Pressable onPress={onMarkRead} disabled={busy} style={styles.markReadBtn}>
            <Text style={styles.markReadText}>{busy ? '…' : 'Mark read'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function humanCreated(d: Date | null): string {
  if (!d) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.06)',
    overflow: 'hidden',
  },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  bell: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  bellIcon: { fontSize: 16 },
  title: { fontFamily: fonts.display, fontSize: 14, fontWeight: '700', color: colors.text1 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, marginTop: 2 },
  chevron: { fontFamily: fonts.mono, fontSize: 14, color: colors.text2 },

  alertsList: { gap: 8, padding: 14, paddingTop: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: radius.sm,
    backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairlineStrong,
  },
  rowRead: { opacity: 0.6 },
  tierPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
  tierPillText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  rowTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text1 },
  rowMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.text3, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: 'rgba(9,161,251,0.08)' },
  actionBtnText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: colors.accent },
  markReadBtn: { paddingHorizontal: 8, paddingVertical: 5 },
  markReadText: { fontFamily: fonts.body, fontSize: 11, color: colors.text3, fontWeight: '600' },
});
