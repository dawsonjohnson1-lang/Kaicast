import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = {
  size?: number;
  showWordmark?: boolean;
  color?: string;
};

export function Logo({ size = 28, showWordmark = true, color = colors.textPrimary }: Props) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/logo-k-wave.png')}
        style={{ width: size, height: size, tintColor: color }}
        resizeMode="contain"
      />
      {showWordmark && <Text style={[styles.wordmark, { color }]}>KAICAST</Text>}
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
