import { TextStyle } from 'react-native';
import { colors } from './colors';

export const typography = {
  display: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1,
  } as TextStyle,
  h1: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  } as TextStyle,
  h2: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: colors.textPrimary,
  } as TextStyle,
  bodySm: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textSecondary,
  } as TextStyle,
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as TextStyle,
  metric: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  } as TextStyle,
  metricSm: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  } as TextStyle,
  tag: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as TextStyle,
};
