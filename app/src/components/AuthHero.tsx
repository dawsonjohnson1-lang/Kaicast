import React from 'react';
import { ImageBackground, StyleSheet, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing } from '@/theme';

const jellyfishBg = require('@/assets/blurry-jellyfish.png');

type Props = {
  // Pixel height of the hero band. Picks up colors.bg as the gradient end.
  height?: number;
  style?: ViewStyle;
};

// Top-of-screen jellyfish hero that fades into colors.bg. Render this as
// the FIRST child of an auth Screen (with `padding={0}` or default xl
// padding) — the negative left/right/top offsets escape the Screen's
// content padding so the hero spans edge-to-edge.
export function AuthHero({ height = 360, style }: Props) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -spacing.xl,
          left: -spacing.xl,
          right: -spacing.xl,
          height,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <ImageBackground source={jellyfishBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', colors.bg]}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
