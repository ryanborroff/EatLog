// "Dry or cooked?" for pasta, rice and other grains logged by weight without
// saying which. Cooking roughly triples their weight, so 100 g of pasta is
// ~343 kcal dry but ~169 kcal cooked. The resolver prepares both versions;
// this asks, and applies the answer — local arithmetic, no second lookup.

import { CookingChoice, FoodItem } from '../types';

export interface CookingQuestion {
  itemId: string;
  item: FoodItem;
  options: { choice: CookingChoice; label: string; calories: number }[];
}

/** One question per item that can be either. */
export const cookingQuestions = (items: FoodItem[]): CookingQuestion[] =>
  items.flatMap((item) =>
    item.cookingOptions
      ? [
          {
            itemId: item.id,
            item,
            options: [
              { choice: 'dry' as const, label: 'Dry', calories: item.cookingOptions.dry.calories },
              { choice: 'cooked' as const, label: 'Cooked', calories: item.cookingOptions.cooked.calories },
            ],
          },
        ]
      : []
  );

const withoutCookingOptions = ({ cookingOptions: _options, ...item }: FoodItem): FoodItem => item;

/** The item as the chosen version. The weight was stated and now so is the state, so nothing is guessed. */
export const applyCookingChoice = (item: FoodItem, choice: CookingChoice): FoodItem => {
  if (!item.cookingOptions) return item;
  const { foodId, ...nutrition } = item.cookingOptions[choice];
  return {
    ...withoutCookingOptions(item),
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbohydrate: nutrition.carbohydrate,
    fat: nutrition.fat,
    fibre: nutrition.fibre,
    sodium: nutrition.sodium,
    sugar: nutrition.sugar,
    foodId,
    confidence: 'high',
    estimated: false,
  };
};

/** Applies the user's answers; unanswered items keep the guess, still marked as estimated. */
export const applyCookingChoices = (items: FoodItem[], choices: Record<string, CookingChoice>): FoodItem[] =>
  items.map((item) => (choices[item.id] ? applyCookingChoice(item, choices[item.id]) : withoutCookingOptions(item)));
