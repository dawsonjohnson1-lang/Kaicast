import React from 'react';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = {
  size?: number;
  bearing?: number; // degrees, 0=N
  speed?: number;
  speedLabel?: string;
};

export function CompassDial({ size = 90, bearing = 60, speed, speedLabel }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const ticks = 12;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} stroke={colors.border} strokeWidth={1.5} fill={colors.cardAlt} />
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (i / ticks) * Math.PI * 2;
          const x1 = cx + Math.sin(a) * (r - 4);
          const y1 = cy - Math.cos(a) * (r - 4);
          const x2 = cx + Math.sin(a) * r;
          const y2 = cy - Math.cos(a) * r;
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.textMuted} strokeWidth={1} />;
        })}
        <SvgText x={cx} y={10} fontSize={9} fill={colors.textSecondary} textAnchor="middle" fontWeight="700">N</SvgText>
        <G transform={`rotate(${bearing} ${cx} ${cy})`}>
          <Polygon
            points={`${cx},${cy - r + 8} ${cx - 6},${cy + 4} ${cx + 6},${cy + 4}`}
            fill={colors.accent}
          />
          <Polygon
            points={`${cx},${cy + r - 8} ${cx - 4},${cy - 2} ${cx + 4},${cy - 2}`}
            fill={colors.textMuted}
          />
        </G>
        <Circle cx={cx} cy={cy} r={4} fill="#fff" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
