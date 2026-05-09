import React from 'react';
import { View, Text, ImageBackground, StyleSheet, Image } from 'react-native';
import Svg, { Line, Text as SvgText, Path, G } from 'react-native-svg';

import { Card } from '@/components/Card';
import { satelliteUrl } from '@/api/satellite';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  label: string;            // "WIND" | "CURRENT"
  value: number;
  unit: string;             // "MPH"
  descriptor: string;       // "LIGHT TRADES", "STRONG", "NON-EXISTENT"
  directionDegrees: number; // 0 = N, 90 = E, etc.
  spotCoords: { lat: number; lon: number };
  footnote?: string;        // optional, e.g. "20 MPH GUST"
};

const COMPASS_SIZE = 120;

export function DirectionalReadingCard({
  label,
  value,
  unit,
  descriptor,
  directionDegrees,
  spotCoords,
  footnote,
}: Props) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={typography.caption}>{label}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.unit}>{unit}</Text>
          </View>
          <Text style={styles.descriptor}>{descriptor}</Text>
          {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
        </View>
        <Compass directionDegrees={directionDegrees} spotCoords={spotCoords} />
      </View>
    </Card>
  );
}

function Compass({
  directionDegrees,
  spotCoords,
}: {
  directionDegrees: number;
  spotCoords: { lat: number; lon: number };
}) {
  const ringRadius = COMPASS_SIZE / 2;
  const tileUri = satelliteUrl(spotCoords.lat, spotCoords.lon, COMPASS_SIZE, COMPASS_SIZE, 16);
  return (
    <View style={styles.compass}>
      {tileUri ? (
        <ImageBackground
          source={{ uri: tileUri }}
          style={StyleSheet.absoluteFill}
          imageStyle={{ borderRadius: radius.lg }}
        />
      ) : null}
      <View style={styles.compassDarken} />

      <Svg width={COMPASS_SIZE} height={COMPASS_SIZE} style={StyleSheet.absoluteFill}>
        {/* Tick marks every 45° */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angleRad = (i * 45 * Math.PI) / 180;
          const cosA = Math.sin(angleRad);
          const sinA = -Math.cos(angleRad);
          const outer = ringRadius - 4;
          const inner = ringRadius - 11;
          return (
            <Line
              key={i}
              x1={ringRadius + cosA * outer}
              y1={ringRadius + sinA * outer}
              x2={ringRadius + cosA * inner}
              y2={ringRadius + sinA * inner}
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Degree labels at 8 cardinal/intercardinal points */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const angleRad = (deg * Math.PI) / 180;
          const cosA = Math.sin(angleRad);
          const sinA = -Math.cos(angleRad);
          const r = ringRadius - 22;
          return (
            <SvgText
              key={deg}
              x={ringRadius + cosA * r}
              y={ringRadius + sinA * r + 3}
              fill="#ffffff"
              fontSize={8}
              fontWeight="700"
              textAnchor="middle"
            >
              {deg}
            </SvgText>
          );
        })}

        {/* Directional arrow — rotates around center */}
        <G origin={`${ringRadius}, ${ringRadius}`} rotation={directionDegrees}>
          <Path
            d={`M ${ringRadius} ${ringRadius - 30}
                L ${ringRadius - 6} ${ringRadius - 18}
                L ${ringRadius + 6} ${ringRadius - 18} Z`}
            fill="#ffffff"
          />
          <Line
            x1={ringRadius}
            y1={ringRadius - 18}
            x2={ringRadius}
            y2={ringRadius + 6}
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  left: { flex: 1, gap: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: spacing.xs },
  value: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  unit: {
    ...typography.bodySm,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  descriptor: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  footnote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  compass: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
  },
  compassDarken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.lg,
  },
});
