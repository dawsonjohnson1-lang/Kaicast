import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, ImageBackground } from 'react-native';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme';

const diverBg = require('@/assets/Diver-background.jpg');

export function LoadingView() {
  const fade = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [fade, scale]);

  return (
    <View style={styles.root}>
      <ImageBackground source={diverBg} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <Logo size={120} showWordmark={false} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
});
