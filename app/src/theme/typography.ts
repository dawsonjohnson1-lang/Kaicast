import { TextStyle } from 'react-native';
import { colors } from './colors';
import { InterFamily } from './fonts';

export const typography = {
  display: {
    fontFamily: InterFamily['800'],
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
  } as TextStyle,
  h1: {
    fontFamily: InterFamily['800'],
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  } as TextStyle,
  h2: {
    fontFamily: InterFamily['700'],
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontFamily: InterFamily['700'],
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  } as TextStyle,
  body: {
    fontFamily: InterFamily['400'],
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: colors.textPrimary,
  } as TextStyle,
  bodySm: {
    fontFamily: InterFamily['400'],
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textSecondary,
  } as TextStyle,
  caption: {
    fontFamily: InterFamily['600'],
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,
  metric: {
    fontFamily: InterFamily['800'],
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  } as TextStyle,
  metricSm: {
    fontFamily: InterFamily['800'],
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  } as TextStyle,
  tag: {
    fontFamily: InterFamily['700'],
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as TextStyle,
};
