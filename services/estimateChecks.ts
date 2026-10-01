// Sanity checks on the AI's own nutrition estimate — the last resort when no
// database knows the food. The model recalls these numbers from memory and
// nothing else checks them, so obviously impossible ones are thrown out and
// internally inconsistent ones are marked as rough.

import { EstimatedNutrition } from '../types/foodParser';
import { toGrams } from './unitConversion';

// Pure fat is ~9 kcal/g; nothing edible is denser. A little headroom for rounding.
const MAX_KCAL_PER_GRAM = 9.2;
// Calories from protein/carbs/fat (4/4/9 kcal per g) rarely differ from a
// food's stated calories by more than this; beyond it, the numbers don't agree.
const MAX_ATWATER_MISMATCH = 0.25;
// Small absolute differences don't count (a 12 kcal vs 8 kcal cup of tea).
const MIN_ATWATER_MISMATCH_KCAL = 20;
// Alcohol adds 7 kcal/g that protein/carbs/fat don't account for.
const ALCOHOL = /\b(beer|lager|ale|ipa|stout|porter|guinness|shandy|cider|wine|prosecco|champagne|cava|spritz|gin|vodka|whisky|whiskey|rum|brandy|tequila|sake|spirits?|cocktail|margarita|mojito|sangria|port|sherry|liqueur|pint)\b/i;

export type EstimateVerdict = 'ok' | 'inconsistent' | 'impossible';

/** Grams in the estimate's serving, when its unit is a weight (or a volume, taken as water). */
const servingGrams = (estimate: EstimatedNutrition): number | null =>
  toGrams(estimate.serving_size, estimate.serving_unit) ??
  (/^(ml|millilitres?|milliliters?)$/i.test(estimate.serving_unit.trim()) ? estimate.serving_size : null);

/**
 * Judges an AI estimate:
 * - impossible: more energy per gram than pure fat, more protein+carbs+fat than
 *   the serving weighs, or negative values — don't use it at all;
 * - inconsistent: its calories and macros disagree — usable, but rough;
 * - ok: nothing wrong that can be checked.
 */
export const checkEstimate = (estimate: EstimatedNutrition, description: string): EstimateVerdict => {
  const { calories, protein, carbohydrate, fat } = estimate;
  if ([calories, protein, carbohydrate, fat].some((value) => value < 0)) return 'impossible';

  const grams = servingGrams(estimate);
  if (grams !== null && grams > 0) {
    if (calories / grams > MAX_KCAL_PER_GRAM) return 'impossible';
    if (protein + carbohydrate + fat > grams * 1.05) return 'impossible';
  }

  const fromMacros = protein * 4 + carbohydrate * 4 + fat * 9;
  const difference = calories - fromMacros;
  // Drinks with alcohol legitimately have more calories than their macros explain.
  if (difference > 0 && ALCOHOL.test(description)) return 'ok';
  const larger = Math.max(calories, fromMacros);
  if (Math.abs(difference) > MIN_ATWATER_MISMATCH_KCAL && Math.abs(difference) > larger * MAX_ATWATER_MISMATCH) {
    return 'inconsistent';
  }
  return 'ok';
};

// No single count unit ("slice", "bowl", "whole") of food weighs more than this.
const MAX_GRAMS_PER_UNIT = 1500;

/** The AI's per-unit weight, or null when it's missing or implausible. */
export const plausibleGramsPerUnit = (gramsPerUnit: number | null | undefined): number | null =>
  gramsPerUnit != null && gramsPerUnit > 0 && gramsPerUnit <= MAX_GRAMS_PER_UNIT ? gramsPerUnit : null;
