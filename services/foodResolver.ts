// Resolves each AI-parsed item to nutrition values, per spec §12's priority
// order: 1) personal foods, 2) saved defaults, 3-4) standard reference DB
// (exact name, then alias), 5) the AI's own estimate.

import { ParsedFoodItem, ResolvedFoodItem } from '../types/foodParser';
import { calculateNutrition, ReferenceNutrition } from './nutritionCalculator';
import { supabase } from './supabaseClient';

interface FoodRow {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre: number | null;
}

const normalize = (text: string): string => text.trim().toLowerCase();

const getUserId = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
};

/** Tier 1: the user's own saved/nicknamed foods. */
const findPersonalFood = async (description: string, userId: string): Promise<FoodRow | null> => {
  const query = normalize(description);

  const { data } = await supabase
    .from('user_foods')
    .select('nickname, foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre)')
    .eq('user_id', userId)
    .ilike('nickname', query)
    .limit(1)
    .maybeSingle();

  return (data?.foods as unknown as FoodRow) ?? null;
};

/** Tier 2: a saved single-food default (e.g. "coffee") — carries its own fixed quantity/unit. */
const findFoodDefault = async (
  description: string,
  userId: string
): Promise<{ food: FoodRow; quantity: number; unit: string } | null> => {
  const query = normalize(description);

  const { data } = await supabase
    .from('user_defaults')
    .select('quantity, unit, foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre)')
    .eq('user_id', userId)
    .eq('type', 'food')
    .ilike('name', query)
    .limit(1)
    .maybeSingle();

  if (!data || data.quantity == null || !data.unit) return null;
  return { food: data.foods as unknown as FoodRow, quantity: data.quantity, unit: data.unit };
};

/**
 * Tier 3/4: look up the foods table by exact name, then by a known alias.
 * Returns null if nothing matches (falls through to the AI's own estimate).
 */
const findReferenceFood = async (description: string): Promise<FoodRow | null> => {
  const query = normalize(description);

  const { data: exactMatch } = await supabase
    .from('foods')
    .select('id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre')
    .ilike('name', query)
    .limit(1)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  const { data: aliasMatch } = await supabase
    .from('food_aliases')
    .select('foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre)')
    .ilike('alias', query)
    .limit(1)
    .maybeSingle();

  return (aliasMatch?.foods as unknown as FoodRow) ?? null;
};

const fromFoodRow = (food: FoodRow, quantity: number, unit: string, confidence: ResolvedFoodItem['confidence']): ResolvedFoodItem => {
  const reference: ReferenceNutrition = {
    servingSize: food.serving_size,
    servingUnit: food.serving_unit,
    calories: food.calories,
    protein: food.protein,
    carbohydrate: food.carbohydrate,
    fat: food.fat,
    fibre: food.fibre ?? undefined,
  };

  return {
    description: food.name,
    quantity,
    unit,
    ...calculateNutrition(reference, quantity),
    confidence,
    estimated: false,
  };
};

const resolveOne = async (item: ParsedFoodItem): Promise<ResolvedFoodItem> => {
  const userId = await getUserId();

  if (userId) {
    const personalFood = await findPersonalFood(item.description, userId);
    if (personalFood) {
      return fromFoodRow(personalFood, item.quantity, item.unit, 'high');
    }

    const foodDefault = await findFoodDefault(item.description, userId);
    if (foodDefault) {
      // A default's saved quantity/unit takes priority — that's the point of a default.
      return fromFoodRow(foodDefault.food, foodDefault.quantity, foodDefault.unit, 'high');
    }
  }

  const referenceFood = await findReferenceFood(item.description);

  if (referenceFood) {
    const sameUnit = normalize(referenceFood.serving_unit) === normalize(item.unit);
    const reference: ReferenceNutrition = {
      servingSize: referenceFood.serving_size,
      servingUnit: referenceFood.serving_unit,
      calories: referenceFood.calories,
      protein: referenceFood.protein,
      carbohydrate: referenceFood.carbohydrate,
      fat: referenceFood.fat,
      fibre: referenceFood.fibre ?? undefined,
    };
    const calculated = calculateNutrition(reference, item.quantity);

    return {
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ...calculated,
      // Units matching the reference is what makes the scaling trustworthy;
      // otherwise be conservative rather than imply false precision.
      confidence: sameUnit ? item.confidence : 'low',
      estimated: !sameUnit,
    };
  }

  if (item.estimated_nutrition) {
    const est = item.estimated_nutrition;
    const sameUnit = normalize(est.serving_unit) === normalize(item.unit);
    const reference: ReferenceNutrition = {
      servingSize: est.serving_size,
      servingUnit: est.serving_unit,
      calories: est.calories,
      protein: est.protein,
      carbohydrate: est.carbohydrate,
      fat: est.fat,
      fibre: est.fibre ?? undefined,
    };
    const calculated = calculateNutrition(reference, item.quantity);

    return {
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ...calculated,
      confidence: sameUnit ? item.confidence : 'low',
      estimated: true,
    };
  }

  // Spec §39: never invent a confident value when there's nothing to go on.
  return {
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    calories: 0,
    protein: 0,
    carbohydrate: 0,
    fat: 0,
    confidence: 'low',
    estimated: true,
  };
};

export const resolveFoodItems = async (items: ParsedFoodItem[]): Promise<ResolvedFoodItem[]> => {
  return Promise.all(items.map(resolveOne));
};
