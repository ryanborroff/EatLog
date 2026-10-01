import React, { useState } from 'react';
import { View, Text, StyleSheet, PixelRatio } from 'react-native';
import { ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../contexts/ThemeContext';
import { layoutAxisLabels } from '../services/axisLabels';

interface AxisLabelsProps {
  /** One per bar or dot slot; blank labels are skipped. */
  labels: string[];
}

const FONT_SIZE = 10;

/**
 * X-axis labels under a row of equal-width slots. Measures its own width so labels
 * are centred under their slot and thinned to whatever fits the panel.
 */
export default function AxisLabels({ labels }: AxisLabelsProps) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const placements = layoutAxisLabels(labels, width, FONT_SIZE * PixelRatio.getFontScale());

  return (
    <View style={styles.axis} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {placements.map(({ index, label, left, width: labelWidth }) => (
        <Text key={index} style={[styles.label, { left, width: labelWidth }]} numberOfLines={1}>
          {label}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    axis: {
      height: 14,
      marginTop: 4,
    },
    // Absolutely positioned so labels can spill past slots narrower than the text.
    label: {
      position: 'absolute',
      top: 0,
      textAlign: 'center',
      fontSize: FONT_SIZE,
      color: colors.textMuted,
    },
  });
