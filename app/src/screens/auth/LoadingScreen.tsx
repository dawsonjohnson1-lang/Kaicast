import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

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
      <Image source={require('../../../assets/loading-bg.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(16,16,16,0.78)', 'rgba(16,16,16,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={styles.logoWrap}>
        <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
          <Logo size={80} showWordmark={false} />
        </Animated.View>
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
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
