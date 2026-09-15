// Applies a set of correction operations (from the parse-food Edge Function)
// to an existing meal. Any new/replaced item still goes through the normal
// resolver + calculator — the AI never supplies final numbers here either
// (spec §14/§21/§36). Modifies the given meal in place and returns it; the
// caller is responsible for persisting via storageService.updateMeal.

import { FoodItem, Meal } from '../types';
import { CorrectionOperation } from '../types/foodParser';
import { resolveFoodItems } from './foodResolver';

const normalize = (text: string): string => text.trim().toLowerCase();

const findItemIndex = (items: FoodItem[], targetDescription: string | null): number => {
  if (!targetDescription) return -1;
  return items.findIndex((item) => normalize(item.description).includes(normalize(targetDescription)));
};

export const applyCorrections = async (meal: Meal, operations: CorrectionOperation[]): Promise<Meal> => {
  const items = [...meal.items];
  let mealType = meal.type;

  for (const op of operations) {
    switch (op.type) {
      case 'remove_item': {
        const index = findItemIndex(items, op.target_description);
        if (index !== -1) items.splice(index, 1);
        break;
      }

      case 'replace_item': {
        if (!op.item) break;
        const index = findItemIndex(items, op.target_description);
        const [resolved] = await resolveFoodItems([op.item]);
        const newItem: FoodItem = { id: String(Date.now()), ...resolved };
        if (index !== -1) {
          items[index] = newItem;
        } else {
          items.push(newItem);
        }
        break;
      }

      case 'add_item': {
        if (!op.item) break;
        const [resolved] = await resolveFoodItems([op.item]);
        items.push({ id: String(Date.now()), ...resolved });
        break;
      }

      case 'update_quantity': {
        if (op.new_quantity == null || !op.new_unit) break;
        const index = findItemIndex(items, op.target_description);
        if (index !== -1) {
          const existing = items[index];
          const scale = existing.quantity > 0 ? op.new_quantity / existing.quantity : 1;
          items[index] = {
            ...existing,
            quantity: op.new_quantity,
            unit: op.new_unit,
            calories: Math.ceil(existing.calories * scale * 10) / 10,
            protein: Math.ceil(existing.protein * scale * 10) / 10,
            carbohydrate: Math.ceil(existing.carbohydrate * scale * 10) / 10,
            fat: Math.ceil(existing.fat * scale * 10) / 10,
            fibre: existing.fibre !== undefined ? Math.ceil(existing.fibre * scale * 10) / 10 : undefined,
            sodium: existing.sodium !== undefined ? Math.ceil(existing.sodium * scale * 10) / 10 : undefined,
            sugar: existing.sugar !== undefined ? Math.ceil(existing.sugar * scale * 10) / 10 : undefined,
          };
        }
        break;
      }

      case 'change_meal_type': {
        if (op.meal_type) mealType = op.meal_type;
        break;
      }
    }
  }

  return {
    ...meal,
    type: mealType,
    items,
    totalCalories: items.reduce((sum, i) => sum + i.calories, 0),
    totalProtein: items.reduce((sum, i) => sum + i.protein, 0),
    totalCarbohydrate: items.reduce((sum, i) => sum + i.carbohydrate, 0),
    totalFat: items.reduce((sum, i) => sum + i.fat, 0),
    totalFibre: items.reduce((sum, i) => sum + (i.fibre ?? 0), 0),
    totalSodium: items.reduce((sum, i) => sum + (i.sodium ?? 0), 0),
    totalSugar: items.reduce((sum, i) => sum + (i.sugar ?? 0), 0),
  };
};
