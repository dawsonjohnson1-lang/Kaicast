import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type Props = {
  title: string;
  action?: string;
  onActionPress?: () => void;
};

export function SectionTitle({ title, action, onActionPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={typography.h3}>{title}</Text>
      {action && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  action: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
