import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeightBucket, formatKg, formatKgChange } from '../services/weightInsights';
import { colors, spacing, radii } from '../constants/theme';

interface WeightChartPanelProps {
  buckets: WeightBucket[];
  /** Change over the period, from summarizeWeight; null with fewer than two weigh-ins. */
  change: number | null;
}

const WEIGHT_COLOR = '#5E8C8A';

// Minimum vertical span, so a flat week doesn't blow tiny scale noise up to full height.
const MIN_RANGE_KG = 2;

/**
 * Weight panel for the landscape intake chart: one dot per bar that had a weigh-in,
 * scaled to the period's own min/max (weight has no daily target to scale against).
 */
export default function WeightChartPanel({ buckets, change }: WeightChartPanelProps) {
  const weights = buckets.map((b) => b.weightKg).filter((w): w is number => w !== null);
  if (weights.length === 0) return null;

  const latest = weights[weights.length - 1];
  const low = Math.min(...weights);
  const high = Math.max(...weights);
  const padding = Math.max(0, MIN_RANGE_KG - (high - low)) / 2;
  const scaleMin = low - padding;
  const scaleRange = high + padding - scaleMin || 1;
  const labelEvery = buckets.length > 14 ? 5 : 1;

  return (
    <View
      style={styles.panel}
      accessible
      accessibilityLabel={`Weight: latest ${formatKg(latest)}${change !== null ? `, change ${formatKgChange(change)}` : ''}`}
    >
      <View style={styles.panelHeader}>
        <View style={[styles.swatch, { backgroundColor: WEIGHT_COLOR }]} />
        <Text style={styles.panelLabel}>Weight</Text>
      </View>
      <Text style={styles.panelValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatKg(latest)}
      </Text>
      <Text style={styles.panelTarget} numberOfLines={1}>
        {change !== null ? formatKgChange(change) : 'One weigh-in'}
      </Text>

      <View style={styles.plot}>
        {buckets.map((bucket, index) => (
          <View key={index} style={styles.dotSlot}>
            {bucket.weightKg !== null && (
              <View
                style={[
                  styles.dot,
                  // Keep dots inside the plot: 10%–90% of its height.
                  { bottom: `${10 + ((bucket.weightKg - scaleMin) / scaleRange) * 80}%` },
                ]}
              />
            )}
          </View>
        ))}
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
}

const DOT_SIZE = 7;

// Mirrors IntakeChart's panel styling so the weight panel sits in the same row.
const styles = StyleSheet.create({
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
    marginTop: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  dotSlot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginBottom: -DOT_SIZE / 2,
    backgroundColor: WEIGHT_COLOR,
  },
  axis: {
    height: 14,
    marginTop: 4,
  },
  axisLabel: {
    position: 'absolute',
    top: 0,
    fontSize: 10,
    color: colors.textMuted,
  },
});
