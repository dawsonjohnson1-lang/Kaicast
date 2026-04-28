import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StatusBar, ImageBackground, ImageSourcePropType } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle | ViewStyle[];
  edges?: Edge[];
  bg?: string;
  padding?: number;
  bgImage?: ImageSourcePropType;
  bgOverlay?: string;
};

export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
  bg = colors.bg,
  padding = spacing.xl,
  bgImage,
  bgOverlay,
}: Props) {
  const safeBg = bgImage ? 'transparent' : bg;
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {bgImage ? (
        <ImageBackground source={bgImage} resizeMode="cover" style={StyleSheet.absoluteFill} />
      ) : null}
      {bgOverlay ? <View style={[StyleSheet.absoluteFill, { backgroundColor: bgOverlay }]} /> : null}
      <SafeAreaView style={[styles.safe, { backgroundColor: safeBg }]} edges={edges}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
