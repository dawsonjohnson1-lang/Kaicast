import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SvgProps } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme';
import type { ConditionAlert } from '@/types';

import AlertTide from '@/assets/alert-tide.svg';
import AlertSwell from '@/assets/alert-swell.svg';
import AlertRunoff from '@/assets/alert-runoff.svg';

type Severity = ConditionAlert['severity'];

type AlertStyle = {
  fg: string;
  row: string;
  ring: string;
  bubble: string;
  icon: React.FC<SvgProps>;
};

// Each alert type gets a color family pulled from the symbol itself.
// info → tide (green), warn → swell (blue), hazard → runoff (orange).
const config: Record<Severity, AlertStyle> = {
  info: {
    fg: colors.excellent,
    row: 'rgba(34,211,107,0.08)',
    ring: 'rgba(34,211,107,0.28)',
    bubble: 'rgba(34,211,107,0.18)',
    icon: AlertTide,
  },
  warn: {
    fg: colors.accent,
    row: 'rgba(26,184,255,0.08)',
    ring: 'rgba(26,184,255,0.28)',
    bubble: 'rgba(26,184,255,0.18)',
    icon: AlertSwell,
  },
  hazard: {
    fg: colors.hazard,
    row: 'rgba(232,90,60,0.08)',
    ring: 'rgba(232,90,60,0.30)',
    bubble: 'rgba(232,90,60,0.20)',
    icon: AlertRunoff,
  },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  const Icon = c.icon;
  return (
    <View style={[styles.row, { backgroundColor: c.row, borderColor: c.ring }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bubble }]}>
        <Icon width={26} height={26} />
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
  body: { flex: 1, paddingTop: 2 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
