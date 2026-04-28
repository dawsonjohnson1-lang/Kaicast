import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

// Splash placeholder: deep-water gradient with subtle blue haze.
// To match the Figma comp exactly, drop an underwater photo into
// app/assets/loading-bg.jpg and swap the gradient for an <Image source={...} />.
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
        colors={['#02060c', '#061826', '#0a2540']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.haze} />
      <View style={styles.vignette} />
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <Logo size={92} showWordmark={false} />
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
  haze: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 360,
    backgroundColor: 'rgba(18,86,140,0.22)',
    top: '30%',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
