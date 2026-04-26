import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = { total: number; current: number };

export function ProgressDots({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i < current;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: active ? colors.accent : colors.border, flex: active ? 1 : 0.6 },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  bar: { height: 4, borderRadius: 999, flex: 1 },
});
