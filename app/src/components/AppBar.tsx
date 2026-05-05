import React from 'react';
import { View, Text, Pressable, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';

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
  const fallbackPhoto = useProfilePhoto();
  const photo = photoSource ?? fallbackPhoto;
  return (
    <View style={styles.row}>
      <Logo size={26} showWordmark />
      <Pressable style={styles.right} onPress={onAvatarPress}>
        <View style={styles.text}>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.loc}>{userLocation}</Text>
        </View>
        <Avatar initials={initials} size={42} ring imageUri={photoUri} imageSource={photo} />
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
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { alignItems: 'flex-end' },
  name: {
    ...typography.h3,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  loc: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.1,
    marginTop: 1,
  },
});
