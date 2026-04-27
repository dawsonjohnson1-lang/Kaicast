import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import type { AuthStackParamList } from '@/navigation/types';

export function WelcomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();

  const quickIn = () => signIn({ id: 'demo', name: 'Dawson', handle: 'bigdawg', email: 'dawson@kaicast.com', homeSpot: "Three Tables, O'ahu" });

  return (
    <Screen scroll={false} padding={0} edges={['top', 'left', 'right', 'bottom']}>
      <LinearGradient
        colors={['#04070d', '#062138', '#03070d']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <Logo size={50} showWordmark />
        <View style={{ height: spacing.xxl }} />
        <Text style={typography.display}>Read the ocean.</Text>
        <Text style={[typography.display, { color: colors.accent }]}>Dive smarter.</Text>
        <Text style={styles.sub}>
          Live conditions, dive logs, and friend reports for your favorite spots — all in one place.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Create Account" iconRight="arrow-right" onPress={() => nav.navigate('CreateAccount')} fullWidth />
        <View style={{ height: spacing.md }} />
        <Button label="Sign In" variant="secondary" onPress={() => nav.navigate('Login')} fullWidth />
        <View style={{ height: spacing.md }} />
        <Button label="Skip for now (demo)" variant="ghost" onPress={quickIn} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
