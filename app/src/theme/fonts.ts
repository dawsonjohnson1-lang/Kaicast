import type { TextStyle } from 'react-native';

type WeightKey = '400' | '500' | '600' | '700' | '800' | '900';

const FAMILY_BY_WEIGHT: Record<WeightKey, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

/**
 * Map a React Native fontWeight to the matching Inter font family.
 * Falls back to Inter_400Regular for unknown / missing values.
 */
export function interFamilyForWeight(weight: TextStyle['fontWeight'] | undefined): string {
  if (!weight) return FAMILY_BY_WEIGHT['400'];
  if (weight === 'bold') return FAMILY_BY_WEIGHT['700'];
  if (weight === 'normal') return FAMILY_BY_WEIGHT['400'];
  const key = String(weight) as WeightKey;
  return FAMILY_BY_WEIGHT[key] ?? FAMILY_BY_WEIGHT['400'];
}

export const InterFamily = FAMILY_BY_WEIGHT;
