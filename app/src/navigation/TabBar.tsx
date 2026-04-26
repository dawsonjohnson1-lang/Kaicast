import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '@/theme';

type Glyph = 'pin' | 'heart' | 'target' | 'profile';

const GLYPHS: Record<string, Glyph> = {
  Dashboard: 'pin',
  Saved: 'heart',
  Explore: 'target',
  Profile: 'profile',
};

const LABELS: Record<string, string> = {
  Dashboard: 'DASHBOARD',
  Saved: 'SAVED SPOTS',
  Explore: 'EXPLORE',
  Profile: 'PROFILE',
};

function BroadcastIcon({ glyph, color, size = 30 }: { glyph: Glyph; color: string; size?: number }) {
  const sw = 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* outer broadcast arc */}
      <Path
        d="M4.5 18 C4.5 11.5 9.5 6 16 6 C22.5 6 27.5 11.5 27.5 18"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      {/* inner broadcast arc */}
      <Path
        d="M9 19 C9 14.6 12.1 11 16 11 C19.9 11 23 14.6 23 19"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      {/* center pin/circle */}
      <Circle cx="16" cy="20" r="5" stroke={color} strokeWidth={sw} fill="none" />
      {/* glyph inside the pin */}
      {glyph === 'pin' && <Circle cx="16" cy="20" r="1.6" fill={color} />}
      {glyph === 'heart' && (
        <Path
          d="M16 22.4 L13.6 20.1 C12.6 19.1 12.6 17.6 13.6 16.7 C14.5 15.8 15.9 15.9 16 17.1 C16.1 15.9 17.5 15.8 18.4 16.7 C19.4 17.6 19.4 19.1 18.4 20.1 Z"
          fill={color}
        />
      )}
      {glyph === 'target' && (
        <>
          <Circle cx="16" cy="20" r="2.6" stroke={color} strokeWidth={sw} fill="none" />
          <Circle cx="16" cy="20" r="0.9" fill={color} />
        </>
      )}
      {glyph === 'profile' && (
        <>
          <Circle cx="16" cy="18.6" r="1.4" fill={color} />
          <Path d="M13 23 C13 21.5 14.3 20.6 16 20.6 C17.7 20.6 19 21.5 19 23 Z" fill={color} />
        </>
      )}
    </Svg>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.topAccent} />
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const color = focused ? colors.accent : '#b9bdc4';
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
              <BroadcastIcon glyph={GLYPHS[route.name]} color={color} />
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
    backgroundColor: '#000',
    paddingTop: spacing.md,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
