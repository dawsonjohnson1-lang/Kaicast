import React from 'react';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';

type Variant = 'dashboard' | 'saved' | 'explore' | 'profile';

type Props = {
  variant: Variant;
  size?: number;
  color?: string;
};

/**
 * Concentric-ring radar icons used in the bottom tab bar — matches Menu.png.
 * The inner glyph differs per tab: dashboard = dot, saved = heart,
 * explore = location pin, profile = person.
 */
export function RadarIcon({ variant, size = 26, color = '#ffffff' }: Props) {
  const cx = 12;
  const cy = 11;

  return (
    <Svg width={size} height={size * 1.05} viewBox="0 0 24 25">
      <Path d="M3 17 a 9 9 0 0 1 18 0" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M6 17 a 6 6 0 0 1 12 0" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Circle cx={cx} cy={cy + 6} r={1.2} fill={color} />
      {variant === 'dashboard' && <Circle cx={cx} cy={cy} r={2.2} fill={color} />}
      {variant === 'saved' && (
        <Path
          d="M12 13 c 0 -1.4 1.6 -2.6 3 -1.4 c 1.4 1.2 -0.6 3.2 -3 4.8 c -2.4 -1.6 -4.4 -3.6 -3 -4.8 c 1.4 -1.2 3 0 3 1.4 z"
          fill={color}
        />
      )}
      {variant === 'explore' && (
        <Path
          d="M12 7 a 3 3 0 0 1 3 3 c 0 2.2 -3 4.6 -3 4.6 c 0 0 -3 -2.4 -3 -4.6 a 3 3 0 0 1 3 -3 z"
          fill={color}
        />
      )}
      {variant === 'profile' && (
        <>
          <Circle cx={cx} cy={cy - 1} r={1.7} fill={color} />
          <Path d="M9 14 a 3 3 0 0 1 6 0" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
