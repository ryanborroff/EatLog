// Changes the amount of an already-logged item — shared by voice corrections
// ("actually it was 100 g") and Edit Meal's manual item edit.

import { FoodItem } from '../types';
import { ParsedFoodItem } from '../types/foodParser';
import { densityFor } from './foodDensity';
import { resolveFoodItems } from './foodResolver';
import { scaleNutrition } from './nutritionCalculator';
import { convertQuantity } from './unitConversion';

/**
 * Returns `existing` at a new amount. The new amount is converted into the
 * item's current unit before scaling — "2 slices" -> "100 g" is not 50x the
 * calories. When the units can't be reconciled (a count unit with no known
 * weight), the item is resolved afresh at the new amount instead. Returns
 * null when that fails too, so the caller can tell the user rather than log a
 * wrong number. `parsedItem` is the parser's reading of the new amount, when
 * there is one (voice corrections); its `grams_per_unit` helps conversion.
 */
export const requantify = async (
  existing: FoodItem,
  newQuantity: number,
  newUnit: string,
  parsedItem: ParsedFoodItem | null = null
): Promise<FoodItem | null> => {
  const converted = convertQuantity(
    newQuantity,
    newUnit,
    existing.unit,
    parsedItem?.grams_per_unit,
    densityFor(existing.description)
  );

  if (converted && existing.quantity > 0) {
    return {
      ...existing,
      ...scaleNutrition(existing, converted.quantity / existing.quantity),
      quantity: newQuantity,
      unit: newUnit,
      estimated: existing.estimated || converted.approximate,
      // The user just said how much, so it's no longer a guess.
      portionAssumed: false,
      confidence: converted.approximate && existing.confidence === 'high' ? 'medium' : existing.confidence,
    };
  }

  const [resolved] = await resolveFoodItems([
    {
      brand: null,
      grams_per_unit: null,
      preparation: null,
      confidence: 'medium',
      estimated_nutrition: null,
      ...parsedItem,
      description: parsedItem?.description ?? existing.description,
      quantity: newQuantity,
      unit: newUnit,
    },
  ]);

  if (resolved.unresolved) return null;
  return { ...resolved, id: existing.id, portionAssumed: false };
};
