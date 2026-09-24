import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChartBucket, ChartMetric } from '../services/intakeChart';
import { colors, spacing, radii } from '../constants/theme';
import { formatAmount } from '../utils/formatNumber';

interface IntakeChartProps {
  metrics: ChartMetric[];
  buckets: ChartBucket[];
}

// Headroom above the target line so a day that hits it exactly doesn't touch the top.
const TARGET_HEADROOM = 1.25;

const formatValue = (metric: ChartMetric, value: number): string =>
  metric.unit === 'ml' ? `${Math.round(value)}ml` : `${formatAmount(value)}g`;

/**
 * Small-multiples bar chart: one panel per nutrient, side by side, each scaled to
 * its own target so grams and millilitres can sit next to each other.
 */
export default function IntakeChart({ metrics, buckets }: IntakeChartProps) {
  const loggedBuckets = buckets.filter((bucket) => bucket.hasData);
  // Thin out axis labels once bars get narrower than the text (Month, Year).
  const labelEvery = buckets.length > 14 ? 5 : buckets.length > 7 ? 3 : 1;

  return (
    <View style={styles.row}>
      {metrics.map((metric) => {
        const average =
          loggedBuckets.length > 0
            ? loggedBuckets.reduce((sum, bucket) => sum + bucket.values[metric.key], 0) / loggedBuckets.length
            : 0;
        const peak = Math.max(...buckets.map((bucket) => bucket.values[metric.key]));
        const scaleMax = Math.max(metric.target * TARGET_HEADROOM, peak, 1);
        const targetRatio = metric.target / scaleMax;
        const percentOfTarget = metric.target > 0 ? Math.round((average / metric.target) * 100) : 0;

        return (
          <View
            key={metric.key}
            style={styles.panel}
            accessible
            accessibilityLabel={`${metric.label}: average ${formatValue(metric, average)} a day, ${percentOfTarget}% of the ${formatValue(metric, metric.target)} target`}
          >
            <View style={styles.panelHeader}>
              <View style={[styles.swatch, { backgroundColor: metric.color }]} />
              <Text style={styles.panelLabel}>{metric.label}</Text>
            </View>
            <Text style={styles.panelValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatValue(metric, average)}
            </Text>
            <Text style={styles.panelTarget} numberOfLines={1}>
              {percentOfTarget}% of {formatValue(metric, metric.target)}
            </Text>

            <View style={styles.plot}>
              <View style={[styles.targetLine, { bottom: `${targetRatio * 100}%` }]} />
              {buckets.map((bucket, index) => {
                const ratio = bucket.values[metric.key] / scaleMax;
                return (
                  <View key={index} style={styles.barSlot}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${ratio * 100}%`,
                          backgroundColor: metric.color,
                          opacity: bucket.values[metric.key] >= metric.target ? 1 : 0.6,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            <View style={styles.axis}>
              {buckets.map((bucket, index) =>
                index % labelEvery === 0 && bucket.label ? (
                  <Text
                    key={index}
                    style={[styles.axisLabel, { left: `${(index / buckets.length) * 100}%` }]}
                    numberOfLines={1}
                  >
                    {bucket.label}
                  </Text>
                ) : null
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  panel: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  panelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  panelValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  panelTarget: {
    fontSize: 12,
    color: colors.textMuted,
  },
  plot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
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
