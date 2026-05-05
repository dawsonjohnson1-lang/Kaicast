import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  total: number;
  current: number;
};

const opacityFor = (i: number, current: number) => {
  if (i < current) return 1.0;
  if (i === current) return 0.71;
  return 0.39;
};

export function ProgressBars({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.bar, { opacity: opacityFor(i, current) }]}>
          <LinearGradient
            colors={['#07a8fc', '#1190fa']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
