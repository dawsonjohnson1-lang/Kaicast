import React from 'react';
import { View, ImageBackground, StyleSheet, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * SpotCover — placeholder for satellite imagery of a dive spot.
 *
 * TODO(spots-pipeline): When new spots are uploaded, the spot record will
 * carry a satellite-image URL (rendered server-side from the spot's lat/lon).
 * Pass it in via the `imageUri` prop and this will render that real imagery
 * with the same blur + dark gradient overlay used here.
 *
 * Until that pipeline lands, we render a deterministic dark-ocean gradient
 * keyed off the `seed` (spot.id) so each spot looks visually distinct.
 */

type Props = {
  seed?: string;
  imageUri?: string;
  imageSource?: ImageSourcePropType;
  children?: React.ReactNode;
  style?: any;
  rounded?: number;
};

const PALETTES: [string, string, string][] = [
  ['#0a3a4d', '#072a3b', '#04111e'],
  ['#0a4a3a', '#082f30', '#04141a'],
  ['#0c2a4d', '#091e3a', '#04111e'],
  ['#3a2a4d', '#241a36', '#1a0e26'],
  ['#0c4a5c', '#083a48', '#04161e'],
  ['#1a3a4a', '#0e2530', '#04111e'],
];

function pick(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length];
}

export function SpotCover({ seed, imageUri, imageSource, children, style, rounded }: Props) {
  const [a, b, c] = pick(seed);
  const radius = rounded ?? 0;

  if (imageUri || imageSource) {
    return (
      <ImageBackground
        source={imageSource ?? { uri: imageUri }}
        style={[{ overflow: 'hidden', borderRadius: radius }, style]}
        imageStyle={{ borderRadius: radius }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius }, style]}>
      <LinearGradient
        colors={[a, b, c]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}
