// RoleBadge — pill showing the viewer's role. Tinted per-role so the
// owner reads as authority (accent blue), captain as operational
// (warm light), manager as administrative (muted teal), crew as
// neutral.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { type CharterRole, ROLE_LABEL } from '@/types/charter';

const ROLE_TINT: Record<CharterRole, { bg: string; border: string; fg: string }> = {
  owner:   { bg: colors.accentSoft,   border: colors.accent,   fg: colors.accent },
  captain: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.16)', fg: colors.textPrimary },
  manager: { bg: colors.spearSoft,    border: colors.spear,    fg: colors.spear },
  crew:    { bg: colors.card,         border: colors.border,   fg: colors.textSecondary },
};

export function RoleBadge({ role }: { role: CharterRole }) {
  const tint = ROLE_TINT[role];
  return (
    <View style={[styles.pill, { backgroundColor: tint.bg, borderColor: tint.border }]}>
      <Text style={[styles.text, { color: tint.fg }]}>{ROLE_LABEL[role]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontSize: 10,
  },
});
