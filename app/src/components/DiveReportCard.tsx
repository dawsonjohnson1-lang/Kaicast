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
  const typeTag = report.diveType === 'scuba' ? 'scuba' : report.diveType === 'freedive' ? 'freedive' : report.diveType === 'spear' ? 'spear' : 'snorkel';
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.head}>
        <Avatar initials={report.authorInitials} size={42} vibrant />
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{report.authorName}</Text>
          <Text style={styles.meta}>at {report.spotName}</Text>
        </View>
        <Text style={styles.time}>{report.postedAgo}</Text>
      </View>

      <View style={styles.tags}>
        <Tag variant="excellent" />
        <Tag variant={typeTag} outline />
      </View>

      <View style={styles.statsRow}>
        <Stat label={`${report.depthFt} FT`} sub="VISIBILITY" />
        <Stat label={report.current} sub="CURRENT" />
        <Stat label={report.surface} sub="ENTRY" />
        <Stat label={report.visibility} sub="WATER QUALITY" />
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

function Stat({ label, sub }: { label: string; sub: string }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.bodySm, color: colors.textMuted },
  tags: { flexDirection: 'row', gap: spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { ...typography.h3, fontSize: 14 },
  statSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  body: { ...typography.body, color: colors.textPrimary, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { ...typography.bodySm, color: colors.textSecondary },
});
