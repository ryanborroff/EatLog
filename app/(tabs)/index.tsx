import React, { useState, useCallback, useEffect } from 'react';
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
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRouter, useFocusEffect } from 'expo-router';
import { DayEntry, DailyGoals, Meal } from '../../types';
import {
  getUserGoals,
  getMealsForDate,
  createDayEntry,
  addWater,
  deleteMeal,
} from '../../services/storageService';
import { useTheme } from '../../contexts/ThemeContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { formatFoodItemLine } from '../../utils/formatFoodItem';
import { formatAmount, formatCalories } from '../../utils/formatNumber';
import { formatLoggedTime } from '../../utils/formatTime';
import { colors, spacing, radii, typography } from '../../constants/theme';
import { EXAMPLE_MEAL } from '../../constants/examples';
import { DEFAULT_WATER_ML, getCalorieMetric, getChartMetrics, getTargetStatus } from '../../services/intakeChart';
import ProgressBar from '../../components/ProgressBar';

export default function TodayScreen() {
  const router = useRouter();
  const { accentColor, accentTextColor } = useTheme();
  const { launchVoiceLogPending, clearLaunchVoiceLog } = useOnboarding();
  const [todayEntry, setTodayEntry] = useState<DayEntry | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [loading, setLoading] = useState(true);

  const todayDate = new Date().toISOString().split('T')[0];

  // "Start speaking" on the last onboarding screen lands here and goes straight to the mic.
  useEffect(() => {
    if (!launchVoiceLogPending) return;
    clearLaunchVoiceLog();
    router.push('/modal');
  }, [launchVoiceLogPending, clearLaunchVoiceLog, router]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [userGoals, meals] = await Promise.all([
        getUserGoals(),
        getMealsForDate(todayDate),
      ]);

      const entry = await createDayEntry(todayDate);

      setGoals(userGoals);
      setTodayEntry(entry);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMealType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleVoiceLog = () => {
    router.push('/modal');
  };

  const handleAddWater = async (amountMl: number) => {
    try {
      await addWater(todayDate, amountMl);
      await loadData();
    } catch (error) {
      console.error('Error adding water:', error);
    }
  };

  const handleDeleteMeal = (meal: Meal) => {
    Alert.alert(
      `Delete ${formatMealType(meal.type)}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMeal(todayDate, meal.id);
              await loadData();
            } catch (error) {
              console.error('Error deleting meal:', error);
            }
          },
        },
      ]
    );
  };

  if (loading || !todayEntry || !goals) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { totals } = todayEntry;
  const calorieMetric = getCalorieMetric(goals);
  const caloriesOver = getTargetStatus(calorieMetric, totals.calories) === 'above';
  const remainingCalories = goals.calories - totals.calories;
  const remainingProtein = goals.protein - totals.protein;
  const remainingFibre = goals.fibre !== undefined ? goals.fibre - totals.fibre : null;

  // "760 kcal left · 62g protein left", flipping to "over" once a target is passed.
  const leftOrOver = (remaining: number, format: (value: number) => string, label: string) =>
    remaining >= 0 ? `${format(remaining)}${label} left` : `${format(-remaining)}${label} over`;
  const remainingSummary = [
    leftOrOver(remainingCalories, formatCalories, ' kcal'),
    leftOrOver(remainingProtein, formatAmount, 'g protein'),
    ...(remainingFibre !== null ? [leftOrOver(remainingFibre, formatAmount, 'g fibre')] : []),
  ].join(' · ');

  // Goal-backed nutrients get a mini bar, in the same colours as their Insights charts.
  const chartMetrics = getChartMetrics(goals);
  const macroCells: { label: string; value: string; goal?: number; key?: 'protein' | 'carbohydrate' | 'fat' | 'fibre' }[] = [
    { label: 'Protein', value: `${formatAmount(totals.protein)}g`, goal: goals.protein, key: 'protein' },
    { label: 'Carbs', value: `${formatAmount(totals.carbohydrate)}g`, goal: goals.carbohydrate, key: 'carbohydrate' },
    { label: 'Fat', value: `${formatAmount(totals.fat)}g`, goal: goals.fat, key: 'fat' },
    { label: 'Fibre', value: `${formatAmount(totals.fibre)}g`, goal: goals.fibre, key: 'fibre' },
    { label: 'Sodium', value: `${formatAmount(totals.sodium)}mg` },
    { label: 'Sugar', value: `${formatAmount(totals.sugar)}g` },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.date}>Today</Text>
        </View>

        <View style={styles.totalsCard}>
          <View
            accessible
            accessibilityLabel={`${formatCalories(totals.calories)} of ${formatCalories(goals.calories)} kcal. ${remainingSummary}`}
          >
            <Text style={styles.calorieValue}>
              {formatCalories(totals.calories)}
              <Text style={styles.calorieTarget}> / {formatCalories(goals.calories)} kcal</Text>
            </Text>
            <ProgressBar
              ratio={goals.calories > 0 ? totals.calories / goals.calories : 0}
              color={caloriesOver ? colors.warning : accentColor}
              height={10}
              style={styles.calorieBar}
            />
            <Text style={[styles.remainingSummary, caloriesOver && styles.overText]}>{remainingSummary}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.macroGrid}>
            {macroCells.map((cell) => {
              const metric = cell.key ? chartMetrics.find((m) => m.key === cell.key) : undefined;
              const value = cell.key ? totals[cell.key] : 0;
              const over = metric && cell.goal ? getTargetStatus(metric, value) === 'above' : false;
              return (
                <View key={cell.label} style={styles.macroCell}>
                  <Text style={styles.macroLabel}>{cell.label}</Text>
                  <Text style={styles.macroValue}>
                    {cell.value}
                    {cell.goal ? <Text style={styles.macroGoal}> / {formatAmount(cell.goal)}g</Text> : null}
                  </Text>
                  {metric && cell.goal ? (
                    <ProgressBar
                      ratio={value / cell.goal}
                      color={over ? colors.warning : metric.color}
                      height={4}
                      style={styles.macroBar}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.waterRow}>
            <View style={styles.waterText}>
              <Text style={styles.macroLabel}>Water</Text>
              <Text style={styles.macroValue}>
                {formatAmount(totals.water)}ml
                <Text style={styles.macroGoal}> / {DEFAULT_WATER_ML}ml</Text>
              </Text>
              {todayEntry.waterLogs.length > 0 && (
                <Text style={styles.waterLastLogged}>
                  Last {formatLoggedTime(todayEntry.waterLogs[todayEntry.waterLogs.length - 1].loggedAt)}
                </Text>
              )}
            </View>
            <View style={styles.waterButtonRow}>
              {[250, 500].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.waterButton, { backgroundColor: accentColor }]}
                  onPress={() => handleAddWater(amount)}
                  accessibilityLabel={`Add ${amount}ml of water`}
                  accessibilityRole="button"
                >
                  <Text style={styles.waterButtonText}>+{amount}ml</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <ProgressBar
            ratio={totals.water / DEFAULT_WATER_ML}
            color={chartMetrics.find((m) => m.key === 'water')!.color}
            style={styles.waterBar}
          />
        </View>

        {todayEntry.meals.length === 0 && (
          <TouchableOpacity
            style={styles.emptyState}
            onPress={handleVoiceLog}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Log your first meal"
            accessibilityHint="Opens the microphone"
          >
            {/* A plate, not a mic: the floating mic button is right below and is what to tap. */}
            <View style={[styles.emptyIcon, { backgroundColor: `${accentColor}26` }]}>
              <Ionicons name="restaurant-outline" size={26} color={accentTextColor} />
            </View>
            <Text style={styles.emptyTitle}>Tap the mic to log your first meal</Text>
            <Text style={styles.emptyExample}>Try: {EXAMPLE_MEAL}</Text>
          </TouchableOpacity>
        )}

        {todayEntry.meals.map((meal) => (
          <Swipeable
            key={meal.id}
            renderRightActions={() => (
              <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => handleDeleteMeal(meal)}
                accessibilityLabel={`Delete ${formatMealType(meal.type)}`}
                accessibilityRole="button"
              >
                <Ionicons name="trash" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          >
            <TouchableOpacity
              style={styles.mealCard}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/edit-meal', params: { date: todayDate, mealId: meal.id } })}
              accessibilityLabel={`Edit ${formatMealType(meal.type)}`}
              accessibilityRole="button"
            >
              <View style={styles.mealHeader}>
                <View>
                  <Text style={styles.mealType}>{formatMealType(meal.type)}</Text>
                  <Text style={styles.mealTime}>{formatLoggedTime(meal.loggedAt)}</Text>
                </View>
                <Text style={styles.mealCalories}>{formatCalories(meal.totalCalories)} kcal</Text>
              </View>
              {meal.items.map((item) => (
                <View key={item.id} style={styles.foodItem}>
                  <Text style={styles.foodDescription}>
                    {formatFoodItemLine(item)}
                  </Text>
                </View>
              ))}
            </TouchableOpacity>
          </Swipeable>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: accentColor }]}
        onPress={handleVoiceLog}
        activeOpacity={0.8}
        accessibilityLabel="Log what you've eaten"
        accessibilityRole="button"
      >
        <Ionicons name="mic" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
    paddingTop: spacing.md,
    paddingBottom: 96,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  totalsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  calorieValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  calorieTarget: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  calorieBar: {
    marginTop: spacing.sm,
  },
  remainingSummary: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  overText: {
    color: colors.warning,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.md,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  macroCell: {
    width: '50%',
    paddingRight: spacing.md,
  },
  macroLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  macroGoal: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  macroBar: {
    marginTop: 6,
  },
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterText: {
    flex: 1,
  },
  waterLastLogged: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  waterButtonRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  waterButton: {
    minWidth: 72,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onAccent,
  },
  waterBar: {
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyExample: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  mealCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  deleteAction: {
    marginBottom: spacing.sm,
    marginRight: spacing.lg,
    width: 72,
    borderRadius: radii.card,
    backgroundColor: '#D64545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  mealType: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mealTime: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mealCalories: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  foodItem: {
    marginBottom: spacing.xs,
  },
  foodDescription: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
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
