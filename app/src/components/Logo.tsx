import React from 'react';
import { Image, StyleSheet } from 'react-native';

const wordmark = require('@/assets/logo-wordmark.png');
const mark = require('@/assets/logo-mark.png');

type Props = {
  size?: number;
  showWordmark?: boolean;
};

export function Logo({ size = 28, showWordmark = true }: Props) {
  if (showWordmark) {
    return (
      <Image
        source={wordmark}
        style={[styles.wordmark, { height: size, width: size * 4.4 }]}
        resizeMode="contain"
      />
    );
  }
  return (
    <Image
      source={mark}
      style={{ height: size, width: size * 0.85 }}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  wordmark: { tintColor: '#ffffff' },
});
