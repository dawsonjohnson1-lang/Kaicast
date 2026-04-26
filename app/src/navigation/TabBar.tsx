import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '@/theme';
import { Icon, IconName } from '@/components/Icon';

const ICONS: Record<string, IconName> = {
  Dashboard: 'home',
  Saved: 'bookmark',
  Explore: 'compass',
  Profile: 'profile',
};

const LABELS: Record<string, string> = {
  Dashboard: 'Dashboard',
  Saved: 'Saved Spots',
  Explore: 'Explore',
  Profile: 'Profile',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const color = focused ? colors.accent : colors.textMuted;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
              }}
              style={styles.item}
              hitSlop={6}
            >
              <Icon name={ICONS[route.name]} size={22} color={color} />
              <Text style={[styles.label, { color }]}>{LABELS[route.name]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
