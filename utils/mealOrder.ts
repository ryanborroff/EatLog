import { Meal } from '../types';

const MAIN_MEAL_RANK: Record<string, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
};

const time = (meal: Meal): number => new Date(meal.loggedAt).getTime() || 0;

/**
 * Rank used for display order. Main meals are fixed (dinner > lunch > breakfast)
 * regardless of when they were logged. A snack sits just above the latest
 * main meal logged before it, so an afternoon snack shows between lunch and dinner.
 */
const rankOf = (meal: Meal, meals: Meal[]): number => {
  const fixed = MAIN_MEAL_RANK[meal.type];
  if (fixed) return fixed;

  const snackTime = time(meal);
  const earlierMainRanks = meals
    .filter((m) => MAIN_MEAL_RANK[m.type] && time(m) <= snackTime)
    .map((m) => MAIN_MEAL_RANK[m.type]);

  return (earlierMainRanks.length ? Math.max(...earlierMainRanks) : 0) + 0.5;
};

/** Latest meal of the day first: dinner, lunch, breakfast, with snacks slotted in between. */
export const sortMealsForDisplay = (meals: Meal[]): Meal[] => {
  const ranked = meals.map((meal) => ({ meal, rank: rankOf(meal, meals) }));
  ranked.sort((a, b) => b.rank - a.rank || time(b.meal) - time(a.meal));
  return ranked.map((r) => r.meal);
};
