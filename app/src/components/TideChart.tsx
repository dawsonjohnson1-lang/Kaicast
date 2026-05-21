import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing, typography } from '@/theme';
import { Icon } from './Icon';
import type { TidePoint } from '@/types';

type Props = {
  series: TidePoint[];
  trend: 'rising' | 'falling';
  nowFt: number;
  nextLabel: string;
  nextFt: number;
};

const W = 320;
const H = 150;

export function TideChart({ series, trend, nowFt, nextLabel }: Props) {
  const max = Math.max(...series.map((p) => p.heightFt));
  const min = Math.min(...series.map((p) => p.heightFt));
  const range = Math.max(0.5, max - min);

  const xs = (i: number) => (i / (series.length - 1)) * (W - 30) + 15;
  const ys = (v: number) => H - 35 - ((v - min) / range) * (H - 70);

  const path = series.reduce((acc, p, i) => {
    const x = xs(i);
    const y = ys(p.heightFt);
    if (i === 0) return `M ${x} ${y}`;
    const px = xs(i - 1);
    const py = ys(series[i - 1].heightFt);
    const cx1 = (px + x) / 2;
    return `${acc} C ${cx1} ${py}, ${cx1} ${y}, ${x} ${y}`;
  }, '');

  const nowIdx = series.findIndex((p) => p.hourLabel === 'NOW');
  const nowX = nowIdx >= 0 ? xs(nowIdx) : W / 2;
  const nowY = nowIdx >= 0 ? ys(series[nowIdx].heightFt) : H / 2;

  // Local extrema (peaks/troughs) for inline annotations.
  const extrema = series
    .map((p, i) => {
      if (i === 0 || i === series.length - 1) return null;
      const prev = series[i - 1].heightFt;
      const next = series[i + 1].heightFt;
      if (p.heightFt > prev && p.heightFt > next) return { i, p, kind: 'high' as const };
      if (p.heightFt < prev && p.heightFt < next) return { i, p, kind: 'low' as const };
      return null;
    })
    .filter((x): x is { i: number; p: TidePoint; kind: 'high' | 'low' } => x !== null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.trendPill}>
          <Icon name={trend === 'rising' ? 'rising' : 'falling'} size={14} color={colors.accent} />
          <Text style={styles.trendText}>{trend === 'rising' ? 'RISING' : 'FALLING'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={typography.h2}>{nowFt.toFixed(1)} <Text style={styles.unit}>FT</Text></Text>
          <Text style={styles.next}>
            & {trend === 'rising' ? 'RISING' : 'FALLING'}
            {nextLabel ? `  ·  ${nextLabel}` : ''}
          </Text>
        </View>
      </View>

      <Svg width={W} height={H}>
        <Path d={`${path} L ${W - 15} ${H - 25} L 15 ${H - 25} Z`} fill={colors.accent} fillOpacity={0.12} />
        <Path d={path} stroke={colors.accent} strokeWidth={2} fill="none" />

        {extrema.map(({ i, p, kind }) => {
          const x = xs(i);
          const y = ys(p.heightFt);
          const labelY = kind === 'high' ? y - 10 : y + 18;
          return (
            <React.Fragment key={i}>
              <Circle cx={x} cy={y} r={2.5} fill={colors.textSecondary} />
              <SvgText
                x={x}
                y={labelY}
                fill={colors.textSecondary}
                fontSize={9}
                fontWeight="700"
                textAnchor="middle"
              >
                {p.heightFt.toFixed(1)} FT
              </SvgText>
            </React.Fragment>
          );
        })}

        <Line x1={nowX} y1={10} x2={nowX} y2={H - 35} stroke={colors.accent} strokeDasharray="3,4" strokeOpacity={0.5} />
        <Circle cx={nowX} cy={nowY} r={14} fill={colors.accent} fillOpacity={0.18} />
        <Circle cx={nowX} cy={nowY} r={6} fill={colors.accent} stroke="#fff" strokeWidth={1.5} />
      </Svg>

      <View style={styles.labels}>
        {series.map((p, i) => (
          <Text key={i} style={[styles.label, p.hourLabel === 'NOW' && { color: colors.accent }]}>{p.hourLabel}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trendText: { ...typography.tag, color: colors.accent },
  unit: { ...typography.bodySm, color: colors.textSecondary, fontSize: 14 },
  next: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  label: { ...typography.caption, color: colors.textMuted, fontSize: 10 },
});
