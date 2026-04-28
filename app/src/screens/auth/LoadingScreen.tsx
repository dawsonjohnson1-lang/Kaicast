import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

// The Figma comp uses an underwater freediver photo behind the centered
// K-mark logo. Until that photo lands in the repo, this renders a
// deep-water gradient with bubble-like specks as a stand-in. To swap in
// the real asset:
//   1. Add app/assets/loading-bg.jpg
//   2. Replace the <LinearGradient> + bubbles block with:
//        <Image source={require('../../../assets/loading-bg.jpg')}
//               style={StyleSheet.absoluteFill} resizeMode="cover" />
export function LoadingScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const fade = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => nav.replace('Welcome'), 1800);
    return () => clearTimeout(t);
  }, [fade, scale, nav]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#020409', '#04111e', '#0a2a4a']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {BUBBLES.map((b, i) => (
        <View
          key={i}
          style={[
            styles.bubble,
            {
              top: `${b.top}%`,
              left: `${b.left}%`,
              width: b.size,
              height: b.size,
              borderRadius: b.size,
              opacity: b.opacity,
            },
          ]}
        />
      ))}

      <View style={styles.vignette} />

      <Animated.View style={styles.logoWrap}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
          <Logo size={96} showWordmark={false} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const BUBBLES = [
  { top: 8,  left: 12, size: 4,  opacity: 0.35 },
  { top: 15, left: 78, size: 3,  opacity: 0.30 },
  { top: 24, left: 38, size: 5,  opacity: 0.40 },
  { top: 32, left: 62, size: 3,  opacity: 0.25 },
  { top: 44, left: 18, size: 6,  opacity: 0.45 },
  { top: 52, left: 84, size: 4,  opacity: 0.35 },
  { top: 60, left: 46, size: 3,  opacity: 0.25 },
  { top: 70, left: 28, size: 5,  opacity: 0.40 },
  { top: 78, left: 70, size: 4,  opacity: 0.30 },
  { top: 86, left: 8,  size: 3,  opacity: 0.25 },
];

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
