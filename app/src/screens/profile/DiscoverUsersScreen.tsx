// Find other divers by handle and follow them.
//
// Type-ahead search backed by a Firestore prefix range query on
// `handle`. Each result has a Follow / Following toggle that uses
// the same useFollowing hook + api/follows.ts as the rest of the
// social graph, so optimistic state stays consistent with profile
// counts everywhere else.

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useFollowing } from '@/hooks/useFollowing';
import { useUserSearch } from '@/hooks/useUserSearch';
import type { UserSearchResult } from '@/api/searchUsers';
import type { RootNav } from '@/navigation/types';

export function DiscoverUsersScreen() {
  const nav = useNavigation<RootNav>();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const { results, loading } = useUserSearch(q);
  const { isFollowing, follow, unfollow } = useFollowing(user?.id);

  // Filter out the current user — searching for yourself is meaningless.
  const filtered = results.filter((r) => r.uid !== user?.id);

  return (
    <Screen>
      <Header title="Find Divers" onBack={() => nav.goBack()} transparent />

      <Input
        placeholder="Search by handle (e.g. mike_kahale)"
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />

      <View style={styles.subRow}>
        <Text style={styles.sub}>
          {q.trim().length < 2
            ? 'Type at least 2 characters'
            : loading
              ? 'Searching…'
              : filtered.length === 0
                ? `No divers match "${q}"`
                : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      {q.trim().length < 2 && (
        <View style={styles.hintCard}>
          <View style={styles.hintIconWrap}>
            <Icon name="search" size={26} color={colors.accent} />
          </View>
          <Text style={[typography.h3, { textAlign: 'center', marginTop: spacing.md }]}>
            Find your dive crew
          </Text>
          <Text style={styles.hintText}>
            Search by handle — usually the part before the @ in their email when they signed up.
          </Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <SearchRow
            row={item}
            following={isFollowing(item.uid)}
            onToggle={() => {
              if (!user) return;
              if (isFollowing(item.uid)) {
                unfollow(user.id, item.uid);
              } else {
                follow(
                  {
                    uid:      user.id,
                    name:     user.name,
                    handle:   user.handle,
                    photoUrl: user.photoUrl ?? null,
                    homeSpot: user.homeSpot ?? null,
                  },
                  item,
                );
              }
            }}
          />
        )}
      />
    </Screen>
  );
}

function SearchRow({
  row,
  following,
  onToggle,
}: {
  row: UserSearchResult;
  following: boolean;
  onToggle: () => void;
}) {
  const initials = row.name.split(' ').map((s) => s[0]).filter(Boolean).join('').slice(0, 2);
  const handle = row.handle ? `@${row.handle.replace(/^@/, '')}` : '';
  const meta = [handle, row.homeSpot].filter(Boolean).join(' · ');
  return (
    <Card>
      <View style={styles.row}>
        <Avatar
          initials={initials}
          size={44}
          imageSource={row.photoUrl ? { uri: row.photoUrl } : undefined}
        />
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{row.name || 'Diver'}</Text>
          {!!meta && <Text style={styles.meta}>{meta}</Text>}
        </View>
        <Button
          label={following ? 'Following' : 'Follow'}
          size="sm"
          variant={following ? 'outline' : 'secondary'}
          onPress={onToggle}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  subRow: { marginTop: spacing.md, marginBottom: spacing.lg },
  sub: { ...typography.bodySm, color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  hintCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  hintIconWrap: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  hintText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
});
