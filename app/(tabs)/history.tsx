import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { DayEntry } from '../../types';
import { getHistory } from '../../services/storageService';
import { formatFoodItemLine } from '../../utils/formatFoodItem';
import { formatAmount } from '../../utils/formatNumber';
import { formatLoggedTime } from '../../utils/formatTime';
import { colors, spacing, radii } from '../../constants/theme';

export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const storedHistory = await getHistory();
      setHistory(storedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
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

  const selectedEntry = selectedDate
    ? history.find((entry) => entry.date === selectedDate)
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedDate && selectedEntry) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedDate(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.date}>{formatDate(selectedEntry.date)}</Text>
          </View>

          <View style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Calories</Text>
              <Text style={styles.totalValue}>{formatAmount(selectedEntry.totals.calories)} kcal</Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowLast]}>
              <Text style={styles.totalLabel}>Protein</Text>
              <Text style={styles.totalValue}>{formatAmount(selectedEntry.totals.protein)}g</Text>
            </View>
          </View>

          {selectedEntry.meals.map((meal) => (
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>

        {history.map((entry) => (
          <TouchableOpacity
            key={entry.date}
            style={styles.dayCard}
            onPress={() => setSelectedDate(entry.date)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${formatDate(entry.date)}, ${formatAmount(entry.totals.calories)} kcal, ${formatAmount(entry.totals.protein)}g protein, ${formatAmount(entry.totals.carbohydrate)}g carbs, ${formatAmount(entry.totals.fat)}g fat, ${formatAmount(entry.totals.fibre)}g fibre`}
          >
            <Text style={styles.dayDate}>{formatDate(entry.date)}</Text>
            <View style={styles.dayTotals}>
              <Text style={styles.dayCalories}>{formatAmount(entry.totals.calories)} kcal</Text>
              <Text style={styles.dayProtein}>{formatAmount(entry.totals.protein)}g protein</Text>
            </View>
            <Text style={styles.daySecondaryTotals}>
              {formatAmount(entry.totals.carbohydrate)}g carbs · {formatAmount(entry.totals.fat)}g fat · {formatAmount(entry.totals.fibre)}g fibre
            </Text>
          </TouchableOpacity>
        ))}
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
  backButton: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
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
  date: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalRowLast: {
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
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
  dayCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayDate: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  dayTotals: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayCalories: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
  dayProtein: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  daySecondaryTotals: {
    fontSize: 14,
    color: colors.textMuted,
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
