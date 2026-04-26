import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

type Props = {
  initials?: string;
  size?: number;
  ring?: boolean;
  style?: ViewStyle;
};

const gradients: [string, string][] = [
  ['#1ab8ff', '#0a8fd8'],
  ['#7c3aed', '#22d3ee'],
  ['#16c47f', '#0a8fd8'],
  ['#facc15', '#f97316'],
  ['#ef5350', '#7c3aed'],
];

export function Avatar({ initials = '?', size = 44, ring, style }: Props) {
  const seed = initials.charCodeAt(0) % gradients.length;
  const g = gradients[seed];
  return (
    <View
      style={[
        {
          width: size + (ring ? 4 : 0),
          height: size + (ring ? 4 : 0),
          borderRadius: 999,
          padding: ring ? 2 : 0,
          backgroundColor: ring ? colors.accent : 'transparent',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={g}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatar, { width: size, height: size, borderRadius: 999 }]}
      >
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials.toUpperCase()}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
