// Self-serve account deletion.
//
// Required for App Store submission per Apple Guideline 5.1.1(v). The
// flow walks the user through what will be deleted, requires password
// re-entry (Firebase reauthenticateWithCredential), then invokes the
// deleteUserAccount cloud function which handles the cascading
// cleanup the client can't do under our security rules.
//
// Success path: sign out → navigator drops back to AuthNav.
// Failure paths: surface the error inline and stay on this screen.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { deleteAccount, AccountDeletionError } from '@/api/deleteAccount';
import type { RootNav } from '@/navigation/types';

export function DeleteAccountScreen() {
  const nav = useNavigation<RootNav>();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && confirmText.toUpperCase() === 'DELETE' && !busy;

  const onConfirm = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      // signOut() inside deleteAccount triggers onAuthStateChanged →
      // the navigator unmounts this screen and routes to AuthNav. No
      // explicit nav call needed; trying to nav now would race with
      // the unmount.
    } catch (err) {
      const e = err as AccountDeletionError;
      setError(e.message || 'Deletion failed. Try again.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Delete Account" onBack={() => nav.goBack()} transparent />

      <View style={styles.iconWrap}>
        <Icon name="trash" size={32} color={colors.hazard} />
      </View>

      <Text style={[typography.h1, { textAlign: 'center', marginTop: spacing.lg }]}>
        Delete your account?
      </Text>
      <Text style={styles.lead}>
        This is permanent. We can't recover it later.
      </Text>

      <Card style={styles.warnCard}>
        <Text style={styles.warnTitle}>What gets deleted</Text>
        <BulletRow text="Your dive logs, photos, and saved spots" />
        <BulletRow text="Your follower / following connections" />
        <BulletRow text="Your profile, name, and home spot" />
        <BulletRow text="Your sign-in (you can't sign back in with this email)" />
      </Card>

      <Text style={styles.label}>Confirm with your password</Text>
      <Input
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={(t) => { setPassword(t); setError(null); }}
        autoCapitalize="none"
        autoComplete="password"
      />

      <Text style={styles.label}>Type DELETE to confirm</Text>
      <Input
        placeholder="DELETE"
        value={confirmText}
        onChangeText={(t) => { setConfirmText(t); setError(null); }}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ height: spacing.lg }} />
      <Button
        label="Delete account permanently"
        variant="danger"
        fullWidth
        loading={busy}
        disabled={!canSubmit}
        onPress={onConfirm}
      />
      <Pressable style={styles.cancelBtn} onPress={() => nav.goBack()} disabled={busy}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </Screen>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={bulletStyles.row}>
      <View style={bulletStyles.dot} />
      <Text style={bulletStyles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    width: 64, height: 64, borderRadius: 999,
    backgroundColor: 'rgba(247, 55, 38, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  lead: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  warnCard: {
    marginTop: spacing.xl,
    backgroundColor: 'rgba(247, 55, 38, 0.06)',
    borderColor: 'rgba(247, 55, 38, 0.4)',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  warnTitle: {
    ...typography.bodySm,
    fontWeight: '700',
    color: colors.hazard,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  error: {
    ...typography.bodySm,
    color: colors.hazard,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  cancelBtn: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.md },
  cancelText: { ...typography.body, color: colors.textSecondary },
});

const bulletStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4, gap: spacing.sm },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.hazard, marginTop: 8 },
  text: { ...typography.bodySm, color: colors.textPrimary, flex: 1, lineHeight: 20 },
});
