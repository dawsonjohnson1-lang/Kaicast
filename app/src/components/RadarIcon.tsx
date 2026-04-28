import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type Variant = 'dashboard' | 'saved' | 'explore' | 'profile';

type Props = {
  variant: Variant;
  size?: number;
  color?: string;
};

export function RadarIcon({ variant, size = 28, color = '#ffffff' }: Props) {
  const sw = 1.4;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="2.6" r="1.2" fill={color} />
      <Path
        d="M 8.5 7.6 Q 14 4.6 19.5 7.6"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Circle cx="14" cy="16" r="8.4" stroke={color} strokeWidth={sw} />
      <Circle cx="14" cy="16" r="5.4" stroke={color} strokeWidth={sw} opacity={0.55} />

      {variant === 'dashboard' && (
        <>
          <Rect x="11.4" y="14.6" width="1.6" height="3.6" rx="0.8" fill={color} />
          <Rect x="13.6" y="12.6" width="1.6" height="5.6" rx="0.8" fill={color} />
          <Rect x="15.8" y="13.6" width="1.6" height="4.6" rx="0.8" fill={color} />
        </>
      )}

      {variant === 'saved' && (
        <Path
          d="M14 19.6 c -2.4 -1.5 -3.6 -2.7 -3.6 -4.1 a 1.6 1.6 0 0 1 3.6 -0.95 a 1.6 1.6 0 0 1 3.6 0.95 c 0 1.4 -1.2 2.6 -3.6 4.1 z"
          fill={color}
        />
      )}

      {variant === 'explore' && (
        <Path
          d="M14 12.4 c 2 0 3.4 1.5 3.4 3.4 c 0 2.3 -3.4 4.4 -3.4 4.4 c 0 0 -3.4 -2.1 -3.4 -4.4 c 0 -1.9 1.4 -3.4 3.4 -3.4 z M14 14 a 1.7 1.7 0 1 0 0 3.4 a 1.7 1.7 0 0 0 0 -3.4 z"
          fill={color}
        />
      )}

      {variant === 'profile' && (
        <>
          <Circle cx="14" cy="14.4" r="1.9" fill={color} />
          <Path
            d="M10.4 19.6 c 0 -2 1.6 -3.6 3.6 -3.6 c 2 0 3.6 1.6 3.6 3.6 z"
            fill={color}
          />
        </>
      )}
    </Svg>
  );
}
