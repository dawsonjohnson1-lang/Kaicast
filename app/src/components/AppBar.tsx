import React from 'react';
import { View, Text, Pressable, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Logo } from './Logo';
import { Avatar } from './Avatar';

type Props = {
  userName?: string;
  userLocation?: string;
  initials?: string;
  photoUri?: string;
  photoSource?: ImageSourcePropType;
  onAvatarPress?: () => void;
};

export function AppBar({
  userName = 'Dawson',
  userLocation = 'OAHU, HAWAII',
  initials = 'D',
  photoUri,
  photoSource,
  onAvatarPress,
}: Props) {
  return (
    <View style={styles.row}>
      <Logo size={28} showWordmark color={colors.textPrimary} />
      <Pressable style={styles.right} onPress={onAvatarPress}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.loc}>{userLocation}</Text>
        </View>
        <Avatar initials={initials} size={42} ring imageUri={photoUri} imageSource={photoSource} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...typography.h3, fontSize: 16 },
  loc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
