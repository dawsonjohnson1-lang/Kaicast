// CharterUpsell — the "Charter tier required" surface used by any
// screen behind the accountType === 'charter' gate. Mirrors the
// pattern in CharterDashboard so the lock-out experience is
// consistent across all charter-only entry points.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  title: string;
  body: string;
  onBack?: () => void;
};

export function CharterUpsell({ title, body, onBack }: Props) {
  return (
    <Screen contentStyle={{ paddingTop: 0 }} edges={['top', 'left', 'right', 'bottom']}>
      <Header title={title} onBack={onBack} transparent />
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <Icon name="lock" size={28} color={colors.accent} />
        </View>
        <Text style={styles.title}>Charter tier required</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={{ height: spacing.lg }} />
        <Button label="Learn more about Charter" fullWidth onPress={onBack ?? (() => {})} />
        {onBack ? (
          <Pressable onPress={onBack} style={{ marginTop: spacing.lg }}>
            <Text style={styles.dismiss}>Back to KaiCast</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  dismiss: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
