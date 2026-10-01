import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// Black wordmark on light backgrounds, white on dark (per the logo pack's usage notes).
// wordmark-dark.png is wordmark.png with its colours inverted: the logo pack's
// eatlog-reversed-white PNG fills the voice-mark bars white, so its "o" is a blank disc.
const SOURCES = {
  light: require('../assets/wordmark.png'),
  dark: require('../assets/wordmark-dark.png'),
};

export default function Wordmark({ style }: { style?: StyleProp<ImageStyle> }) {
  const { colorScheme } = useTheme();
  return (
    <Image
      source={SOURCES[colorScheme]}
      style={style}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="EatLog"
    />
  );
}
