import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, View, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  style?: ViewStyle | ViewStyle[];
  fullWidth?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  iconLeft,
  iconRight,
  style,
  fullWidth,
}: Props) {
  const isDisabled = disabled || loading;
  const v = variants[variant];
  const s = sizes[size];

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        v.container,
        { paddingVertical: s.py, paddingHorizontal: s.px, borderRadius: radius.pill },
        fullWidth && { alignSelf: 'stretch' },
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style as ViewStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <View style={styles.row}>
          {iconLeft && <Icon name={iconLeft} size={s.icon} color={v.text.color as string} />}
          <Text style={[v.text, { fontSize: s.font }]}>{label}</Text>
          {iconRight && <Icon name={iconRight} size={s.icon} color={v.text.color as string} />}
        </View>
      )}
    </Pressable>
  );
}

const sizes: Record<Size, { py: number; px: number; font: number; icon: number }> = {
  sm: { py: 8, px: 14, font: 13, icon: 16 },
  md: { py: 12, px: 18, font: 15, icon: 18 },
  lg: { py: 16, px: 24, font: 16, icon: 20 },
};

const variants: Record<Variant, { container: ViewStyle; text: { color: string; fontWeight: '600' | '700' } }> = {
  primary: {
    container: { backgroundColor: colors.accent },
    text: { color: '#0a1626', fontWeight: '700' },
  },
  secondary: {
    container: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.textPrimary, fontWeight: '600' },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.textSecondary, fontWeight: '600' },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent },
    text: { color: colors.accent, fontWeight: '700' },
  },
  danger: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.hazard, fontWeight: '700' },
  },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
