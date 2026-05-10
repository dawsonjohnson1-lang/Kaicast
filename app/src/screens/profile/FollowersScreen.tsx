import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useFollowing } from '@/hooks/useFollowing';
import type { RootNav } from '@/navigation/types';

export function FollowersScreen() {
  const nav = useNavigation<RootNav>();
  const { user } = useAuth();
  const { followers, loading, isFollowing, follow, unfollow } = useFollowing(user?.id);

  return (
    <Screen>
      <Header title="Followers" onBack={() => nav.goBack()} transparent />
      <Text style={styles.sub}>
        {loading
          ? 'Loading…'
          : `${followers.length} diver${followers.length === 1 ? '' : 's'} follow${followers.length === 1 ? 's' : ''} you`}
      </Text>

      {!loading && followers.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Icon name="profile" size={28} color={colors.accent} />
          </View>
          <Text style={[typography.h3, { textAlign: 'center', marginTop: spacing.md }]}>
            No followers yet
          </Text>
          <Text style={styles.emptyText}>
            When other divers follow you, you'll see them here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {followers.map((f) => {
            const initials = f.name.split(' ').map((s) => s[0]).filter(Boolean).join('').slice(0, 2);
            const handle = f.handle ? `@${f.handle.replace(/^@/, '')}` : '';
            const meta = [handle, f.homeSpot].filter(Boolean).join(' · ');
            const followsBack = isFollowing(f.uid);
            return (
              <Card key={f.uid}>
                <View style={styles.row}>
                  <Avatar
                    initials={initials}
                    size={48}
                    imageSource={f.photoUrl ? { uri: f.photoUrl } : undefined}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h3}>{f.name || 'Diver'}</Text>
                    {!!meta && <Text style={styles.meta}>{meta}</Text>}
                  </View>
                  <Button
                    label={followsBack ? 'Following' : 'Follow back'}
                    size="sm"
                    variant={followsBack ? 'outline' : 'secondary'}
                    onPress={() => {
                      if (!user) return;
                      if (followsBack) {
                        unfollow(user.id, f.uid);
                      } else {
                        follow(
                          {
                            uid:      user.id,
                            name:     user.name,
                            handle:   user.handle,
                            photoUrl: user.photoUrl ?? null,
                            homeSpot: user.homeSpot ?? null,
                          },
                          {
                            uid:      f.uid,
                            name:     f.name,
                            handle:   f.handle,
                            photoUrl: f.photoUrl ?? null,
                            homeSpot: f.homeSpot ?? null,
                          },
                        );
                      }
                    }}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  emptyIconWrap: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
});
