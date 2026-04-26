import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type Variant = 'dashboard' | 'saved' | 'explore' | 'profile';

type Props = {
  variant: Variant;
  size?: number;
  color?: string;
};

/**
 * Sonar tab icon — matches Menu.png exactly:
 * teardrop/dome base with two concentric "ping" arcs above it,
 * and a per-tab glyph in the center of the dome.
 */
export function RadarIcon({ variant, size = 28, color = '#ffffff' }: Props) {
  const sw = 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* outer ping arc */}
      <Path d="M 4.5 9 Q 14 0 23.5 9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* inner ping arc */}
      <Path d="M 7.5 9 Q 14 3 20.5 9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* dome / teardrop base */}
      <Path
        d="M 14 8.2 C 18.8 8.6 21.5 12.2 21.5 16.4 C 21.5 21 18 24.6 14 24.6 C 10 24.6 6.5 21 6.5 16.4 C 6.5 12.2 9.2 8.6 14 8.2 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {/* inner glyph */}
      {variant === 'dashboard' && <Circle cx="14" cy="17" r="2.4" stroke={color} strokeWidth={sw} />}

      {variant === 'saved' && (
        <Path
          d="M14 20.5 c -2.4 -1.7 -3.8 -2.9 -3.8 -4.4 a 1.7 1.7 0 0 1 3.8 -1 a 1.7 1.7 0 0 1 3.8 1 c 0 1.5 -1.4 2.7 -3.8 4.4 z"
          fill={color}
        />
      )}

      {variant === 'explore' && (
        <Path
          d="M14 12.5 c 2 0 3.4 1.5 3.4 3.4 c 0 2.4 -3.4 4.8 -3.4 4.8 c 0 0 -3.4 -2.4 -3.4 -4.8 c 0 -1.9 1.4 -3.4 3.4 -3.4 z"
          stroke={color}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      )}

      {variant === 'profile' && (
        <>
          <Circle cx="14" cy="15.5" r="1.8" stroke={color} strokeWidth={sw} />
          <Path d="M10.8 21 c 0 -1.8 1.4 -3.2 3.2 -3.2 c 1.8 0 3.2 1.4 3.2 3.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
