import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Icon, IconName } from './Icon';
import type { ConditionAlert } from '@/types';

const config: Record<ConditionAlert['severity'], { fg: string; bg: string; icon: IconName }> = {
  info: { fg: colors.excellent, bg: 'rgba(22,196,127,0.10)', icon: 'check' },
  warn: { fg: colors.warn, bg: 'rgba(245,176,65,0.10)', icon: 'wave' },
  hazard: { fg: colors.hazard, bg: 'rgba(239,83,80,0.10)', icon: 'shield' },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  return (
    <View style={[styles.row, { backgroundColor: c.bg, borderColor: c.fg + '33' }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.fg + '22' }]}>
        <Icon name={c.icon} size={18} color={c.fg} />
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
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});
