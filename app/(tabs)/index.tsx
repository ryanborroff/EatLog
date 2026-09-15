import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { DayEntry, DailyGoals, Meal } from '../../types';
import {
  getUserGoals,
  getMealsForDate,
  createDayEntry,
  addWater,
} from '../../services/storageService';
import { useTheme } from '../../contexts/ThemeContext';
import { formatFoodItemLine } from '../../utils/formatFoodItem';
import { formatAmount } from '../../utils/formatNumber';
import { formatLoggedTime } from '../../utils/formatTime';
import { colors, spacing, radii } from '../../constants/theme';

type VoiceState = 'idle' | 'listening' | 'processing' | 'clarification' | 'complete';

export default function TodayScreen() {
  const router = useRouter();
  const { accentColor, accentTextColor } = useTheme();
  const [todayEntry, setTodayEntry] = useState<DayEntry | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [loading, setLoading] = useState(true);

  const todayDate = new Date().toISOString().split('T')[0];

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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatMealType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const handleVoiceLog = () => {
    router.push('/modal');
  };

  const handleAsk = () => {
    router.push('/ask');
  };

  const handleAddWater = async (amountMl: number) => {
    try {
      await addWater(todayDate, amountMl);
      await loadData();
    } catch (error) {
      console.error('Error adding water:', error);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.date}>{formatDate(todayEntry.date)}</Text>
          <TouchableOpacity
            style={styles.askButtonTouchable}
            onPress={handleAsk}
            accessibilityLabel="Ask about your diary"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.askButton, { color: accentTextColor }]}>Ask</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.calorieSection}>
            <Text style={styles.calorieValue}>{formatAmount(todayEntry.totals.calories)} kcal</Text>
            <Text style={styles.calorieTarget}>of {formatAmount(goals.calories)} kcal</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>
              {formatAmount(todayEntry.totals.protein)}g / {formatAmount(goals.protein)}g
            </Text>
          </View>

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Carbohydrates</Text>
            <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.carbohydrate)}g</Text>
          </View>

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.fat)}g</Text>
          </View>

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Fibre</Text>
            <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.fibre)}g</Text>
          </View>

          <View style={styles.macroSection}>
            <Text style={styles.macroLabel}>Sodium</Text>
            <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.sodium)}mg</Text>
          </View>

          <View style={[styles.macroSection, styles.macroSectionLast]}>
            <Text style={styles.macroLabel}>Sugar</Text>
            <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.sugar)}g</Text>
          </View>
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.waterHeader}>
            <Text style={styles.macroLabel}>Water</Text>
            <Text style={styles.macroValue}>{formatAmount(todayEntry.totals.water)}ml</Text>
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
                <Text style={[styles.waterButtonText, { color: accentTextColor }]}>+{amount}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.remainingSection}>
          <Text style={styles.remainingLabel}>Calories remaining</Text>
          <Text style={styles.remainingValue}>
            {remainingCalories >= 0 ? formatAmount(remainingCalories) : `+${formatAmount(Math.abs(remainingCalories))}`} kcal
          </Text>
        </View>

        <View style={[styles.remainingSection, styles.remainingSectionLast]}>
          <Text style={styles.remainingLabel}>Protein remaining</Text>
          <Text style={styles.remainingValue}>
            {remainingProtein >= 0 ? formatAmount(remainingProtein) : `+${formatAmount(Math.abs(remainingProtein))}`}g
          </Text>
        </View>

        {todayEntry.meals.map((meal) => (
          <View key={meal.id} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <View>
                <Text style={styles.mealType}>{formatMealType(meal.type)}</Text>
                <Text style={styles.mealTime}>{formatLoggedTime(meal.loggedAt)}</Text>
              </View>
              <Text style={styles.mealCalories}>{formatAmount(meal.totalCalories)} kcal</Text>
            </View>
            {meal.items.map((item) => (
              <View key={item.id} style={styles.foodItem}>
                <Text style={styles.foodDescription}>
                  {formatFoodItemLine(item)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.voiceButtonContainer}>
          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: accentColor }]}
            onPress={handleVoiceLog}
            activeOpacity={0.85}
          >
            <Text style={styles.voiceButtonText}>LOG FOOD</Text>
          </TouchableOpacity>
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
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  askButtonTouchable: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  askButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  calorieSection: {
    marginBottom: spacing.md,
  },
  calorieValue: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  calorieTarget: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: spacing.md,
  },
  macroSection: {
    marginBottom: spacing.sm,
  },
  macroSectionLast: {
    marginBottom: 0,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 4,
  },
  waterHeader: {
    marginBottom: spacing.md,
  },
  waterButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  waterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    alignItems: 'center',
  },
  waterButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  remainingSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingSectionLast: {
    marginBottom: spacing.lg,
  },
  remainingLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  remainingValue: {
    fontSize: 18,
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
  voiceButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  voiceButton: {
    borderRadius: radii.pill,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonText: {
    // Black, not white: white text on any of the light accent backgrounds
    // fails WCAG AA contrast (see docs/accessibility-audit.md).
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
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
