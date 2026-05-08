import React from 'react';
import { View, Text, Pressable, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '@/theme';

const ICONS: Record<string, ImageSourcePropType> = {
  Dashboard: require('../../assets/logo-mark.png'),
  Saved: require('../../assets/tab-saved.png'),
  Explore: require('../../assets/tab-explore.png'),
  Profile: require('../../assets/tab-profile.png'),
};

const LABELS: Record<string, string> = {
  Dashboard: 'DASHBOARD',
  Saved: 'SAVED',
  Explore: 'EXPLORE',
  Profile: 'PROFILE',
};

const ACTIVE_COLOR = '#0C9BFA';

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const color = focused ? ACTIVE_COLOR : 'rgba(255,255,255,0.55)';
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
                }
              }}
              style={styles.item}
              hitSlop={6}
            >
              <View style={[styles.topIndicator, focused && { backgroundColor: ACTIVE_COLOR }]} />
              <Image
                source={ICONS[route.name]}
                style={[styles.icon, { tintColor: color }]}
                resizeMode="contain"
              />
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
    paddingTop: 6,
    paddingBottom: 4,
    gap: 6,
  },
  topIndicator: {
    width: 36,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  icon: {
    width: 20,
    height: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
});
