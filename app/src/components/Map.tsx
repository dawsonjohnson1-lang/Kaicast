import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Constants from 'expo-constants';

import { colors, spacing } from '@/theme';
import type { Spot } from '@/types';

import Mapbox, { MapView, Camera, PointAnnotation } from '@rnmapbox/maps';

const token = (Constants.expoConfig?.extra?.mapboxAccessToken ?? '') as string;
const hasValidToken = token.length > 30 && !token.includes('REPLACE_ME');
const useMapbox = Platform.OS !== 'web' && hasValidToken;

if (useMapbox) {
  try {
    Mapbox.setAccessToken(token);
  } catch {
    // Native module unavailable (e.g. running in Expo Go without a custom
    // dev client). The render-time fallback below catches this.
  }
}

type SpotMapProps = {
  spots: Spot[];
  onSpotPress?: (spot: Spot) => void;
};

export function SpotMap({ spots, onSpotPress }: SpotMapProps) {
  if (!useMapbox) return <FauxMap />;

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL="mapbox://styles/mapbox/dark-v11"
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera centerCoordinate={[-157.85, 20.9]} zoomLevel={6.2} animationMode="none" />
      {spots.map((spot) => (
        <PointAnnotation
          key={spot.id}
          id={spot.id}
          coordinate={[spot.lon, spot.lat]}
          onSelected={() => onSpotPress?.(spot)}
        >
          <View style={pinStyles.outer}>
            <View style={pinStyles.inner} />
          </View>
        </PointAnnotation>
      ))}
    </MapView>
  );
}

export function FauxMap() {
  return (
    <View style={mapStyles.wrap}>
      <Svg width="100%" height="100%" viewBox="0 0 400 380">
        {Array.from({ length: 8 }).map((_, i) => (
          <Path
            key={i}
            d={`M 0 ${30 + i * 45} L 400 ${30 + i * 45}`}
            stroke="#0e1a2c"
            strokeDasharray="2,4"
            strokeWidth={1}
          />
        ))}
        <Path d="M 80 230 q 10 -25 35 -20 q 25 5 30 20 q 10 25 -10 25 q -25 5 -55 -25 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Path d="M 175 245 q 15 -20 50 -10 q 35 5 30 25 q -10 20 -50 15 q -40 -5 -30 -30 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Path d="M 235 265 q 25 -10 65 -5 q 40 5 50 25 q 5 25 -45 30 q -50 0 -75 -25 q -10 -15 5 -25 z" fill="#04101c" stroke="#1a2333" strokeWidth={1.5} />
        <Circle cx="195" cy="245" r="14" fill={colors.accent} fillOpacity={0.18} />
        <Circle cx="195" cy="245" r="8" fill={colors.accent} />
        <Circle cx="195" cy="245" r="4" fill="#fff" />
      </Svg>
      <Text style={mapStyles.label1}>Tropic of Cancer</Text>
      <Text style={mapStyles.label2}>HAWAIIAN TROUGH</Text>
      <Text style={mapStyles.island1}>Ni'ihau</Text>
      <Text style={mapStyles.island2}>O'ahu</Text>
      <Text style={mapStyles.island3}>Moloka'i</Text>
      <Text style={mapStyles.island4}>Lana'i</Text>
      <Text style={mapStyles.island5}>Maui</Text>
      <Text style={mapStyles.maps}>Maps · Legal</Text>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  outer: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  inner: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
});

const mapStyles = StyleSheet.create({
  wrap: { flex: 1 },
  label1: { position: 'absolute', top: 90, left: 60, color: colors.textDim, fontSize: 11, letterSpacing: 1 },
  label2: { position: 'absolute', top: 150, left: 110, color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  island1: { position: 'absolute', top: 230, left: 30, color: colors.textSecondary, fontSize: 10 },
  island2: { position: 'absolute', top: 268, left: 175, color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  island3: { position: 'absolute', top: 248, left: 270, color: colors.textSecondary, fontSize: 10 },
  island4: { position: 'absolute', top: 290, left: 270, color: colors.textSecondary, fontSize: 10 },
  island5: { position: 'absolute', top: 280, left: 330, color: colors.textSecondary, fontSize: 10 },
  maps: { position: 'absolute', bottom: 40, left: spacing.lg, color: colors.textDim, fontSize: 10 },
});
