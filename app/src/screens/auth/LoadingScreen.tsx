import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
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
      <LinearGradient
        colors={['#020306', '#04111e', '#0a2540']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.haze} />
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <Logo size={120} showWordmark={false} color="#ffffff" />
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
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: 'rgba(26,184,255,0.18)',
    top: '40%',
  },
});
