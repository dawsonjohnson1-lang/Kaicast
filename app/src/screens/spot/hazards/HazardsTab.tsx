import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Card } from '@/components/Card';
import { colors, radius, spacing, typography } from '@/theme';
import type { Spot } from '@/types';
import { getHazardsReport } from './data';
import type {
  HazardsReport,
  MarineSpecies,
  SeverityValue,
  StatusLevel,
} from './types';

type Props = {
  spot?: Spot;
};

export function HazardsTab({ spot }: Props) {
  const report = getHazardsReport(spot);

  return (
    <View style={{ gap: spacing.md }}>
      <StatusBanner level={report.status.level} text={report.status.text} />
      <UvSection value={report.uv.value} severity={report.uv.severity} />
      <RunoffSection cards={report.runoff} note={report.runoffNote} />
      <MarineLifeSection species={report.marineLife} />
      <SafetySection cards={report.safety} />
    </View>
  );
}

// 1. STATUS BANNER ----------------------------------------------------------

function StatusBanner({ level, text }: { level: StatusLevel; text: string }) {
  const tone = STATUS_TONE[level];
  return (
    <View style={[banner.row, { backgroundColor: tone.bg, borderColor: tone.ring }]}>
      <View style={[banner.dot, { backgroundColor: tone.fg }]} />
      <Text style={[banner.text, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

const STATUS_TONE: Record<StatusLevel, { fg: string; bg: string; ring: string }> = {
  clear:   { fg: colors.excellent, bg: colors.excellentSoft, ring: 'rgba(34,211,107,0.45)' },
  caution: { fg: colors.warn,      bg: colors.warnSoft,      ring: 'rgba(245,176,65,0.45)' },
  hazard:  { fg: colors.hazard,    bg: colors.hazardSoft,    ring: 'rgba(232,90,60,0.5)' },
};

// 2. UV RATING --------------------------------------------------------------

const UV_GRADIENT_STOPS = ['#1ab8ff', '#22d36b', '#f5b041', '#f57f3a', '#e85a3c'];
const UV_MAX = 11;

function UvSection({ value, severity }: { value: number; severity: string }) {
  const t = Math.min(Math.max(value / UV_MAX, 0), 1);
  return (
    <Card>
      <View style={uv.headerRow}>
        <Text style={typography.caption}>UV RATING</Text>
        <Text style={[uv.severity, { color: severityToColor(value) }]}>{severity}</Text>
      </View>
      <View style={uv.barWrap}>
        <LinearGradient
          colors={UV_GRADIENT_STOPS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={uv.bar}
        />
        <View
          style={[
            uv.knob,
            { left: `${t * 100}%` },
          ]}
          // The knob's left edge sits at the percent mark, but we shift it
          // back by half its width so the dot is centered on the value.
        />
      </View>
      <Text style={uv.value}>{value.toFixed(0)}</Text>
    </Card>
  );
}

function severityToColor(uv: number): string {
  if (uv <= 2) return colors.accent;
  if (uv <= 5) return colors.excellent;
  if (uv <= 7) return colors.warn;
  if (uv <= 10) return colors.hazard;
  return colors.hazard;
}

// 3. RUNOFF CONDITIONS ------------------------------------------------------

function RunoffSection({ cards, note }: { cards: SeverityValue[]; note?: string }) {
  return (
    <View>
      <Text style={[typography.caption, { marginBottom: spacing.sm }]}>RUNOFF CONDITIONS</Text>
      <View style={runoff.grid}>
        {cards.map((c) => (
          <SeverityCard key={c.label} {...c} />
        ))}
      </View>
      {note ? <Text style={runoff.note}>{note}</Text> : null}
    </View>
  );
}

// 4. MARINE LIFE ------------------------------------------------------------

const MARINE_LABELS: Record<MarineSpecies['likelihood'], string> = {
  UNLIKELY: 'UNLIKELY',
  POSSIBLE: 'POSSIBLE',
  LIKELY: 'LIKELY',
};

const MARINE_COLOR: Record<MarineSpecies['likelihood'], string> = {
  UNLIKELY: colors.excellent,
  POSSIBLE: colors.warn,
  LIKELY: colors.hazard,
};

function MarineLifeSection({ species }: { species: MarineSpecies[] }) {
  return (
    <View>
      <Text style={[typography.caption, { marginBottom: spacing.sm }]}>MARINE LIFE</Text>
      <View style={{ gap: spacing.md }}>
        {species.map((sp) => {
          const color = MARINE_COLOR[sp.likelihood];
          return (
            <Card key={sp.name}>
              <View style={marine.headerRow}>
                <Text style={typography.h3}>{sp.name}</Text>
                <View style={[marine.pill, { backgroundColor: color + '22', borderColor: color }]}>
                  <Text style={[marine.pillText, { color }]}>{MARINE_LABELS[sp.likelihood]}</Text>
                </View>
              </View>
              <Text style={[marine.value, { color }]}>{sp.likelihood.toLowerCase()}</Text>
              <View style={{ height: spacing.md }} />
              <Text style={typography.caption}>NOTE</Text>
              <Text style={marine.note}>{sp.note}</Text>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

// 5. SAFETY QUICK LOOK ------------------------------------------------------

function SafetySection({ cards }: { cards: SeverityValue[] }) {
  return (
    <View>
      <Text style={[typography.caption, { marginBottom: spacing.sm }]}>SAFETY QUICK LOOK</Text>
      <View style={runoff.grid}>
        {cards.map((c) => (
          <SeverityCard key={c.label} {...c} />
        ))}
      </View>
    </View>
  );
}

// SHARED -------------------------------------------------------------------

function SeverityCard({ label, value, color }: SeverityValue) {
  return (
    <Card style={severity.card}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={[severity.value, { color }]}>{value.toLowerCase()}</Text>
    </Card>
  );
}

// STYLES -------------------------------------------------------------------

const banner = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 999 },
  text: { ...typography.body, flex: 1 },
});

const uv = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  severity: { ...typography.caption, fontWeight: '700' },
  barWrap: { marginTop: spacing.md, height: 20, justifyContent: 'center' },
  bar: { height: 8, borderRadius: 999 },
  knob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.4)',
    marginLeft: -8,
  },
  value: { ...typography.h2, marginTop: spacing.md, fontSize: 32, fontWeight: '800' },
});

const runoff = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  note: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});

const marine = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  value: { fontSize: 32, fontWeight: '800', marginTop: spacing.md },
  note: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});

const severity = StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, gap: spacing.sm },
  value: { fontSize: 28, fontWeight: '800', textTransform: 'lowercase' },
});
