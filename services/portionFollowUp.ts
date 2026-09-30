// When someone names a food but no amount ("pasta for dinner"), the parser
// assumes a typical portion. For big items that guess can be off by hundreds
// of calories, so before logging the app asks one quick question: small,
// medium or large? Everything here is local arithmetic — no second AI call.

import { FoodItem } from '../types';
import { scaleNutrition } from './nutritionCalculator';
import { densityFor } from './foodDensity';
import { convertQuantity, toGrams } from './unitConversion';
import type { UsualPortion } from './usualPortions';

// Only ask when a wrong guess costs a lot; an assumed apple isn't worth a tap.
export const MIN_QUESTION_CALORIES = 150;
// However many foods were assumed, it's still one quick screen.
export const MAX_QUESTIONS = 3;

export type PortionSize = 'small' | 'medium' | 'large';

const SIZES: { size: PortionSize; label: string; multiplier: number }[] = [
  { size: 'small', label: 'Small', multiplier: 0.6 },
  { size: 'medium', label: 'Medium', multiplier: 1 },
  { size: 'large', label: 'Large', multiplier: 1.5 },
];

export interface PortionOption {
  size: PortionSize;
  label: string;
  quantity: number;
  calories: number;
  /** The option's weight, when the item is measured by weight. */
  grams: number | null;
}

export interface PortionQuestion {
  itemId: string;
  item: FoodItem;
  options: PortionOption[];
}

/** Rounds a scaled amount to something a person would say: 150 g, not 147.6 g; 1.5 bowls, not 1.44. */
const roundQuantity = (quantity: number): number => {
  if (quantity >= 100) return Math.round(quantity / 10) * 10;
  if (quantity >= 20) return Math.round(quantity / 5) * 5;
  return Math.max(0.5, Math.round(quantity * 2) / 2);
};

const optionQuantity = (item: FoodItem, multiplier: number): number =>
  multiplier === 1 ? item.quantity : roundQuantity(item.quantity * multiplier);

/** The items worth asking about, biggest first. */
export const portionQuestions = (items: FoodItem[]): PortionQuestion[] =>
  items
    .filter((item) => item.portionAssumed && item.calories >= MIN_QUESTION_CALORIES && item.quantity > 0)
    .sort((a, b) => b.calories - a.calories)
    .slice(0, MAX_QUESTIONS)
    .map((item) => ({
      itemId: item.id,
      item,
      options: SIZES.map(({ size, label, multiplier }) => {
        const quantity = optionQuantity(item, multiplier);
        return {
          size,
          label,
          quantity,
          calories: scaleNutrition(item, quantity / item.quantity).calories,
          grams: toGrams(quantity, item.unit),
        };
      }),
    }));

/**
 * Applies the user's answers. An answered item is no longer a guess; one
 * left unanswered keeps the typical portion and stays flagged.
 */
export const applyPortions = (items: FoodItem[], choices: Record<string, PortionSize>): FoodItem[] =>
  items.map((item) => {
    const size = choices[item.id];
    const multiplier = SIZES.find((s) => s.size === size)?.multiplier;
    if (multiplier === undefined || item.quantity <= 0) return item;

    const quantity = optionQuantity(item, multiplier);
    return {
      ...item,
      ...scaleNutrition(item, quantity / item.quantity),
      quantity,
      portionAssumed: false,
    };
  });

/**
 * An item whose amount was guessed, set to the user's usual portion of that
 * food instead. The usual amount is converted into this time's unit when it
 * can be ("300 g" -> "0.3 kg"); otherwise ("1 portion" usual, "200 g" this
 * time) the item is scaled to the usual portion's calories. Unchanged when
 * neither is possible.
 */
export const withUsualPortion = (item: FoodItem, usual: UsualPortion): FoodItem => {
  if (!item.portionAssumed || item.quantity <= 0) return item;
  const converted = convertQuantity(usual.quantity, usual.unit, item.unit, null, densityFor(item.description));
  if (converted) {
    return {
      ...item,
      ...scaleNutrition(item, converted.quantity / item.quantity),
      quantity: usual.quantity,
      unit: usual.unit,
      portionAssumed: false,
    };
  }
  if (usual.calories && item.calories > 0) {
    const quantity = roundQuantity((item.quantity * usual.calories) / item.calories);
    return { ...item, ...scaleNutrition(item, quantity / item.quantity), quantity, portionAssumed: false };
  }
  return item;
};
