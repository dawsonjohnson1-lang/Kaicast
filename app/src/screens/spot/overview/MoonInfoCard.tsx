import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, ClipPath, Rect } from 'react-native-svg';

import { Card } from '@/components/Card';
import { colors, spacing, typography } from '@/theme';

type Props = {
  phase: string;
  illumination: number;
  daysSinceFullMoon: number;
};

export function MoonInfoCard({ phase, illumination, daysSinceFullMoon }: Props) {
  const illumPct = Math.round(illumination * 100);
  const nightDiveAdvised = illumPct >= 25;

  return (
    <Card>
      <Text style={typography.caption}>MOON INFO</Text>
      <View style={s.headerRow}>
        <Text style={s.phase}>{phase.toUpperCase()}</Text>
        <MoonGlyph phase={phase} illumination={illumination} size={56} />
      </View>

      <View style={s.grid}>
        <View style={s.cell}>
          <Text style={typography.caption}>ILLUMINATION</Text>
          <Text style={s.metric}>{illumPct}%</Text>
        </View>
        <View style={s.cell}>
          <Text style={typography.caption}>DAYS SINCE FULL MOON</Text>
          <Text style={s.metric}>{daysSinceFullMoon}</Text>
        </View>
      </View>

      {!nightDiveAdvised ? (
        <Text style={s.footer}>
          Low ambient light tonight — night diving is not recommended without supplemental lighting.
        </Text>
      ) : null}
    </Card>
  );
}

// Approximate moon glyph: outer disc with a shadow disc whose horizontal
// offset matches illumination + waxing/waning sign. Not phase-accurate
// (no terminator ellipse), but reads correctly at small sizes.
function MoonGlyph({ phase, illumination, size }: { phase: string; illumination: number; size: number }) {
  const r = size / 2;
  const isWaning = /WANING|LAST|THIRD/i.test(phase);
  const isFull = /FULL/i.test(phase);
  const isNew = /NEW/i.test(phase);

  // Distance the shadow disc center sits from the lit disc center.
  // 0 = full overlap (new moon), 2r = no overlap (full moon).
  const shadowOffset = isFull ? 2 * r : isNew ? 0 : (1 - illumination) * r * 1.6;
  const cx = r + (isWaning ? +1 : -1) * shadowOffset;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id="moonClip">
          <Circle cx={r} cy={r} r={r - 1} />
        </ClipPath>
      </Defs>
      <Circle cx={r} cy={r} r={r - 1} fill="#e7eaf0" />
      <Rect x={0} y={0} width={size} height={size} fill={colors.card} clipPath="url(#moonClip)" opacity={0} />
      <Circle cx={cx} cy={r} r={r - 1} fill={colors.card} clipPath="url(#moonClip)" />
      <Circle cx={r} cy={r} r={r - 1} fill="none" stroke={colors.border} strokeWidth={1} />
    </Svg>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  phase: { ...typography.h2, flex: 1 },
  grid: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  cell: { flex: 1, gap: spacing.xs },
  metric: { ...typography.h2, color: colors.textPrimary },
  footer: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.lg,
  },
});
