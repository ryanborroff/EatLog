import { FoodItem } from '../types';

/**
 * Renders a food item's quantity + description as one natural line, e.g.
 * "2 scrambled eggs" or "250ml whole milk". Guards against the AI parser
 * sometimes already including the quantity in its description text (e.g.
 * "3 weetabix" from "I had 3 weetabix") — prepending the quantity again in
 * that case produced visible duplicates like "3 3 weetabix".
 */
export const formatFoodItemLine = (item: Pick<FoodItem, 'quantity' | 'unit' | 'description'>): string => {
  const description = item.description.trim();
  const alreadyStatesQuantity = new RegExp(`^${item.quantity}\\b`).test(description);

  if (alreadyStatesQuantity) return description;

  // "whole"/similar count-style units read naturally as "2 eggs", not "2whole eggs".
  const isCountUnit = item.unit === 'whole' || item.quantity === 1;
  if (isCountUnit) {
    return item.quantity > 1 ? `${item.quantity} ${description}` : description;
  }

  return `${item.quantity}${item.unit} ${description}`;
};
