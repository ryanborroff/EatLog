import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { DayEntry, DailyGoals } from '../../types';
import { getHistory, getUserGoals } from '../../services/storageService';
import { track } from '../../services/analytics';
import { useTheme } from '../../contexts/ThemeContext';
import { colors, spacing, radii } from '../../constants/theme';
import { generateObservations } from '../../utils/insightsObservations';
import { formatAmount } from '../../utils/formatNumber';

type Period = 'day' | 'week' | 'month' | '6months' | 'year';

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

  useFocusEffect(
    useCallback(() => {
      loadInsights();
      track('weekly_summary_viewed');
    }, [])
  );

  const loadInsights = async () => {
    try {
      const [storedHistory, userGoals] = await Promise.all([
        getHistory(),
        getUserGoals(),
      ]);

      setHistory(storedHistory);
      setGoals(userGoals);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
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

  const observations = generateObservations(periodHistory, activePeriod.observationLabel);

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
      infoMessage: '25-30g/day is a common general guideline. Not medical advice.',
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

        <View style={styles.segmentedControl}>
          {PERIOD_OPTIONS.map((option) => {
            const isActive = option.id === period;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.segment, isActive && { backgroundColor: accentColor }]}
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
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: radii.card - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
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
