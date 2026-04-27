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
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { ConditionAlert } from '@/types';

const alertInfo = require('@/assets/alert-info.png');
const alertWarn = require('@/assets/alert-warn.png');
const alertHazard = require('@/assets/alert-hazard.png');

type Severity = ConditionAlert['severity'];

const config: Record<Severity, { fg: string; bg: string; ring: string; icon: ImageSourcePropType }> = {
  info:   { fg: colors.accent,    bg: 'rgba(26,184,255,0.08)',  ring: 'rgba(26,184,255,0.18)',  icon: alertInfo },
  warn:   { fg: colors.excellent, bg: 'rgba(34,211,107,0.07)',  ring: 'rgba(34,211,107,0.18)',  icon: alertWarn },
  hazard: { fg: colors.hazard,    bg: 'rgba(232,90,60,0.08)',   ring: 'rgba(232,90,60,0.20)',   icon: alertHazard },
};

export function AlertRow({ alert }: { alert: ConditionAlert }) {
  const c = config[alert.severity];
  return (
    <View style={[styles.row, { backgroundColor: c.cardBg }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.bubbleBg }]}>
        <Image source={c.icon} style={styles.iconImg} resizeMode="contain" />
    <View style={[styles.row, { backgroundColor: c.bg, borderColor: c.ring }]}>
      <View style={[styles.iconWrap, { backgroundColor: 'transparent' }]}>
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
  icon: { width: 36, height: 36 },
  body: { flex: 1, paddingTop: 2 },
  msg: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
