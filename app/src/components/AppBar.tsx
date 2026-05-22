import React from 'react';
import { View, Text, Pressable, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Logo } from './Logo';
import { Avatar } from './Avatar';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';

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
  // The auth snapshot's photoUrl is captured once at sign-in, so when
  // a user updates their photo from the Profile screen the menu would
  // stay stale until next sign-in. Subscribe to the live users/{uid}
  // doc here so every AppBar (Home, Saved, Explore) reads the same
  // photoUrl the Profile page does — single source of truth.
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const livePhotoUri = profile?.photoUrl ?? user?.photoUrl;
  const effectivePhotoUri = photoUri ?? livePhotoUri;

  const hookPhoto = useProfilePhoto();
  const photo = effectivePhotoUri ? undefined : (photoSource ?? hookPhoto);
  return (
    <View style={styles.row}>
      <Logo size={26} showWordmark />
      <Pressable style={styles.right} onPress={onAvatarPress}>
        <View>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.loc}>{userLocation}</Text>
        </View>
        <Avatar initials={initials} size={42} ring imageUri={effectivePhotoUri} imageSource={photo} />
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
  name: {
    ...typography.h3,
    fontSize: 14,
    letterSpacing: 0.4,
    textAlign: 'right',
  },
  loc: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.1,
    marginTop: 1,
    textAlign: 'right',
  },
});
