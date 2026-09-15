import { FoodItem } from '../types';

/**
 * Renders a food item's quantity + description as one natural line, e.g.
 * "2 scrambled eggs" or "250ml whole milk". Guards against the AI parser
 * sometimes already including the quantity in its description text (e.g.
 * "3 weetabix" from "I had 3 weetabix") — prepending the quantity again in
 * that case produced visible duplicates like "3 3 weetabix".
 */
// Capitalizes only the first letter after any leading digits/unit (e.g. "2 scrambled eggs"
// stays "2 scrambled eggs", "slice of toast" becomes "Slice of toast") for sentence case.
const capitalizeFirstLetter = (line: string): string => {
  const match = line.match(/[a-zA-Z]/);
  if (!match || match.index === undefined) return line;
  const index = match.index;
  return line.slice(0, index) + line[index].toUpperCase() + line.slice(index + 1);
};

export const formatFoodItemLine = (item: Pick<FoodItem, 'quantity' | 'unit' | 'description'>): string => {
  const description = item.description.trim();
  const alreadyStatesQuantity = new RegExp(`^${item.quantity}\\b`).test(description);

  if (alreadyStatesQuantity) return capitalizeFirstLetter(description);

  // "whole"/similar count-style units read naturally as "2 eggs", not "2whole eggs".
  const isCountUnit = item.unit === 'whole' || item.quantity === 1;
  if (isCountUnit) {
    return capitalizeFirstLetter(item.quantity > 1 ? `${item.quantity} ${description}` : description);
  }

  return capitalizeFirstLetter(`${item.quantity}${item.unit} ${description}`);
};
