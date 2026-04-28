import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Polygon, Rect } from 'react-native-svg';
import { colors } from '@/theme';

export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'arrow-right'
  | 'arrow-up'
  | 'plus'
  | 'heart'
  | 'heart-filled'
  | 'comment'
  | 'home'
  | 'bookmark'
  | 'compass'
  | 'profile'
  | 'search'
  | 'send'
  | 'globe'
  | 'star'
  | 'star-filled'
  | 'wave'
  | 'wind'
  | 'tide'
  | 'thermometer'
  | 'eye'
  | 'moon'
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'compass-arrow'
  | 'check'
  | 'x'
  | 'menu'
  | 'edit'
  | 'trash'
  | 'share'
  | 'lock'
  | 'mail'
  | 'phone'
  | 'shield'
  | 'bell'
  | 'logout'
  | 'pin'
  | 'fish'
  | 'rising'
  | 'falling'
  | 'apple';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color = colors.textPrimary, strokeWidth = 2 }: Props) {
  const sw = strokeWidth;
  const c = color;
  switch (name) {
    case 'chevron-left':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="15 6 9 12 15 18" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'chevron-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="9 6 15 12 9 18" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="6 9 12 15 18 9" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'arrow-right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1="5" y1="12" x2="19" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Polyline points="13 6 19 12 13 18" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'arrow-up':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1="12" y1="19" x2="12" y2="5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Polyline points="6 11 12 5 18 11" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1="12" y1="5" x2="12" y2="19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="5" y1="12" x2="19" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'heart-filled':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" fill={c} />
        </Svg>
      );
    case 'comment':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'bookmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'compass':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
          <Polygon points="16 8 13 14 8 16 11 10 16 8" stroke={c} strokeWidth={sw} strokeLinejoin="round" fill={c} fillOpacity={0.18} />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="8" r="4" stroke={c} strokeWidth={sw} />
          <Path d="M4 21a8 8 0 0 1 16 0" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="11" cy="11" r="7" stroke={c} strokeWidth={sw} />
          <Line x1="20" y1="20" x2="16.5" y2="16.5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M22 2 11 13" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 2 15 22 11 13 2 9 22 2z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
          <Line x1="3" y1="12" x2="21" y2="12" stroke={c} strokeWidth={sw} />
          <Path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke={c} strokeWidth={sw} />
        </Svg>
      );
    case 'star':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'star-filled':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" fill={c} />
        </Svg>
      );
    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M16.36 12.42c-.02-2.55 2.08-3.78 2.18-3.84-1.19-1.74-3.04-1.98-3.69-2-1.57-.16-3.06.92-3.86.92-.81 0-2.03-.9-3.34-.88-1.72.03-3.31 1-4.19 2.54-1.79 3.1-.46 7.69 1.28 10.21.85 1.23 1.86 2.61 3.18 2.56 1.28-.05 1.76-.83 3.31-.83 1.55 0 1.98.83 3.34.8 1.38-.02 2.25-1.25 3.09-2.49.97-1.43 1.37-2.81 1.39-2.88-.03-.01-2.67-1.03-2.69-4.11zM13.84 4.96c.71-.85 1.18-2.04 1.05-3.22-1.02.04-2.25.68-2.98 1.53-.65.75-1.22 1.95-1.07 3.12 1.13.09 2.29-.58 3-1.43z"
            fill={c}
          />
        </Svg>
      );
    case 'wave':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M2 12c2 0 3-3 5-3s3 6 5 6 3-6 5-6 3 3 5 3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M2 17c2 0 3-2 5-2s3 4 5 4 3-4 5-4 3 2 5 2" stroke={c} strokeWidth={sw} strokeLinecap="round" opacity={0.5} />
        </Svg>
      );
    case 'wind':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9h12a3 3 0 1 0-3-3M3 14h17a3 3 0 1 1-3 3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'tide':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M2 16c3 0 4-6 7-6s4 8 6 8 4-4 7-4" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="2" y1="20" x2="22" y2="20" stroke={c} strokeWidth={sw} strokeLinecap="round" opacity={0.4} />
        </Svg>
      );
    case 'thermometer':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} />
        </Svg>
      );
    case 'moon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="4" stroke={c} strokeWidth={sw} />
          <Line x1="12" y1="2" x2="12" y2="5" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="12" y1="19" x2="12" y2="22" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="2" y1="12" x2="5" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="19" y1="12" x2="22" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'cloud':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M18 18a4 4 0 0 0 0-8 6 6 0 0 0-11.7-1.4A4.5 4.5 0 0 0 6.5 18z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'rain':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M18 14a4 4 0 0 0 0-8 6 6 0 0 0-11.7-1.4A4.5 4.5 0 0 0 6.5 14" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Line x1="8" y1="18" x2="8" y2="21" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="12" y1="18" x2="12" y2="22" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="16" y1="18" x2="16" y2="21" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'compass-arrow':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
          <Polygon points="12 5 14 12 12 11 10 12 12 5" fill={c} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="4 12 10 18 20 6" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'x':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1="6" y1="6" x2="18" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="18" y1="6" x2="6" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'menu':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="5" cy="12" r="1.6" fill={c} />
          <Circle cx="12" cy="12" r="1.6" fill={c} />
          <Circle cx="19" cy="12" r="1.6" fill={c} />
        </Svg>
      );
    case 'edit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 20h9" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="3 6 5 6 21 6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'share':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3v12M5 10l7-7 7 7" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="11" width="16" height="10" rx="2" stroke={c} strokeWidth={sw} />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={c} strokeWidth={sw} />
        </Svg>
      );
    case 'mail':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="5" width="18" height="14" rx="2" stroke={c} strokeWidth={sw} />
          <Polyline points="3 7 12 13 21 7" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 2 4 5v7c0 5 3.5 8 8 10 4.5-2 8-5 8-10V5l-8-3z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M10 21a2 2 0 0 0 4 0" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'logout':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'pin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx="12" cy="9" r="3" stroke={c} strokeWidth={sw} />
        </Svg>
      );
    case 'fish':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 12c4-6 12-6 16-2l3-2-1 5 1 5-3-2c-4 4-12 4-16-2z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx="16" cy="11" r="0.8" fill={c} />
        </Svg>
      );
    case 'rising':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="4 17 10 11 14 15 20 7" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points="14 7 20 7 20 13" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'falling':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="4 7 10 13 14 9 20 17" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points="14 17 20 17 20 11" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}
