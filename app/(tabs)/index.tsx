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

export default function TodayScreen() {
  const router = useRouter();
  const { accentColor } = useTheme();
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

  const remainingCalories = goals.calories - todayEntry.totals.calories;
  const remainingProtein = goals.protein - todayEntry.totals.protein;
  const remainingFibre = (goals.fibre ?? 0) - todayEntry.totals.fibre;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.fixedSection}>
        <View style={styles.header}>
          <Text style={styles.date}>Today</Text>
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.calorieSection}>
            <Text style={styles.calorieValue}>{formatCalories(todayEntry.totals.calories)} kcal</Text>
            <Text style={styles.calorieTarget}>of {formatCalories(goals.calories)} kcal</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.macroGrid}>
            <View style={styles.macroCell}>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.protein)}g</Text>
            </View>
            <View style={styles.macroCell}>
              <Text style={styles.macroLabel}>Carbs</Text>
              <Text style={styles.macroValue}>
                {formatAmount(todayEntry.totals.carbohydrate)}g
                {goals.carbohydrate ? ` / ${formatAmount(goals.carbohydrate)}g` : ''}
              </Text>
            </View>
            <View style={styles.macroCell}>
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroValue}>
                {formatAmount(todayEntry.totals.fat)}g
                {goals.fat ? ` / ${formatAmount(goals.fat)}g` : ''}
              </Text>
            </View>
            <View style={styles.macroCell}>
              <Text style={styles.macroLabel}>Fibre</Text>
              <Text style={styles.macroValue}>
                {formatAmount(todayEntry.totals.fibre)}g
                {goals.fibre ? ` / ${formatAmount(goals.fibre)}g` : ''}
              </Text>
            </View>
            <View style={styles.macroCell}>
              <Text style={styles.macroLabel}>Sodium</Text>
              <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.sodium)}mg</Text>
            </View>
            <View style={styles.macroCell}>
              <Text style={styles.macroLabel}>Sugar</Text>
              <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.sugar)}g</Text>
            </View>
          </View>
        </View>

        <View style={styles.compactCardRow}>
          <View style={[styles.totalsCard, styles.compactCard]}>
            <View style={styles.waterHeader}>
              <Text style={styles.macroLabel}>Water</Text>
              <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.water)}ml</Text>
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

          <View style={[styles.totalsCard, styles.compactCard]}>
            <View style={styles.remainingRow}>
              <Text style={styles.remainingLabel}>Calories left</Text>
              <Text style={styles.remainingValue}>
                {remainingCalories >= 0 ? formatCalories(remainingCalories) : `+${formatCalories(Math.abs(remainingCalories))}`}
              </Text>
            </View>
            <View style={styles.remainingRow}>
              <Text style={styles.remainingLabel}>Protein left</Text>
              <Text style={styles.remainingValue}>
                {remainingProtein >= 0 ? formatAmount(remainingProtein) : `+${formatAmount(Math.abs(remainingProtein))}`}g
              </Text>
            </View>
            {goals.fibre !== undefined && (
              <View style={styles.remainingRow}>
                <Text style={styles.remainingLabel}>Fibre left</Text>
                <Text style={styles.remainingValue}>
                  {remainingFibre >= 0 ? formatAmount(remainingFibre) : `+${formatAmount(Math.abs(remainingFibre))}`}g
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {todayEntry.meals.length === 0 && (
          <Text style={styles.emptyMealsText}>Nothing logged yet today.</Text>
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
  fixedSection: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
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
  calorieSection: {
    marginBottom: spacing.sm,
  },
  calorieValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  calorieTarget: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: spacing.sm,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  macroCell: {
    width: '50%',
    marginBottom: spacing.xs,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  compactCardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  compactCard: {
    flex: 1,
    marginHorizontal: 0,
    justifyContent: 'center',
  },
  waterHeader: {
    marginBottom: spacing.sm,
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
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radii.card,
    alignItems: 'center',
  },
  waterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  remainingLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  remainingValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
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
  emptyMealsText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
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
