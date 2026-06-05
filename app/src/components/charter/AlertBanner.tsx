// AlertBanner — charter-scoped hazard / safety alert. Sourced from
// the existing spot_alerts collection (public-read, server-written —
// see firestore.rules:101) plus charter-specific overlays (vessel-
// scoped maintenance notices, etc.) when those land.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type AlertSeverity = 'info' | 'warn' | 'hazard';
export type AlertSource = 'DOH' | 'NWS' | 'KaiCast' | 'Charter Ops';

export interface CharterAlert {
  id: string;
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  body: string;
  /** spot id this scopes to, if any (else fleet-wide). */
  spotId?: string;
}

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; border: string; fg: string }> = {
  info:   { bg: colors.accentSoft, border: colors.accent, fg: colors.accent },
  warn:   { bg: colors.warnSoft,   border: colors.warn,   fg: colors.warn },
  hazard: { bg: colors.hazardSoft, border: colors.hazard, fg: colors.hazard },
};

export function AlertBanner({ alert, onPress }: { alert: CharterAlert; onPress?: () => void }) {
  const style = SEVERITY_STYLES[alert.severity];
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[styles.row, { backgroundColor: style.bg, borderColor: style.border }]}
    >
      <View style={[styles.dot, { backgroundColor: style.fg }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.source, { color: style.fg }]}>{alert.source.toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {alert.title}
          </Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>{alert.body}</Text>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 999 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  source: { ...typography.caption, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...typography.bodySm, fontWeight: '700' },
  body: { ...typography.bodySm, color: colors.textSecondary },
});
