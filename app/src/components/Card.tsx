import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: keyof typeof spacing | number;
  bordered?: boolean;
};

export function Card({ children, style, padding = 'lg', bordered = false }: Props) {
  const padValue = typeof padding === 'number' ? padding : spacing[padding];
  return (
    <View
      style={[
        styles.card,
        bordered && styles.bordered,
        { padding: padValue },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
