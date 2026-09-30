import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../constants/theme';
import { TargetKind } from '../services/intakeChart';

interface BarPlotProps {
  values: number[];
  /** One per bar; blank labels are skipped. Omit to hide the axis (sparklines). */
  labels?: string[];
  target: number;
  color: string;
  /**
   * 'min' dims bars that fall short of the target; 'max' draws bars that
   * overshoot it in the warning colour.
   */
  kind?: TargetKind;
  style?: StyleProp<ViewStyle>;
}

// Headroom above the target line so a day that hits it exactly doesn't touch the top.
const TARGET_HEADROOM = 1.25;

// Matches getTargetStatus's 'max' tolerance, so a bar turns amber exactly when
// the row it sits beside is flagged.
const OVER_TOLERANCE = 1.1;

/** Bars against a target line, scaled to the target. Drawn with plain Views so no chart library is needed. */
export default function BarPlot({ values, labels, target, color, kind = 'min', style }: BarPlotProps) {
  const peak = Math.max(...values, 0);
  const scaleMax = Math.max(target * TARGET_HEADROOM, peak, 1);
  const targetRatio = target / scaleMax;
  // Thin out axis labels once bars get narrower than the text (Month, Year).
  const labelEvery = values.length > 14 ? 5 : values.length > 7 ? 3 : 1;

  const barStyle = (value: number) => {
    if (kind === 'max') {
      return { backgroundColor: value > target * OVER_TOLERANCE ? colors.warning : color };
    }
    return { backgroundColor: color, opacity: value >= target ? 1 : 0.6 };
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.plot}>
        {target > 0 && <View style={[styles.targetLine, { bottom: `${targetRatio * 100}%` }]} />}
        {values.map((value, index) => (
          <View key={index} style={styles.barSlot}>
            <View style={[styles.bar, { height: `${(value / scaleMax) * 100}%` }, barStyle(value)]} />
          </View>
        ))}
      </View>

      {labels && (
        <View style={styles.axis}>
          {labels.map((label, index) =>
            index % labelEvery === 0 && label ? (
              <Text
                key={index}
                style={[styles.axisLabel, { left: `${(index / labels.length) * 100}%` }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            ) : null
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  plot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: colors.textMuted,
  },
  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 1,
  },
  bar: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  axis: {
    height: 14,
    marginTop: 4,
  },
  // Absolutely positioned so labels can spill past bars narrower than the text.
  axisLabel: {
    position: 'absolute',
    top: 0,
    fontSize: 10,
    color: colors.textMuted,
  },
});
