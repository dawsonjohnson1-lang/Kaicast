import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';

type Props = {
  initials?: string;
  size?: number;
  ring?: boolean;
  style?: ViewStyle;
  imageUri?: string;
  imageSource?: ImageSourcePropType;
  vibrant?: boolean;
};

const vibrantGradients: [string, string][] = [
  ['#1ab8ff', '#0a8fd8'],
  ['#7c3aed', '#22d3ee'],
  ['#16c47f', '#0a8fd8'],
  ['#22d3ee', '#0a8fd8'],
  ['#7c3aed', '#1ab8ff'],
];

const mutedGradient: [string, string] = ['#1c2738', '#0f1623'];

export function Avatar({
  initials = '?',
  size = 44,
  ring,
  style,
  imageUri,
  imageSource,
  vibrant = false,
}: Props) {
  const wrapper: ViewStyle = {
    width: size + (ring ? 4 : 0),
    height: size + (ring ? 4 : 0),
    borderRadius: 999,
    padding: ring ? 2 : 0,
    backgroundColor: ring ? colors.accent : 'transparent',
    overflow: 'hidden',
  };

  const inner = { width: size, height: size, borderRadius: 999 };
  const photo = imageUri ? { uri: imageUri } : imageSource;

  if (photo) {
    return (
      <View style={[wrapper, style]}>
        <Image source={photo} style={inner} resizeMode="cover" />
      </View>
    );
  }

  const g = vibrant
    ? vibrantGradients[initials.charCodeAt(0) % vibrantGradients.length]
    : mutedGradient;

  return (
    <View style={[wrapper, style]}>
      <LinearGradient
        colors={g}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatar, inner]}
      >
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials.toUpperCase()}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
});
