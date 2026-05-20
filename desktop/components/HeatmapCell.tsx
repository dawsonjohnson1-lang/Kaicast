import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../tokens';

/**
 * Single cell in the GitHub-style 52-week activity heatmap.
 *
 * Intensity is a 0–4 bucket. 0 → empty cell, 4 → full accent. The
 * column comes from the parent layout — this is a leaf primitive.
 */

export interface HeatmapCellProps {
  intensity: 0 | 1 | 2 | 3 | 4;
  size?: number;
}

export function HeatmapCell({ intensity, size = 11 }: HeatmapCellProps) {
  const opacity = intensity === 0 ? 0 : 0.2 + intensity * 0.2; // 0.4, 0.6, 0.8, 1.0
  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: intensity === 0 ? colors.surface1 : colors.accent,
          opacity: intensity === 0 ? 1 : opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: 2,
  },
});
