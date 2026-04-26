import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import type { RootNav } from '@/navigation/types';

const FOLLOWERS = [
  { name: 'Mike Kahale', handle: '@mike_kahale', spot: "Three Tables, O'ahu" },
  { name: 'Sara Lopes', handle: '@saralopes', spot: 'Hanauma Bay' },
  { name: 'Tomo Tanaka', handle: '@tomo', spot: 'Molokini' },
  { name: 'Ash Akina', handle: '@ash808', spot: 'Electric Beach' },
  { name: 'Reef Larsen', handle: '@reef.l', spot: 'Mokuleia' },
];

export function FollowersScreen() {
  const nav = useNavigation<RootNav>();
  return (
    <Screen>
      <Header title="Followers" onBack={() => nav.goBack()} transparent />
      <Text style={styles.sub}>{FOLLOWERS.length} divers follow you</Text>
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {FOLLOWERS.map((f) => (
          <Card key={f.handle}>
            <View style={styles.row}>
              <Avatar initials={f.name.split(' ').map((s) => s[0]).join('')} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{f.name}</Text>
                <Text style={styles.meta}>{f.handle} · {f.spot}</Text>
              </View>
              <Button label="Follow back" size="sm" variant="secondary" />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});
