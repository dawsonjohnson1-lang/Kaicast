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

const FOLLOWING = [
  { name: 'Mike Kahale', handle: '@mike_kahale', spot: "Three Tables, O'ahu" },
  { name: 'Naia Pohaku', handle: '@naia.p', spot: 'Lanai' },
  { name: 'Reef Larsen', handle: '@reef.l', spot: 'Mokuleia' },
  { name: 'Kona Iona', handle: '@kona', spot: 'Kona' },
];

export function FollowingScreen() {
  const nav = useNavigation<RootNav>();
  return (
    <Screen>
      <Header title="Following" onBack={() => nav.goBack()} transparent />
      <Text style={styles.sub}>{FOLLOWING.length} divers you follow</Text>
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {FOLLOWING.map((f) => (
          <Card key={f.handle}>
            <View style={styles.row}>
              <Avatar initials={f.name.split(' ').map((s) => s[0]).join('')} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{f.name}</Text>
                <Text style={styles.meta}>{f.handle} · {f.spot}</Text>
              </View>
              <Button label="Following" size="sm" variant="outline" />
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
