import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

type Props = {
  size?: number;
  showWordmark?: boolean;
  color?: string;
};

export function Logo({ size = 28, showWordmark = true, color = colors.textPrimary }: Props) {
  return (
    <View style={styles.row}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path
          d="M14 8 L14 56 L24 56 L24 38 L42 56 L56 56 L34 33 L52 14 L40 14 L24 30 L24 8 Z"
          fill={color}
        />
        <Path
          d="M44 6 C50 14 54 22 54 30 C54 36 50 42 44 46 C50 38 50 26 44 14 Z"
          fill={color}
          opacity={0.85}
        />
      </Svg>
      {showWordmark && (
        <Text style={[styles.wordmark, { color }]}>KAICAST</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
