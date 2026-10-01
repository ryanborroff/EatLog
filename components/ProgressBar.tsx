import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../contexts/ThemeContext';

interface ProgressBarProps {
  /** 0–1; values past 1 fill the bar. */
  ratio: number;
  color: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export default function ProgressBar({ ratio, color, height = 6, style }: ProgressBarProps) {
  const styles = useThemedStyles(makeStyles);
  const percent = Math.max(0, Math.min(ratio, 1)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      backgroundColor: colors.progressTrack,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
    },
  });
