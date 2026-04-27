import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle | ViewStyle[];
  edges?: Edge[];
  bg?: string;
  padding?: number;
};

export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
  bg = colors.bg,
  padding = spacing.xl,
}: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
      <StatusBar barStyle="light-content" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding, paddingBottom: 120 }, contentStyle as ViewStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding }, contentStyle as ViewStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
