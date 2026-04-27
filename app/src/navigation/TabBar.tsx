import React from 'react';
import { View, Text, Pressable, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '@/theme';
import { RadarIcon } from '@/components/RadarIcon';

const ICONS: Record<string, ImageSourcePropType> = {
  Dashboard: require('../../assets/tab-dashboard.png'),
  Saved: require('../../assets/tab-saved.png'),
  Explore: require('../../assets/tab-explore.png'),
  Profile: require('../../assets/tab-profile.png'),
};

const VARIANTS: Record<string, 'dashboard' | 'saved' | 'explore' | 'profile'> = {
  Dashboard: 'dashboard',
  Saved: 'saved',
  Explore: 'explore',
  Profile: 'profile',
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
      <View style={styles.topAccent} />
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
              <Image source={ICONS[route.name]} style={[styles.icon, { tintColor: color }]} resizeMode="contain" />
              <View style={[styles.indicator, focused && styles.indicatorActive]} />
              <RadarIcon variant={VARIANTS[route.name]} size={26} color={color} />
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
    backgroundColor: '#000000',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
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
  icon: {
    width: 26,
    height: 26,
    flex: 1,
    paddingBottom: 6,
  },
  indicator: {
    width: 38,
    height: 2,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  indicatorActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
