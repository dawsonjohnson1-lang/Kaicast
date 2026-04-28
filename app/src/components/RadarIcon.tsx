import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type Variant = 'dashboard' | 'saved' | 'explore' | 'profile';

type Props = {
  variant: Variant;
  size?: number;
  color?: string;
};

/**
 * Sonar/pin tab icon. Each tab gets the same outer shape:
 *   - small antenna circle at the apex
 *   - a thin "ping" arc beneath it
 *   - a downward teardrop dome (narrow at top, full round at bottom)
 *   - a small filled blip inside the dome
 *
 * Per-tab variation is the inner blip glyph only.
 */
export function RadarIcon({ variant, size = 28, color = '#ffffff' }: Props) {
  const sw = 1.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* antenna apex */}
      <Circle cx="14" cy="3" r="1.4" fill={color} />
      {/* ping arc */}
      <Path d="M 7 8.4 Q 14 4.6 21 8.4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* teardrop dome */}
      <Path
        d="M 14 8.6 C 18.4 8.6 21.2 12 21.2 16.2 C 21.2 20.4 18 24 14 24 C 10 24 6.8 20.4 6.8 16.2 C 6.8 12 9.6 8.6 14 8.6 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {variant === 'dashboard' && <Circle cx="14" cy="16.6" r="2.2" fill={color} />}

      {variant === 'saved' && (
        <Path
          d="M14 20.4 c -2.4 -1.7 -3.8 -2.9 -3.8 -4.4 a 1.7 1.7 0 0 1 3.8 -1 a 1.7 1.7 0 0 1 3.8 1 c 0 1.5 -1.4 2.7 -3.8 4.4 z"
          fill={color}
        />
      )}

      {variant === 'explore' && (
        <>
          <Path
            d="M14 12.6 c 2 0 3.4 1.5 3.4 3.4 c 0 2.4 -3.4 4.6 -3.4 4.6 c 0 0 -3.4 -2.2 -3.4 -4.6 c 0 -1.9 1.4 -3.4 3.4 -3.4 z"
            stroke={color}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Circle cx="14" cy="16" r="1.2" fill={color} />
        </>
      )}

      {variant === 'profile' && (
        <>
          <Circle cx="14" cy="15.6" r="1.8" fill={color} />
          <Path
            d="M10.6 21.2 c 0 -1.9 1.5 -3.4 3.4 -3.4 c 1.9 0 3.4 1.5 3.4 3.4"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}
