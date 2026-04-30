import React from 'react';
import { View, Text, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { ConditionAlert } from '@/types';

const alertTide = require('@/assets/alert-tide.png');
const alertSwell = require('@/assets/alert-swell.png');
const alertRunoff = require('@/assets/alert-runoff.png');

type Severity = ConditionAlert['severity'];

type AlertStyle = {
  fg: string;
  row: string;
  ring: string;
  bubble: string;
  icon: ImageSourcePropType;
};

// Each alert type gets a color family pulled from the symbol itself.
// info → tide (green), warn → swell (blue), hazard → runoff (orange).
const config: Record<Severity, AlertStyle> = {
  info: {
    fg: colors.excellent,
    row: 'rgba(34,211,107,0.08)',
    ring: 'rgba(34,211,107,0.28)',
    bubble: 'rgba(34,211,107,0.18)',
    icon: alertTide,
  },
  warn: {
    fg: colors.accent,
    row: 'rgba(26,184,255,0.08)',
    ring: 'rgba(26,184,255,0.28)',
    bubble: 'rgba(26,184,255,0.18)',
    icon: alertSwell,
  },
  hazard: {
    fg: colors.hazard,
    row: 'rgba(232,90,60,0.08)',
    ring: 'rgba(232,90,60,0.30)',
    bubble: 'rgba(232,90,60,0.20)',
    icon: alertRunoff,
  },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  return (
    <View style={[styles.row, { backgroundColor: c.row, borderColor: c.ring }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bubble }]}>
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
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 26, height: 26 },
  body: { flex: 1, paddingTop: 2 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
