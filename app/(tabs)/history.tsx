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
import { useFocusEffect, useRouter } from 'expo-router';
import { DayEntry, DailyGoals, DailyTotals } from '../../types';
import { getHistory, getUserGoals } from '../../services/storageService';
import {
  getCalorieMetric,
  getChartMetrics,
  getMacroCalorieSplit,
  getTargetStatus,
  MacroKey,
} from '../../services/intakeChart';
import MealCard from '../../components/MealCard';
import ProgressBar from '../../components/ProgressBar';
import ScreenHeader from '../../components/ScreenHeader';
import { useTheme, useColors, useThemedStyles } from '../../contexts/ThemeContext';
import { formatAmount, formatCalories } from '../../utils/formatNumber';
import { spacing, radii, ThemeColors } from '../../constants/theme';
import CalendarPicker from '../../components/CalendarPicker';
import { groupByWeek, parseDateKey } from '../../services/historyWeeks';

const MACRO_KEYS: MacroKey[] = ['protein', 'carbohydrate', 'fat'];
const MACRO_LABELS: Record<MacroKey, string> = { protein: 'Protein', carbohydrate: 'Carbs', fat: 'Fat' };

const nutrientList = (totals: DailyTotals) => [
  { label: 'Protein', value: `${formatAmount(totals.protein)}g` },
  { label: 'Carbs', value: `${formatAmount(totals.carbohydrate)}g` },
  { label: 'Fat', value: `${formatAmount(totals.fat)}g` },
  { label: 'Fibre', value: `${formatAmount(totals.fibre)}g` },
  { label: 'Sodium', value: `${formatAmount(totals.sodium)}mg` },
  { label: 'Sugar', value: `${formatAmount(totals.sugar)}g` },
];

// "180 kcal under target", or null before goals have loaded. `over` matches the
// amber used elsewhere: only clearly over (see getTargetStatus), not 1 kcal over.
const calorieDelta = (totals: DailyTotals, goals: DailyGoals | null): { text: string; over: boolean } | null => {
  if (!goals) return null;
  const delta = totals.calories - goals.calories;
  const text =
    Math.round(delta) === 0
      ? 'On target'
      : delta > 0
        ? `${formatCalories(delta)} kcal over target`
        : `${formatCalories(-delta)} kcal under target`;
  return { text, over: getTargetStatus(getCalorieMetric(goals), totals.calories) === 'above' };
};

export default function HistoryScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { accentColor, weekStartsOn } = useTheme();
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

  // parseDateKey, not new Date(): the key is a calendar day, and reading it as
  // UTC midnight showed the previous day anywhere west of UTC.
  const formatDate = (dateString: string): string => {
    const date = parseDateKey(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
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

  const renderDayCard = (entry: DayEntry) => {
    const { totals } = entry;
    const expanded = expandedDates.has(entry.date);
    const split = getMacroCalorieSplit(totals);
    const delta = calorieDelta(totals, goals);
    const deltaText = delta?.text ?? null;
    const over = delta?.over ?? false;
    const nutrients = nutrientList(totals);

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
  };

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
    const delta = selectedEntry ? calorieDelta(selectedEntry.totals, goals) : null;
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.dayScrollContent}>
          <ScreenHeader title={formatDate(selectedDate)} backLabel="History" onBack={() => setSelectedDate(null)} />

          {selectedEntry ? (
            <>
              {/* Same summary as Today: calories against the target, then every nutrient. */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCalories}>
                  {formatCalories(selectedEntry.totals.calories)}
                  {goals && <Text style={styles.summaryTarget}> / {formatCalories(goals.calories)} kcal</Text>}
                </Text>
                {goals && (
                  <ProgressBar
                    ratio={goals.calories > 0 ? selectedEntry.totals.calories / goals.calories : 0}
                    color={delta?.over ? colors.warning : accentColor}
                    height={10}
                    style={styles.summaryBar}
                  />
                )}
                {delta && <Text style={[styles.dayDelta, delta.over && styles.dayDeltaOver]}>{delta.text}</Text>}
                <View style={styles.summaryDivider} />
                <View style={styles.nutrientGrid}>
                  {nutrientList(selectedEntry.totals).map((nutrient) => (
                    <View key={nutrient.label} style={styles.nutrientCell}>
                      <Text style={styles.dayMacroLabel}>{nutrient.label}</Text>
                      <Text style={styles.dayMacroValue}>{nutrient.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {selectedEntry.meals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onPress={() => router.push({ pathname: '/edit-meal', params: { date: selectedDate, mealId: meal.id } })}
                />
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
            {/* Names what the bars measure, ahead of the key, so it doesn't read as a fourth macro. */}
            <Text style={styles.legendTitle}>Share of Calories</Text>
            {MACRO_KEYS.map((key) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: macroColors[key] }]} />
                <Text style={styles.legendText}>{MACRO_LABELS[key]}</Text>
              </View>
            ))}
          </View>
        )}

        {groupByWeek(history, weekStartsOn, today).map((week) => (
          <View key={week.key}>
            <View style={styles.weekHeader} accessibilityRole="header">
              <Text style={styles.weekLabel}>{week.label}</Text>
              <Text style={styles.weekSummary}>
                avg {formatCalories(week.averageCalories)} kcal · {week.daysLogged} {week.daysLogged === 1 ? 'day' : 'days'}
              </Text>
            </View>
            {week.entries.map(renderDayCard)}
          </View>
        ))}
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    dayScrollContent: {
      paddingBottom: spacing.lg,
    },
    summaryCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radii.card,
    },
    summaryCalories: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryTarget: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    summaryBar: {
      marginTop: spacing.sm,
    },
    summaryDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
      marginVertical: spacing.md,
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
    weekHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    weekLabel: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    weekSummary: {
      fontSize: 13,
      color: colors.textSecondary,
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
    legendTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginRight: spacing.xs,
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
