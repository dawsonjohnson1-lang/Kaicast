import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Icon, IconName } from './Icon';

type Props = {
  title?: string;
  onBack?: () => void;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightSlot?: React.ReactNode;
  transparent?: boolean;
};

export function Header({ title, onBack, rightIcon, onRightPress, rightSlot, transparent }: Props) {
  return (
    <View style={[styles.header, !transparent && { backgroundColor: colors.bg }]}>
      <View style={styles.side}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={12} style={styles.iconBtn}>
            <Icon name="chevron-left" size={22} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>
      {title ? <Text style={[typography.h3, styles.title]} numberOfLines={1}>{title}</Text> : <View />}
      <View style={[styles.side, { alignItems: 'flex-end' }]}>
        {rightSlot ??
          (rightIcon && (
            <Pressable onPress={onRightPress} hitSlop={12} style={styles.iconBtn}>
              <Icon name={rightIcon} size={22} color={colors.textPrimary} />
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  side: { width: 52 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
