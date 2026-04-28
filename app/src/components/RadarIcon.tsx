import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

type Variant = 'dashboard' | 'saved' | 'explore' | 'profile';

type Props = {
  variant: Variant;
  size?: number;
  color?: string;
};

/**
 * Sonar dish tab icon. All four tabs share the same outer frame
 * (antenna dot at the apex, two concentric ping arcs, downward
 * teardrop dome) and only the small inner glyph varies. This keeps
 * the bar visually unified, with the label doing the work of
 * differentiating tabs.
 */
export function RadarIcon({ variant, size = 28, color = '#ffffff' }: Props) {
  const sw = 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* antenna apex */}
      <Circle cx="14" cy="2.6" r="1.1" fill={color} />
      {/* outer ping arc */}
      <Path d="M 4.4 9.2 Q 14 1.4 23.6 9.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* inner ping arc */}
      <Path d="M 7.8 9.2 Q 14 4.4 20.2 9.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* dome / teardrop base, opening downward */}
      <Path
        d="M 14 8.4 C 18.8 8.8 21.6 12.2 21.6 16.4 C 21.6 21 18 24.8 14 24.8 C 10 24.8 6.4 21 6.4 16.4 C 6.4 12.2 9.2 8.8 14 8.4 Z"
        stroke={color}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {/* per-variant inner glyph */}
      {variant === 'dashboard' && <Circle cx="14" cy="17" r="2.2" fill={color} />}

      {variant === 'saved' && (
        <Path
          d="M14 20.6 c -2.4 -1.7 -3.8 -2.9 -3.8 -4.4 a 1.7 1.7 0 0 1 3.8 -1 a 1.7 1.7 0 0 1 3.8 1 c 0 1.5 -1.4 2.7 -3.8 4.4 z"
          fill={color}
        />
      )}

      {variant === 'explore' && (
        <Path
          d="M14 12.8 c 2 0 3.4 1.5 3.4 3.4 c 0 2.4 -3.4 4.8 -3.4 4.8 c 0 0 -3.4 -2.4 -3.4 -4.8 c 0 -1.9 1.4 -3.4 3.4 -3.4 z M14 14.6 a 1.6 1.6 0 1 0 0 3.2 a 1.6 1.6 0 0 0 0 -3.2 z"
          fill={color}
        />
      )}

      {variant === 'profile' && (
        <>
          <Circle cx="14" cy="15.6" r="1.8" fill={color} />
          <Path
            d="M10.8 21.4 c 0 -1.9 1.4 -3.3 3.2 -3.3 c 1.8 0 3.2 1.4 3.2 3.3"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}
