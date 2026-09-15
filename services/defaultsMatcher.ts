// Pre-parse short-circuit (spec §20): if the transcript plainly names a saved
// default ("I had my usual breakfast"), log it directly without spending an AI
// round trip guessing at ingredients it can't actually know.

import { Meal } from '../types';
import { calculateNutrition, ReferenceNutrition } from './nutritionCalculator';
import { getUserDefaults } from './storageService';

const normalize = (text: string): string => text.trim().toLowerCase();

/** Simple time-of-day fallback when the caller has no explicit meal hint (spec §10). */
const inferMealTypeFromTime = (): Meal['type'] => {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
};

const toReference = (nutrition: {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
}): ReferenceNutrition => ({
  servingSize: 1,
  servingUnit: 'serving',
  ...nutrition,
});

/**
 * Returns a fully-formed Meal (not yet saved) if the transcript names one of
 * the user's saved defaults, else null (caller falls through to the AI parser).
 */
export const matchDefault = async (transcript: string, mealHint?: string): Promise<Meal | null> => {
  const text = normalize(transcript);
  const defaults = await getUserDefaults();

  const matched = defaults.find((d) => text.includes(normalize(d.name)));
  if (!matched) return null;

  if (matched.type === 'food' && matched.nutrition && matched.quantity && matched.unit) {
    const calculated = calculateNutrition(toReference(matched.nutrition), matched.quantity);
    return {
      id: '',
      type: (mealHint as Meal['type']) ?? inferMealTypeFromTime(),
      items: [
        {
          id: '0',
          description: matched.name,
          quantity: matched.quantity,
          unit: matched.unit,
          ...calculated,
          confidence: 'high',
          estimated: false,
        },
      ],
      totalCalories: calculated.calories,
      totalProtein: calculated.protein,
      totalCarbohydrate: calculated.carbohydrate,
      totalFat: calculated.fat,
      totalFibre: calculated.fibre ?? 0,
      totalSodium: calculated.sodium ?? 0,
      totalSugar: calculated.sugar ?? 0,
      loggedAt: new Date().toISOString(),
    };
  }

  if (matched.type === 'meal' && matched.items && matched.items.length > 0) {
    const items = matched.items.map((item, index) => {
      const calculated = calculateNutrition(toReference(item), item.quantity);
      return {
        id: String(index),
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        ...calculated,
        confidence: 'high' as const,
        estimated: false,
      };
    });

    return {
      id: '',
      type: (mealHint as Meal['type']) ?? inferMealTypeFromTime(),
      items,
      totalCalories: items.reduce((sum, i) => sum + i.calories, 0),
      totalProtein: items.reduce((sum, i) => sum + i.protein, 0),
      totalCarbohydrate: items.reduce((sum, i) => sum + i.carbohydrate, 0),
      totalFat: items.reduce((sum, i) => sum + i.fat, 0),
      totalFibre: items.reduce((sum, i) => sum + (i.fibre ?? 0), 0),
      totalSodium: items.reduce((sum, i) => sum + (i.sodium ?? 0), 0),
      totalSugar: items.reduce((sum, i) => sum + (i.sugar ?? 0), 0),
      loggedAt: new Date().toISOString(),
    };
  }

  return null;
};
