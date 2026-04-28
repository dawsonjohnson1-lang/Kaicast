import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar } from './Avatar';
import { Tag } from './Tag';
import { Icon } from './Icon';
import type { DiveReport } from '@/types';

type Props = {
  report: DiveReport;
  onPress?: () => void;
};

export function DiveReportCard({ report, onPress }: Props) {
  const typeTag =
    report.diveType === 'scuba' ? 'scuba' :
    report.diveType === 'freedive' ? 'freedive' :
    report.diveType === 'spear' ? 'spear' : 'snorkel';

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.head}>
        <Avatar initials={report.authorInitials} size={42} vibrant />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{report.authorName}</Text>
          <Text style={styles.meta}>at {report.spotName}</Text>
        </View>
        <Text style={styles.time}>{report.postedAgo}</Text>
      </View>

      <View style={styles.tags}>
        <Tag variant="excellent" label="EXCELLENT" />
        <Tag variant={typeTag} outline />
      </View>

      <View style={styles.statsRow}>
        <Stat label="VISIBILITY" value={`${report.depthFt} FT`} />
        <Stat label="CURRENT" value={report.current} />
        <Stat label="ENTRY" value={report.surface} />
        <Stat label="WATER QUALITY" value={report.visibility} />
      </View>

      <Text style={styles.body}>{report.comment}</Text>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Icon name="heart" size={16} color={colors.textSecondary} />
          <Text style={styles.actionText}>{report.likes}</Text>
        </View>
        <View style={styles.action}>
          <Icon name="comment" size={16} color={colors.textSecondary} />
          <Text style={styles.actionText}>{report.replies} replies</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  author: { ...typography.h3, fontSize: 15 },
  meta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 1 },
  time: { ...typography.bodySm, color: colors.textMuted },
  tags: { flexDirection: 'row', gap: spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  statValue: { ...typography.h3, fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 9, color: colors.textMuted, marginTop: 3, letterSpacing: 0.8, fontWeight: '600' },
  body: { ...typography.body, color: colors.textPrimary, lineHeight: 20, fontSize: 14 },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { ...typography.bodySm, color: colors.textSecondary },
});
