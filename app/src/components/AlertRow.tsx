import React from 'react';
import { View, Text, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { ConditionAlert } from '@/types';

const alertTide = require('@/assets/alert-tide.png');
const alertSwell = require('@/assets/alert-swell.png');
const alertRunoff = require('@/assets/alert-runoff.png');

type Severity = ConditionAlert['severity'];

const config: Record<Severity, { fg: string; bg: string; ring: string; icon: ImageSourcePropType }> = {
  info:   { fg: colors.accent,    bg: 'rgba(26,184,255,0.08)',  ring: 'rgba(26,184,255,0.18)',  icon: alertTide },
  warn:   { fg: colors.excellent, bg: 'rgba(34,211,107,0.07)',  ring: 'rgba(34,211,107,0.18)',  icon: alertSwell },
  hazard: { fg: colors.hazard,    bg: 'rgba(232,90,60,0.08)',   ring: 'rgba(232,90,60,0.20)',   icon: alertRunoff },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  return (
    <View style={[styles.row, { backgroundColor: c.bg, borderColor: c.ring }]}>
      <View style={styles.iconWrap}>
        <Image source={c.icon} style={styles.icon} resizeMode="contain" />
      </View>
      <View style={styles.body}>
        <Text style={typography.h3}>{alert.spotName}</Text>
        <Text style={styles.msg}>{alert.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  icon: { width: 36, height: 36 },
  body: { flex: 1, paddingTop: 2 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
