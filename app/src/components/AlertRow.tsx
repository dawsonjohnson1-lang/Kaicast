import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Icon, IconName } from './Icon';
import type { ConditionAlert } from '@/types';

const config: Record<ConditionAlert['severity'], { fg: string; bubbleBg: string; cardBg: string; icon: IconName }> = {
  info: {
    fg: colors.excellent,
    bubbleBg: 'rgba(31,209,122,0.18)',
    cardBg: 'rgba(31,209,122,0.06)',
    icon: 'wave',
  },
  warn: {
    fg: colors.accent,
    bubbleBg: 'rgba(26,184,255,0.18)',
    cardBg: 'rgba(26,184,255,0.06)',
    icon: 'wave',
  },
  hazard: {
    fg: colors.hazard,
    bubbleBg: 'rgba(217,99,56,0.20)',
    cardBg: 'rgba(217,99,56,0.08)',
    icon: 'globe',
  },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  return (
    <View style={[styles.row, { backgroundColor: c.cardBg }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bubbleBg }]}>
        <Icon name={c.icon} size={20} color={c.fg} />
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
    borderRadius: radius.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});
