import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Avatar } from '@/components/Avatar';
import { Tag } from '@/components/Tag';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import type { RootNav } from '@/navigation/types';

export function DiveReportDetailScreen() {
  const nav = useNavigation<RootNav>();
  return (
    <Screen contentStyle={{ paddingTop: 0 }}>
      <Header
        onBack={() => nav.goBack()}
        rightSlot={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={detailStyles.iconBtn}><Icon name="menu" size={18} color={colors.textPrimary} /></View>
            <View style={detailStyles.iconBtn}><Icon name="share" size={18} color={colors.textPrimary} /></View>
          </View>
        }
        transparent
      />
      <View style={styles.hero}>
        <LinearGradient colors={['#06334a', '#04111e']} style={StyleSheet.absoluteFill} />
        <Tag variant="spear" />
        <Text style={[typography.display, { fontSize: 36, marginTop: spacing.md }]}>Three Tables</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <Text style={styles.heroSub}>North Shore, O'ahu · Apr 18, 2026 · 6:42 AM</Text>
          <Text style={styles.counter}>1 / 4</Text>
        </View>
      </View>

      <View style={{ height: spacing.xl }} />

      <View style={styles.row}>
        <Avatar initials="MK" size={42} />
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>Mike Kahale</Text>
          <Text style={styles.handle}>@mike_kahale</Text>
        </View>
        <Button label="Follow" size="sm" variant="outline" />
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.statsRow}>
          <Stat value="42" unit="ft" label="DEPTH" />
          <Stat value="52" unit="min" label="TIME" />
          <Stat value="45" unit="ft" label="VISIBILITY" />
          <Stat value="4.5" unit="/5" label="RATING" />
        </View>
      </Card>

      <Section title="CONDITIONS">
        <Grid2 left={{ label: 'CURRENT', value: 'Light', sub: 'Gentle drift' }} right={{ label: 'SURFACE', value: 'Calm', sub: 'Glass-off window' }} />
        <Grid2 left={{ label: 'WATER TEMP', value: '76°F', sub: 'Warm for depth' }} right={{ label: 'TIDE', value: 'Incoming', sub: 'Peak in 2h' }} />
        <Grid2 left={{ label: 'CLOUD COVER', value: 'Partly cloudy', sub: 'Mixed sun' }} right={{ label: 'TIME OF DAY', value: 'Dawn', sub: 'Best bite' }} />
      </Section>

      <Section title="ACTIVITY · SPEARFISHING">
        <KV k="Weapon" v="Speargun (band)" />
        <KV k="Method" v="Freediving" />
        <KV k="Targeting" v="Uku, Ōmilu" />
        <KV k="Catch" v="2 × Uku (4 lb, 3 lb)" />
        <KV k="Reached limit" v="No" />
      </Section>

      <Section title="MARINE LIFE">
        <Text style={[typography.caption, { color: colors.textSecondary }]}>DENSITY</Text>
        <Text style={[typography.h2, { marginTop: spacing.sm, marginBottom: spacing.md }]}>Abundant</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>PELAGICS SPOTTED</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Tag variant="freedive" label="Turtles" />
          <Tag variant="freedive" label="Eagle ray" />
          <Tag variant="freedive" label="Reef sharks (2)" />
        </View>
      </Section>

      <Section title="LOGISTICS">
        <KV k="Entry" v="Shore" />
        <KV k="Group" v="Solo" />
        <KV k="Max depth reached" v="42 ft" />
      </Section>

      <Section title="EXPERIENCE">
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Icon key={i} name={i <= 4 ? 'star-filled' : 'star'} size={20} color={i <= 4 ? colors.accent : colors.textMuted} />
          ))}
        </View>
        <Text style={[typography.caption, { marginTop: spacing.lg }]}>WOULD RECOMMEND</Text>
        <Tag variant="excellent" label="Yes, absolutely" style={{ marginTop: spacing.sm }} />
      </Section>

      <Section title="NOTES">
        <Text style={[typography.body, { color: colors.textPrimary, lineHeight: 22 }]}>
          Glass-off dawn session. Dropped in at the east end near the third table, drifted west with the light incoming. Two ukus at 35 ft on the second drop — ōmilu pair cruised through but held too deep. Keep an eye out for the reef sharks that shadowed me on the stringer pull.
        </Text>
      </Section>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
        <Button label="Edit report" variant="secondary" iconLeft="edit" style={{ flex: 1 }} />
        <Button label="Delete" variant="danger" iconLeft="trash" style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={statStyles.stat}>
      <Text style={typography.h2}>{value}<Text style={statStyles.unit}> {unit}</Text></Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{title}</Text>
      <Card style={{ marginTop: spacing.sm }}>{children}</Card>
    </View>
  );
}

function Grid2({
  left,
  right,
}: {
  left: { label: string; value: string; sub?: string };
  right: { label: string; value: string; sub?: string };
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.lg, paddingVertical: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={typography.caption}>{left.label}</Text>
        <Text style={[typography.h3, { marginTop: 4 }]}>{left.value}</Text>
        {left.sub && <Text style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: 2 }}>{left.sub}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.caption}>{right.label}</Text>
        <Text style={[typography.h3, { marginTop: 4 }]}>{right.value}</Text>
        {right.sub && <Text style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: 2 }}>{right.sub}</Text>}
      </View>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={kvStyles.row}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{k}</Text>
      <Text style={typography.body}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.xl, borderRadius: radius.lg, overflow: 'hidden', minHeight: 130 },
  heroSub: { ...typography.bodySm, color: colors.textSecondary },
  counter: { ...typography.caption, backgroundColor: colors.cardAlt, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  handle: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

const detailStyles = StyleSheet.create({
  iconBtn: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
});

const statStyles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center' },
  unit: { ...typography.bodySm, color: colors.textSecondary, fontSize: 14 },
});

const kvStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
