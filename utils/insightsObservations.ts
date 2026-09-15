import { DayEntry, Meal } from '../types';

const MEAL_TYPES: Meal['type'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

const mean = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

const stdDev = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
};

/**
 * Generates 1-2 plain-English observations from a period's history using
 * simple statistics (coefficient of variation, per-meal-type variance) —
 * no AI call, so it's instant and free, and scales with whatever period
 * (week/month/6 months) the caller passes in.
 */
export const generateObservations = (periodHistory: DayEntry[], periodLabel: string): string[] => {
  if (periodHistory.length < 2) {
    return [`Log a few more days ${periodLabel} to see trends here.`];
  }

  const observations: string[] = [];

  // Protein consistency: coefficient of variation (stddev / mean) of daily protein.
  const dailyProtein = periodHistory.map((entry) => entry.totals.protein);
  const avgProtein = mean(dailyProtein);
  if (avgProtein > 0) {
    const proteinCv = stdDev(dailyProtein) / avgProtein;
    observations.push(
      proteinCv < 0.25
        ? `Your protein intake has been fairly consistent ${periodLabel}.`
        : `Your protein intake has varied quite a bit ${periodLabel}.`
    );
  }

  // Which meal type contributes the most day-to-day calorie variance.
  const caloriesByMealType: Record<Meal['type'], number[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  for (const entry of periodHistory) {
    const totalsForDay: Record<Meal['type'], number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const meal of entry.meals) {
      totalsForDay[meal.type] += meal.totalCalories;
    }
    for (const type of MEAL_TYPES) {
      caloriesByMealType[type].push(totalsForDay[type]);
    }
  }

  let topMealType: Meal['type'] | null = null;
  let topVariance = 0;
  for (const type of MEAL_TYPES) {
    const values = caloriesByMealType[type];
    if (values.some((v) => v > 0)) {
      const variance = stdDev(values) ** 2;
      if (variance > topVariance) {
        topVariance = variance;
        topMealType = type;
      }
    }
  }

  if (topMealType && topVariance > 0) {
    observations.push(`Most of your calorie variation is coming from ${topMealType} meals.`);
  }

  if (observations.length === 0) {
    observations.push(`Not enough variety in your logs ${periodLabel} to spot a pattern yet.`);
  }

  return observations;
};
