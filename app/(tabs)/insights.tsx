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
import { formatAmount } from '../../utils/formatNumber';
import { useIntakeChartMode } from '../../utils/useIntakeChartMode';
import { buildChartBuckets, getChartMetrics, ChartPeriod } from '../../services/intakeChart';
import IntakeChart from '../../components/IntakeChart';
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

  const avgCalories = Math.round(average((entry) => entry.totals.calories));
  const avgWater = Math.round(average((entry) => entry.totals.water));
  const avgProtein = formatAmount(average((entry) => entry.totals.protein));
  const avgCarbohydrate = formatAmount(average((entry) => entry.totals.carbohydrate));
  const avgFat = formatAmount(average((entry) => entry.totals.fat));
  const avgFibre = formatAmount(average((entry) => entry.totals.fibre));
  const avgSodium = formatAmount(average((entry) => entry.totals.sodium));
  const avgSugar = formatAmount(average((entry) => entry.totals.sugar));

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

  const macroSquares: { label: string; value: string; infoTitle: string; infoMessage: string; tinted?: boolean }[] = [
    {
      label: 'Average daily calories',
      value: `${avgCalories} kcal`,
      infoTitle: 'Recommended daily calories',
      infoMessage: `Your target is ${goals.calories} kcal/day, set in Settings.`,
    },
    {
      label: 'Average daily water',
      value: `${avgWater}ml`,
      infoTitle: 'Recommended daily water',
      infoMessage: 'About 2,000-2,500ml/day is a common general guideline. Not medical advice.',
      tinted: true,
    },
    {
      label: 'Average daily protein',
      value: `${avgProtein}g`,
      infoTitle: 'Recommended daily protein',
      infoMessage: `Your target is ${goals.protein}g/day, set in Settings.`,
    },
    {
      label: 'Average daily carbs',
      value: `${avgCarbohydrate}g`,
      infoTitle: 'Recommended daily carbs',
      infoMessage: goals.carbohydrate
        ? `Your target is ${goals.carbohydrate}g/day, set in Settings.`
        : 'About 260g/day (45-65% of calories) is a common general guideline. Not medical advice.',
    },
    {
      label: 'Average daily fat',
      value: `${avgFat}g`,
      infoTitle: 'Recommended daily fat',
      infoMessage: goals.fat
        ? `Your target is ${goals.fat}g/day, set in Settings.`
        : 'About 70g/day (20-35% of calories) is a common general guideline. Not medical advice.',
    },
    {
      label: 'Average daily fibre',
      value: `${avgFibre}g`,
      infoTitle: 'Recommended daily fibre',
      infoMessage: goals.fibre
        ? `Your target is ${goals.fibre}g/day, set in Settings.`
        : '25-30g/day is a common general guideline. Not medical advice.',
    },
    {
      label: 'Average daily sodium',
      value: `${avgSodium}mg`,
      infoTitle: 'Recommended daily sodium',
      infoMessage: 'Under 2,300mg/day is a common general guideline. Not medical advice.',
    },
    {
      label: 'Average daily sugar',
      value: `${avgSugar}g`,
      infoTitle: 'Recommended daily sugar',
      infoMessage: 'Under 50g/day (ideally under 25g) is a common general guideline. Not medical advice.',
    },
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
            <Text style={styles.rotateHintText}>Turn your phone sideways to chart protein, carbs, fat, fibre and water</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{activePeriod.sectionTitle}</Text>
          <View style={styles.insightGrid}>
            {macroSquares.map((square) => (
              <View
                key={square.label}
                style={[styles.insightSquare, square.tinted && styles.insightSquareTinted]}
              >
                <View style={styles.insightSquareHeader}>
                  <Text style={styles.insightSquareLabel}>{square.label}</Text>
                  <TouchableOpacity
                    onPress={() => Alert.alert(square.infoTitle, square.infoMessage)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${square.infoTitle} info`}
                  >
                    <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.insightSquareValue}>{square.value}</Text>
              </View>
            ))}
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
    color: '#FFFFFF',
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
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  insightSquare: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    justifyContent: 'flex-start',
  },
  insightSquareTinted: {
    backgroundColor: '#BFE0F5',
  },
  insightSquareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  insightSquareLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  insightSquareValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'left',
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
    backgroundColor: colors.divider,
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
