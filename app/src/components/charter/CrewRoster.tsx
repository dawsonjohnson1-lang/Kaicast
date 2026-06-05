// CrewRoster — list of crew members with avatar, name, role,
// certification level, and a colored connection-state dot.
//
// `variant: 'list'` (default) renders one row per crew member —
//   used by Owner/Manager dashboards where the full roster matters.
// `variant: 'strip'` renders a compact horizontal avatar strip —
//   used by Captain dashboard where only today's crew is shown.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { RoleBadge } from './RoleBadge';
import {
  type CrewMember,
  type ConnectionState,
  CONNECTION_LABEL,
} from '@/types/charter';

const DOT_COLOR: Record<ConnectionState, string> = {
  connected: colors.excellent,   // green
  on_app:    colors.accent,      // blue
  offline:   colors.textMuted,   // gray
};

export function CrewRoster({
  crew,
  variant = 'list',
}: {
  crew: CrewMember[];
  variant?: 'list' | 'strip';
}) {
  if (variant === 'strip') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={stripStyles.row}>
        {crew.map((c) => (
          <View key={c.id} style={stripStyles.cell}>
            <View style={stripStyles.avatarWrap}>
              <Avatar size={48} initials={initialsOf(c.name)} imageSource={c.avatarUrl ? { uri: c.avatarUrl } : undefined} />
              <View style={[stripStyles.dot, { backgroundColor: DOT_COLOR[c.connectionState] }]} />
            </View>
            <Text style={stripStyles.name} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {crew.map((c) => (
        <View key={c.id} style={listStyles.row}>
          <View style={listStyles.avatarWrap}>
            <Avatar size={40} initials={initialsOf(c.name)} imageSource={c.avatarUrl ? { uri: c.avatarUrl } : undefined} />
            <View style={[listStyles.dot, { backgroundColor: DOT_COLOR[c.connectionState] }]} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={listStyles.nameRow}>
              <Text style={listStyles.name}>{c.name}</Text>
              <RoleBadge role={c.role} />
            </View>
            <Text style={listStyles.sub}>
              {CONNECTION_LABEL[c.connectionState]}
              {c.certificationLevel ? ` · ${c.certificationLevel}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function initialsOf(name: string): string {
  return name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
}

const listStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  avatarWrap: { position: 'relative' },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  sub: { ...typography.bodySm, color: colors.textSecondary },
});

const stripStyles = StyleSheet.create({
  row: { gap: spacing.md, paddingHorizontal: 2 },
  cell: { alignItems: 'center', gap: 4, width: 64 },
  avatarWrap: { position: 'relative' },
  dot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  name: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
});
