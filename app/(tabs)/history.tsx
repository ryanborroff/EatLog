import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { DayEntry, DailyGoals } from '../../types';
import { getHistory, getUserGoals } from '../../services/storageService';
import {
  getCalorieMetric,
  getChartMetrics,
  getMacroCalorieSplit,
  getTargetStatus,
  MacroKey,
} from '../../services/intakeChart';
import { formatFoodItemLine } from '../../utils/formatFoodItem';
import { formatAmount, formatCalories } from '../../utils/formatNumber';
import { formatLoggedTime } from '../../utils/formatTime';
import { colors, spacing, radii } from '../../constants/theme';
import CalendarPicker from '../../components/CalendarPicker';

const MACRO_KEYS: MacroKey[] = ['protein', 'carbohydrate', 'fat'];
const MACRO_LABELS: Record<MacroKey, string> = { protein: 'Protein', carbohydrate: 'Carbs', fat: 'Fat' };

export default function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const [storedHistory, userGoals] = await Promise.all([getHistory(), getUserGoals()]);
      setHistory(storedHistory);
      setGoals(userGoals);
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

  // Same colours as the Insights charts. They don't depend on goals, so any goals will do here.
  const macroColors = Object.fromEntries(
    getChartMetrics({ calories: 0, protein: 0 }).map((metric) => [metric.key, metric.color])
  ) as Record<MacroKey, string>;

  const toggleExpanded = (date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const selectedEntry = selectedDate
    ? history.find((entry) => entry.date === selectedDate)
    : null;
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedDate) {
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
            <Text style={styles.date}>{formatDate(selectedDate)}</Text>
          </View>

          {selectedEntry ? (
            <>
              <View style={styles.totalsCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Calories</Text>
                  <Text style={styles.totalValue}>{formatCalories(selectedEntry.totals.calories)} kcal</Text>
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
                    <Text style={styles.mealCalories}>{formatCalories(meal.totalCalories)} kcal</Text>
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
            </>
          ) : (
            <View style={styles.emptyDayCard}>
              <Text style={styles.emptyDayText}>No meals logged on this day.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>History</Text>
          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Jump to a specific day"
          >
            <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyDayCard}>
            <Text style={styles.emptyDayText}>Days you log will show up here.</Text>
          </View>
        ) : (
          <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {MACRO_KEYS.map((key) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: macroColors[key] }]} />
                <Text style={styles.legendText}>{MACRO_LABELS[key]}</Text>
              </View>
            ))}
            <Text style={styles.legendText}>· share of calories</Text>
          </View>
        )}

        {history.map((entry) => {
          const { totals } = entry;
          const expanded = expandedDates.has(entry.date);
          const split = getMacroCalorieSplit(totals);
          const calorieDelta = goals ? totals.calories - goals.calories : null;
          const over = goals ? getTargetStatus(getCalorieMetric(goals), totals.calories) === 'above' : false;
          const deltaText =
            calorieDelta === null
              ? null
              : Math.round(calorieDelta) === 0
                ? 'On target'
                : calorieDelta > 0
                  ? `${formatCalories(calorieDelta)} kcal over target`
                  : `${formatCalories(-calorieDelta)} kcal under target`;
          const nutrients = [
            { label: 'Protein', value: `${formatAmount(totals.protein)}g` },
            { label: 'Carbs', value: `${formatAmount(totals.carbohydrate)}g` },
            { label: 'Fat', value: `${formatAmount(totals.fat)}g` },
            { label: 'Fibre', value: `${formatAmount(totals.fibre)}g` },
            { label: 'Sodium', value: `${formatAmount(totals.sodium)}mg` },
            { label: 'Sugar', value: `${formatAmount(totals.sugar)}g` },
          ];

          return (
            <View key={entry.date} style={styles.dayCard}>
              <TouchableOpacity
                onPress={() => toggleExpanded(entry.date)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityHint={expanded ? 'Hides the nutrient breakdown' : 'Shows the nutrient breakdown'}
                accessibilityLabel={`${formatDate(entry.date)}, ${formatCalories(totals.calories)} kcal${deltaText ? `, ${deltaText}` : ''}, ${formatAmount(totals.protein)}g protein, ${formatAmount(totals.carbohydrate)}g carbs, ${formatAmount(totals.fat)}g fat, ${formatAmount(totals.fibre)}g fibre, ${formatAmount(totals.sodium)}mg sodium, ${formatAmount(totals.sugar)}g sugar`}
              >
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate} numberOfLines={1}>
                    {formatDate(entry.date)}
                  </Text>
                  <Text style={styles.dayCalories}>{formatCalories(totals.calories)} kcal</Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                    style={styles.chevron}
                  />
                </View>

                <View style={styles.macroBar}>
                  {MACRO_KEYS.map((key) =>
                    split[key] > 0 ? (
                      <View key={key} style={{ flex: split[key], backgroundColor: macroColors[key] }} />
                    ) : null
                  )}
                </View>

                {deltaText && <Text style={[styles.dayDelta, over && styles.dayDeltaOver]}>{deltaText}</Text>}
              </TouchableOpacity>

              {expanded && (
                <View style={styles.dayDetails}>
                  <View style={styles.nutrientGrid}>
                    {nutrients.map((nutrient) => (
                      <View key={nutrient.label} style={styles.nutrientCell}>
                        <Text style={styles.dayMacroLabel}>{nutrient.label}</Text>
                        <Text style={styles.dayMacroValue}>{nutrient.value}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.viewMeals}
                    onPress={() => setSelectedDate(entry.date)}
                    accessibilityRole="button"
                    accessibilityLabel={`View meals for ${formatDate(entry.date)}`}
                  >
                    <Text style={styles.viewMealsText}>View meals</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <CalendarPicker
        visible={pickerVisible}
        selectedDate={selectedDate ?? today}
        onSelect={setSelectedDate}
        onClose={() => setPickerVisible(false)}
      />
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
  headerRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  emptyDayCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.card,
  },
  emptyDayText: {
    fontSize: 16,
    color: colors.textSecondary,
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  legendText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayDate: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.xs,
  },
  dayCalories: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  macroBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.progressTrack,
    marginTop: spacing.sm,
  },
  dayDelta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
  },
  dayDeltaOver: {
    color: colors.warning,
    fontWeight: '600',
  },
  dayDetails: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xs,
  },
  nutrientCell: {
    width: '50%',
  },
  dayMacroLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayMacroValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 1,
  },
  viewMeals: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: spacing.xs,
    gap: 4,
  },
  viewMealsText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
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
