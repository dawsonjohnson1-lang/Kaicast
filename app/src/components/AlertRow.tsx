import React from 'react';
import { View, Text, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { ConditionAlert } from '@/types';

const config: Record<ConditionAlert['severity'], { bubbleBg: string; cardBg: string; icon: ImageSourcePropType }> = {
  info: {
    bubbleBg: 'rgba(31,209,122,0.18)',
    cardBg: 'rgba(31,209,122,0.06)',
    icon: require('../../assets/alert-green-curl.png'),
  },
  warn: {
    bubbleBg: 'rgba(26,184,255,0.18)',
    cardBg: 'rgba(26,184,255,0.06)',
    icon: require('../../assets/alert-blue-swirl.png'),
  },
  hazard: {
    bubbleBg: 'rgba(217,99,56,0.20)',
    cardBg: 'rgba(217,99,56,0.08)',
    icon: require('../../assets/alert-orange-globe.png'),
  },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  return (
    <View style={[styles.row, { backgroundColor: c.cardBg }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bubbleBg }]}>
        <Image source={c.icon} style={styles.iconImg} resizeMode="contain" />
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
  iconImg: {
    width: 24,
    height: 24,
  },
  body: { flex: 1 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});
