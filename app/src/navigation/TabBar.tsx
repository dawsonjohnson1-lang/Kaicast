import React from 'react';
import { View, Text, Pressable, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '@/theme';

const ICONS: Record<string, ImageSourcePropType> = {
  Dashboard: require('../../assets/tab-dashboard.png'),
  Saved: require('../../assets/tab-saved.png'),
  Explore: require('../../assets/tab-explore.png'),
  Profile: require('../../assets/tab-profile.png'),
};

const LABELS: Record<string, string> = {
  Dashboard: 'DASHBOARD',
  Saved: 'SAVED SPOTS',
  Explore: 'EXPLORE',
  Profile: 'PROFILE',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const color = focused ? colors.accent : 'rgba(255,255,255,0.55)';
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
              <Image
                source={ICONS[route.name]}
                style={[styles.icon, { tintColor: color }]}
                resizeMode="contain"
              />
              <Text style={[styles.label, { color }]}>{LABELS[route.name]}</Text>
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
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
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  icon: { width: 26, height: 26 },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  indicator: {
    width: 24,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  indicatorActive: { backgroundColor: colors.accent },
});
