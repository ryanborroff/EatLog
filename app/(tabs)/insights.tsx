import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { DayEntry, DailyGoals, WeightEntry } from '../../types';
import { getHistory, getUserGoals, getWeightEntries, logWeight } from '../../services/storageService';
import { track } from '../../services/analytics';
import { useTheme } from '../../contexts/ThemeContext';
import { colors, spacing, radii } from '../../constants/theme';
import { generateObservations } from '../../utils/insightsObservations';
import { formatAmount, formatCalories } from '../../utils/formatNumber';
import { useIntakeChartMode } from '../../utils/useIntakeChartMode';
import {
  buildChartBuckets,
  getCalorieMetric,
  getChartMetrics,
  getNutrientMetrics,
  getTargetStatus,
  ChartMetric,
  ChartMetricKey,
  ChartPeriod,
  TargetStatus,
} from '../../services/intakeChart';
import IntakeChart from '../../components/IntakeChart';
import BarPlot from '../../components/BarPlot';
import WeightChartPanel from '../../components/WeightChartPanel';
import {
  buildWeightBuckets,
  formatKg,
  formatKgChange,
  generateWeightObservation,
  summarizeWeight,
} from '../../services/weightInsights';

// Sanity bounds for a typed weigh-in, in kg.
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

type Period = ChartPeriod;

const formatMetricValue = (metric: ChartMetric, value: number): string => {
  if (metric.unit === 'kcal') return `${formatCalories(value)} kcal`;
  if (metric.unit === 'ml') return `${Math.round(value)}ml`;
  return `${formatAmount(value)}${metric.unit}`;
};

const STATUS_LABEL: Record<TargetStatus, string> = {
  onTrack: '',
  below: 'Below target',
  above: 'Above target',
};

// Shown when a nutrient row is tapped. Keys without a user goal fall back to general guidelines.
const nutrientInfo = (key: ChartMetricKey, goals: DailyGoals): string => {
  const own = (target: number | undefined, unit: string) =>
    target ? `Your target is ${target}${unit}/day, set in Settings.` : null;
  switch (key) {
    case 'protein':
      return own(goals.protein, 'g')!;
    case 'carbohydrate':
      return own(goals.carbohydrate, 'g') ?? 'About 260g/day (45-65% of calories) is a common general guideline. Not medical advice.';
    case 'fat':
      return own(goals.fat, 'g') ?? 'About 70g/day (20-35% of calories) is a common general guideline. Not medical advice.';
    case 'fibre':
      return own(goals.fibre, 'g') ?? '25-30g/day is a common general guideline. Not medical advice.';
    case 'water':
      return 'About 2,000-2,500ml/day is a common general guideline. Not medical advice.';
    case 'sodium':
      return 'Under 2,300mg/day is a common general guideline. Not medical advice.';
    case 'sugar':
      return 'Under 50g/day (ideally under 25g) is a common general guideline. Not medical advice.';
    default:
      return `Your target is ${goals.calories} kcal/day, set in Settings.`;
  }
};

const PERIOD_OPTIONS: { id: Period; label: string; days: number; sectionTitle: string; observationLabel: string }[] = [
  { id: 'day', label: 'Day', days: 1, sectionTitle: 'Today', observationLabel: 'today' },
  { id: 'week', label: 'Week', days: 7, sectionTitle: 'This week', observationLabel: 'this week' },
  { id: 'month', label: 'Month', days: 30, sectionTitle: 'This month', observationLabel: 'this month' },
  { id: '6months', label: '6 Months', days: 182, sectionTitle: 'Last 6 months', observationLabel: 'in the last 6 months' },
  { id: 'year', label: 'Year', days: 365, sectionTitle: 'Last year', observationLabel: 'in the last year' },
];

export default function InsightsScreen() {
  const { accentColor } = useTheme();
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const showIntakeChart = useIntakeChartMode();

  useFocusEffect(
    useCallback(() => {
      loadInsights();
      track('weekly_summary_viewed');
    }, [])
  );

  // Insights is the one screen that may rotate: turning the phone sideways swaps
  // in the intake chart. Re-lock to portrait on the way out.
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.unlockAsync().catch(() => {});
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, [])
  );

  const loadInsights = async () => {
    try {
      const [storedHistory, userGoals, storedWeights] = await Promise.all([
        getHistory(),
        getUserGoals(),
        // Weight is an extra: a failure here shouldn't take down the rest of Insights.
        getWeightEntries().catch((error) => {
          console.warn('Error loading weight entries:', error);
          return [] as WeightEntry[];
        }),
      ]);

      setHistory(storedHistory);
      setGoals(userGoals);
      setWeightEntries(storedWeights);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const openWeightModal = () => {
    const latest = weightEntries[weightEntries.length - 1];
    setWeightInput(latest ? String(latest.weightKg) : '');
    setWeightModalVisible(true);
  };

  const handleSaveWeight = async () => {
    const parsed = parseFloat(weightInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < MIN_WEIGHT_KG || parsed > MAX_WEIGHT_KG) {
      Alert.alert('Invalid weight', 'Enter your weight in kg, e.g. 72.5.');
      return;
    }

    const weightKg = Math.round(parsed * 10) / 10;
    const today = new Date().toISOString().split('T')[0];
    setSavingWeight(true);
    try {
      await logWeight(today, weightKg);
      setWeightEntries((entries) => [
        ...entries.filter((entry) => entry.date !== today),
        { date: today, weightKg },
      ]);
      setWeightModalVisible(false);
      track('weight_logged');
    } catch (error) {
      console.error('Error logging weight:', error);
      Alert.alert('Error', 'Failed to save your weight.');
    } finally {
      setSavingWeight(false);
    }
  };

  if (loading || !goals) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activePeriod = PERIOD_OPTIONS.find((option) => option.id === period)!;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - activePeriod.days);
  const cutoffDateString = cutoff.toISOString().split('T')[0];

  const weightSummary = summarizeWeight(weightEntries, cutoffDateString);

  const renderPeriodControl = (compact = false) => (
    <View style={[styles.segmentedControl, compact && styles.segmentedControlCompact]}>
      {PERIOD_OPTIONS.map((option) => {
        const isActive = option.id === period;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.segment, compact && styles.segmentCompact, isActive && { backgroundColor: accentColor }]}
            onPress={() => setPeriod(option.id)}
            accessibilityRole="button"
            accessibilityLabel={`${option.label} view`}
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[styles.segmentText, isActive && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (showIntakeChart) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.chartScreen}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleBlock}>
              <Text style={styles.chartTitle}>{activePeriod.sectionTitle}</Text>
              <Text style={styles.chartSubtitle}>Average daily intake · line shows target</Text>
            </View>
            {renderPeriodControl(true)}
          </View>
          <IntakeChart metrics={getChartMetrics(goals)} buckets={buildChartBuckets(history, period)}>
            <WeightChartPanel buckets={buildWeightBuckets(weightEntries, period)} change={weightSummary.change} />
          </IntakeChart>
        </View>
      </SafeAreaView>
    );
  }

  const periodHistory = history.filter((entry) => entry.date >= cutoffDateString);

  // Calculate period averages
  const average = (selector: (entry: DayEntry) => number): number =>
    periodHistory.length > 0
      ? periodHistory.reduce((sum, entry) => sum + selector(entry), 0) / periodHistory.length
      : 0;

  const buckets = buildChartBuckets(history, period);
  const hasData = periodHistory.length > 0;
  // A single-day period is one bar, so show a progress bar instead of a chart.
  const showTrend = period !== 'day';

  const calorieMetric = getCalorieMetric(goals);
  const avgCalories = average((entry) => entry.totals.calories);
  const calorieStatus = getTargetStatus(calorieMetric, avgCalories);
  const caloriePercent = goals.calories > 0 ? Math.round((avgCalories / goals.calories) * 100) : 0;

  const nutrientRows = getNutrientMetrics(goals).map((metric) => {
    const value = average((entry) => entry.totals[metric.key]);
    return {
      metric,
      value,
      status: periodHistory.length > 0 ? getTargetStatus(metric, value) : ('onTrack' as TargetStatus),
    };
  });

  // Calculate days within targets
  const daysWithinCalorieTarget = periodHistory.filter(
    (entry) => entry.totals.calories <= goals.calories
  ).length;
  const daysHittingProteinTarget = periodHistory.filter(
    (entry) => entry.totals.protein >= goals.protein
  ).length;

  const calorieProgressRatio = periodHistory.length > 0 ? daysWithinCalorieTarget / periodHistory.length : 0;
  const proteinProgressRatio = periodHistory.length > 0 ? daysHittingProteinTarget / periodHistory.length : 0;

  const weightObservation = generateWeightObservation(
    average((entry) => entry.totals.calories),
    periodHistory.length,
    weightSummary.change,
    activePeriod.observationLabel
  );
  const observations = [
    ...generateObservations(periodHistory, activePeriod.observationLabel),
    ...(weightObservation ? [weightObservation] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
        </View>

        {renderPeriodControl()}

        {!(Platform.OS === 'ios' && Platform.isPad) && (
          <View style={styles.rotateHint}>
            <Ionicons name="phone-landscape-outline" size={16} color={colors.textMuted} />
            <Text style={styles.rotateHintText}>Turn your phone sideways to see every nutrient side by side</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{activePeriod.sectionTitle}</Text>
          <View
            style={styles.heroCard}
            accessible
            accessibilityLabel={`Average daily calories ${activePeriod.observationLabel}: ${formatMetricValue(calorieMetric, avgCalories)}, ${caloriePercent}% of your ${goals.calories} kcal target${calorieStatus === 'above' ? ', above target' : ''}`}
          >
            <Text style={styles.heroLabel}>Average daily calories</Text>
            <Text style={styles.heroValue}>{formatMetricValue(calorieMetric, avgCalories)}</Text>
            <Text style={[styles.heroTarget, calorieStatus === 'above' && styles.statusText]}>
              {caloriePercent}% of your {formatCalories(goals.calories)} kcal target
            </Text>
            {!hasData ? (
              <Text style={styles.chartEmpty}>
                Nothing logged {activePeriod.observationLabel} yet. Your daily calories will chart here.
              </Text>
            ) : showTrend ? (
              <BarPlot
                values={buckets.map((bucket) => bucket.values.calories)}
                labels={buckets.map((bucket) => bucket.label)}
                target={goals.calories}
                color={accentColor}
                kind="max"
                style={styles.heroChart}
              />
            ) : (
              <View style={[styles.progressTrack, styles.heroProgress]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(caloriePercent, 100)}%`,
                      backgroundColor: calorieStatus === 'above' ? colors.warning : accentColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target progress</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Days within calorie target</Text>
            <Text style={styles.insightValue}>
              {daysWithinCalorieTarget} / {periodHistory.length}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(calorieProgressRatio * 100)}%` },
                ]}
              />
            </View>
          </View>
          <View style={[styles.insightCard, styles.insightCardLast]}>
            <Text style={styles.insightLabel}>Days hitting protein target</Text>
            <Text style={styles.insightValue}>
              {daysHittingProteinTarget} / {periodHistory.length}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(proteinProgressRatio * 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrients</Text>
          <Text style={styles.sectionCaption}>Daily averages · tap a row for its target</Text>
          <View style={styles.groupedCard}>
            {nutrientRows.map(({ metric, value, status }, index) => {
              const percent = metric.target > 0 ? Math.round((value / metric.target) * 100) : 0;
              return (
                <TouchableOpacity
                  key={metric.key}
                  style={[styles.nutrientRow, index > 0 && styles.nutrientRowDivider]}
                  onPress={() => Alert.alert(`Recommended daily ${metric.label.toLowerCase()}`, nutrientInfo(metric.key, goals))}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`${metric.label}: ${formatMetricValue(metric, value)} a day, ${percent}% of ${formatMetricValue(metric, metric.target)}${status !== 'onTrack' ? `, ${STATUS_LABEL[status].toLowerCase()}` : ''}`}
                  accessibilityHint="Shows the target for this nutrient"
                >
                  <View style={styles.nutrientText}>
                    <View style={styles.nutrientLabelRow}>
                      <View style={[styles.swatch, { backgroundColor: metric.color }]} />
                      <Text style={styles.nutrientLabel}>{metric.label}</Text>
                    </View>
                    <Text style={styles.nutrientValue}>{formatMetricValue(metric, value)}</Text>
                    <Text style={[styles.nutrientTarget, status !== 'onTrack' && styles.statusText]}>
                      {status !== 'onTrack'
                        ? `${STATUS_LABEL[status]} · ${percent}%`
                        : `${percent}% of ${formatMetricValue(metric, metric.target)}`}
                    </Text>
                  </View>
                  {!hasData ? null : showTrend ? (
                    <BarPlot
                      values={buckets.map((bucket) => bucket.values[metric.key])}
                      target={metric.target}
                      color={metric.color}
                      kind={metric.kind}
                      style={styles.sparkline}
                    />
                  ) : (
                    <View style={[styles.progressTrack, styles.nutrientProgress]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(percent, 100)}%`,
                            backgroundColor: status === 'onTrack' ? metric.color : colors.warning,
                          },
                        ]}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weight</Text>
          <View style={styles.insightCard}>
            {weightSummary.latest ? (
              <>
                <Text style={styles.insightLabel}>Latest weight</Text>
                <Text style={styles.insightValue}>{formatKg(weightSummary.latest.weightKg)}</Text>
                <Text style={styles.weightDetail}>
                  {weightSummary.change !== null
                    ? `${formatKgChange(weightSummary.change)} ${activePeriod.observationLabel}`
                    : `Log another weigh-in ${activePeriod.observationLabel} to see your change`}
                </Text>
              </>
            ) : (
              <Text style={styles.weightDetail}>
                Log your weight to see how it changes alongside what you eat.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.weightButton, { backgroundColor: accentColor }]}
              onPress={openWeightModal}
              accessibilityRole="button"
              accessibilityLabel="Log weight"
            >
              <Ionicons name="add" size={18} color="#000000" />
              <Text style={styles.weightButtonText}>Log weight</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, styles.sectionLast]}>
          <Text style={styles.sectionTitle}>Observations</Text>
          {observations.map((observation, index) => (
            <View
              key={observation}
              style={[
                styles.observationCard,
                index === observations.length - 1 && styles.observationCardLast,
              ]}
            >
              <Text style={styles.observationText}>{observation}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={weightModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Today's weight (kg)</Text>
            <TextInput
              style={styles.modalInput}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 72.5"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={styles.modalNote}>
              Logging again today replaces today's weigh-in. This also updates your weight in Settings.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setWeightModalVisible(false)}
                disabled={savingWeight}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: accentColor }]}
                onPress={handleSaveWeight}
                disabled={savingWeight}
              >
                <Text style={styles.modalButtonText}>{savingWeight ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors.textPrimary,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 4,
  },
  segmentedControlCompact: {
    marginHorizontal: 0,
    marginBottom: 0,
    width: 360,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: radii.card - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCompact: {
    paddingVertical: 6,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.onAccent,
  },
  rotateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  rotateHintText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    color: colors.textMuted,
  },
  chartScreen: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chartTitleBlock: {
    flexShrink: 1,
    marginRight: spacing.md,
  },
  chartTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chartSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLast: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  insightCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    minHeight: 110,
    justifyContent: 'center',
  },
  insightCardLast: {
    marginBottom: 0,
  },
  sectionCaption: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  heroCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  heroLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  heroValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  heroTarget: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroChart: {
    height: 150,
    flex: 0,
    marginTop: spacing.md,
  },
  chartEmpty: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  heroProgress: {
    height: 10,
    borderRadius: 5,
    marginTop: spacing.md,
  },
  statusText: {
    color: colors.warning,
    fontWeight: '600',
  },
  groupedCard: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  nutrientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  nutrientRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  nutrientText: {
    flex: 1,
    marginRight: spacing.md,
  },
  nutrientLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  nutrientLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  nutrientValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  nutrientTarget: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sparkline: {
    flex: 0,
    width: 96,
    height: 36,
  },
  nutrientProgress: {
    width: 96,
    marginTop: 0,
  },
  insightLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.progressTrack,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },
  observationCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.observationTint,
    borderRadius: radii.card,
  },
  observationCardLast: {
    marginBottom: 0,
  },
  observationText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  weightDetail: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  weightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  // Black, not white, on the accent colour for contrast (as in Settings).
  weightButtonText: {
    marginLeft: 4,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
  },
  modalNote: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F2F2F2',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
