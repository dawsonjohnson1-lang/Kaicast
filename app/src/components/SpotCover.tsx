import React from 'react';
import { View, ImageBackground, StyleSheet, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { satelliteUrl } from '@/api/satellite';

/**
 * SpotCover — satellite imagery of a dive spot, single-sourced through
 * `@/api/satellite` so every cover, card and hero in the app shares the
 * same provider, zoom, and centering. Pass the spot's `lat` / `lon` and
 * the cover renders Google Maps Static (no labels, no watermark) with
 * the spot's coordinate dead-center.
 *
 * Falls back to:
 *   - `imageUri` / `imageSource` if a caller wants to override
 *   - a deterministic dark-ocean gradient keyed off `seed` when neither
 *     coords nor an image are provided (or no GOOGLE_MAPS_KEY is set)
 */

type Props = {
  seed?: string;
  /** Lat/lon of the spot. Preferred — drives the satellite tile. */
  lat?: number;
  lon?: number;
  /** Static-tile zoom level. 16 ≈ 600m across, 14 ≈ 2km across. */
  zoom?: number;
  /** Optional override URLs / require()s — bypass the satellite call. */
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

// Layout-only width for the satellite request — actual rendered size
// comes from the parent style. We pick a reasonable retina-ready size
// once and let resizeMode="cover" crop to whatever shape the parent is.
const TILE_W = 640;
const TILE_H = 640;

export function SpotCover({
  seed,
  lat,
  lon,
  zoom = 16,
  imageUri,
  imageSource,
  children,
  style,
  rounded,
}: Props) {
  const [a, b, c] = pick(seed);
  const radius = rounded ?? 0;

  // Prefer satellite tile when we have coordinates.
  const tileUrl =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? satelliteUrl(lat as number, lon as number, TILE_W, TILE_H, zoom)
      : null;

  const resolvedSource: ImageSourcePropType | undefined = tileUrl
    ? { uri: tileUrl }
    : imageSource ?? (imageUri ? { uri: imageUri } : undefined);

  if (resolvedSource) {
    return (
      <ImageBackground
        source={resolvedSource}
        style={[{ overflow: 'hidden', borderRadius: radius }, style]}
        imageStyle={{ borderRadius: radius, width: '100%', height: '100%' }}
        resizeMode="cover"
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
