import React, { forwardRef } from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: ViewStyle | ViewStyle[];
  rightSlot?: React.ReactNode;
};

export const Input = forwardRef<TextInput, Props>(({ label, hint, error, containerStyle, style, rightSlot, ...props }, ref) => {
  const message = error ?? hint;
  const showError = !!error;
  return (
    <View style={[{ gap: spacing.xs }, containerStyle as ViewStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.fieldWrap}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          {...props}
          style={[styles.input, rightSlot ? { paddingRight: 44 } : null, showError && { borderColor: colors.hazard }, style]}
        />
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {message ? (
        <Text style={[styles.hint, showError && { color: colors.hazard }]}>{message}</Text>
      ) : null}
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
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  fieldWrap: {
    position: 'relative',
  },
  fieldError: {
    // The TextInput child carries the visible border; mirror it here so
    // the error tint applies even when the input gets restyled by the
    // caller via `style`.
  },
  rightSlot: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
});
