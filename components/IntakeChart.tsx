import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChartBucket, ChartMetric } from '../services/intakeChart';
import { colors, spacing, radii } from '../constants/theme';
import { formatAmount } from '../utils/formatNumber';
import BarPlot from './BarPlot';

interface IntakeChartProps {
  metrics: ChartMetric[];
  buckets: ChartBucket[];
  /** Extra panels appended to the row, e.g. the weight panel. */
  children?: React.ReactNode;
}

const formatValue = (metric: ChartMetric, value: number): string =>
  metric.unit === 'ml' ? `${Math.round(value)}ml` : `${formatAmount(value)}g`;

/**
 * Small-multiples bar chart: one panel per nutrient, side by side, each scaled to
 * its own target so grams and millilitres can sit next to each other.
 */
export default function IntakeChart({ metrics, buckets, children }: IntakeChartProps) {
  const loggedBuckets = buckets.filter((bucket) => bucket.hasData);

  return (
    <View style={styles.row}>
      {metrics.map((metric) => {
        const average =
          loggedBuckets.length > 0
            ? loggedBuckets.reduce((sum, bucket) => sum + bucket.values[metric.key], 0) / loggedBuckets.length
            : 0;
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

            <BarPlot
              values={buckets.map((bucket) => bucket.values[metric.key])}
              labels={buckets.map((bucket) => bucket.label)}
              target={metric.target}
              color={metric.color}
              style={styles.plot}
            />
          </View>
        );
      })}
      {children}
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
    marginTop: spacing.xs,
  },
});
