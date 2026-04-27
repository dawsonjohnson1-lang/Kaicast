import { Text, StyleSheet, TextStyle } from 'react-native';
import { interFamilyForWeight } from './fonts';

/**
 * Patches React Native's <Text> so every text node renders in Inter,
 * picking the right family based on its computed fontWeight. This avoids
 * having to touch every component to add `fontFamily` next to `fontWeight`.
 *
 * Idempotent: safe to import multiple times.
 */
const RNText = Text as unknown as {
  render?: (...args: unknown[]) => React.ReactNode;
  __interPatched?: boolean;
};

if (!RNText.__interPatched && typeof RNText.render === 'function') {
  const originalRender = RNText.render.bind(Text);
  RNText.render = function patchedRender(...args: unknown[]) {
    const props = args[0] as { style?: unknown };
    const flattened = (StyleSheet.flatten(props?.style as TextStyle | undefined) ?? {}) as TextStyle;
    const family = interFamilyForWeight(flattened.fontWeight);
    const next = { ...props, style: [{ fontFamily: family }, props?.style] };
    args[0] = next;
    return originalRender(...args);
  };
  RNText.__interPatched = true;
}
