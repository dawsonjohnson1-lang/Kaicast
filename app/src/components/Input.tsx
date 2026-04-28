import React, { forwardRef } from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  containerStyle?: ViewStyle | ViewStyle[];
};

export const Input = forwardRef<TextInput, Props>(({ label, hint, containerStyle, style, ...props }, ref) => {
  return (
    <View style={[{ gap: spacing.xs }, containerStyle as ViewStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[styles.input, style]}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  label: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1C1C1C',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  hint: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
});
