import {
  FoodItem,
  Meal,
  DailyGoals,
  DayEntry,
  DailyTotals,
  PersonalFood,
  UserDefault,
  DefaultItem,
  NutritionReference,
  UserProfile,
  WaterLog,
  WeightEntry,
} from '../types';
import { ParsedFoodResult } from '../types/foodParser';
import { supabase, withClockSkewRetry } from './supabaseClient';
import { sortMealsForDisplay } from '../utils/mealOrder';

const getUserId = async (): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return session.user.id;
};

// User Goals

export const getUserGoals = async (): Promise<DailyGoals> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_goals')
    .select('daily_calories, daily_protein, daily_carbs, daily_fat, daily_fibre')
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  return {
    calories: data.daily_calories,
    protein: data.daily_protein,
    carbohydrate: data.daily_carbs ?? undefined,
    fat: data.daily_fat ?? undefined,
    fibre: data.daily_fibre ?? undefined,
  };
});

export const saveUserGoals = async (goals: DailyGoals): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_goals')
    .update({
      daily_calories: goals.calories,
      daily_protein: goals.protein,
      daily_carbs: goals.carbohydrate ?? null,
      daily_fat: goals.fat ?? null,
      daily_fibre: goals.fibre ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
};

// User Profile (biometrics, used to suggest a calorie target)

export const getUserProfile = async (): Promise<UserProfile> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('users')
    .select('sex, birth_year, height_cm, weight_kg, activity_level')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    sex: data.sex ?? undefined,
    birthYear: data.birth_year ?? undefined,
    heightCm: data.height_cm ?? undefined,
    weightKg: data.weight_kg ?? undefined,
    activityLevel: data.activity_level ?? undefined,
  };
});

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('users')
    .update({
      sex: profile.sex ?? null,
      birth_year: profile.birthYear ?? null,
      height_cm: profile.heightCm ?? null,
      weight_kg: profile.weightKg ?? null,
      activity_level: profile.activityLevel ?? null,
    })
    .eq('id', userId);

  if (error) throw error;
};

// Meals

interface MealRow {
  id: string;
  meal_type: Meal['type'];
  created_at: string;
  meal_items: MealItemRow[];
}

interface MealItemRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre: number | null;
  sodium: number | null;
  sugar: number | null;
  confidence: FoodItem['confidence'];
  estimated: boolean;
}

const toFoodItem = (row: MealItemRow): FoodItem => ({
  id: row.id,
  description: row.description,
  quantity: row.quantity,
  unit: row.unit,
  calories: row.calories,
  protein: row.protein,
  carbohydrate: row.carbohydrate,
  fat: row.fat,
  fibre: row.fibre ?? undefined,
  sodium: row.sodium ?? undefined,
  sugar: row.sugar ?? undefined,
  confidence: row.confidence,
  estimated: row.estimated,
});

const sumBy = (items: FoodItem[], key: keyof Pick<FoodItem, 'calories' | 'protein' | 'carbohydrate' | 'fat' | 'fibre' | 'sodium' | 'sugar'>) =>
  items.reduce((sum, item) => sum + (item[key] ?? 0), 0);

const toMeal = (row: MealRow): Meal => {
  const items = row.meal_items.map(toFoodItem);
  return {
    id: row.id,
    type: row.meal_type,
    items,
    totalCalories: sumBy(items, 'calories'),
    totalProtein: sumBy(items, 'protein'),
    totalCarbohydrate: sumBy(items, 'carbohydrate'),
    totalFat: sumBy(items, 'fat'),
    totalFibre: sumBy(items, 'fibre'),
    totalSodium: sumBy(items, 'sodium'),
    totalSugar: sumBy(items, 'sugar'),
    loggedAt: row.created_at,
  };
};

export const getMealsForDate = async (date: string): Promise<Meal[]> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('meals')
    .select('id, meal_type, created_at, meal_items(*)')
    .eq('user_id', userId)
    .eq('date', date);

  if (error) throw error;

  return sortMealsForDisplay((data as MealRow[]).map(toMeal));
});

export const saveMealForDate = async (date: string, meal: Meal): Promise<string> => {
  const userId = await getUserId();

  const { data: insertedMeal, error: mealError } = await supabase
    .from('meals')
    .insert({ user_id: userId, date, meal_type: meal.type })
    .select('id')
    .single();

  if (mealError) throw mealError;

  const itemRows = meal.items.map((item) => ({
    meal_id: insertedMeal.id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein: item.protein,
    carbohydrate: item.carbohydrate,
    fat: item.fat,
    fibre: item.fibre ?? null,
    sodium: item.sodium ?? null,
    sugar: item.sugar ?? null,
    confidence: item.confidence,
    estimated: item.estimated,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from('meal_items').insert(itemRows);
    if (itemsError) throw itemsError;
  }

  return insertedMeal.id;
};

export const updateMeal = async (date: string, mealId: string, updatedMeal: Meal): Promise<void> => {
  const { error: mealError } = await supabase
    .from('meals')
    .update({ meal_type: updatedMeal.type, updated_at: new Date().toISOString() })
    .eq('id', mealId);

  if (mealError) throw mealError;

  const { error: deleteError } = await supabase.from('meal_items').delete().eq('meal_id', mealId);
  if (deleteError) throw deleteError;

  const itemRows = updatedMeal.items.map((item) => ({
    meal_id: mealId,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein: item.protein,
    carbohydrate: item.carbohydrate,
    fat: item.fat,
    fibre: item.fibre ?? null,
    sodium: item.sodium ?? null,
    sugar: item.sugar ?? null,
    confidence: item.confidence,
    estimated: item.estimated,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from('meal_items').insert(itemRows);
    if (itemsError) throw itemsError;
  }
};

export const deleteMeal = async (date: string, mealId: string): Promise<void> => {
  const { error } = await supabase.from('meals').delete().eq('id', mealId);
  if (error) throw error;
};

/** Most recently logged meal for a date, or null if none — used to target corrections. */
export const getMostRecentMeal = async (date: string): Promise<Meal | null> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('meals')
    .select('id, meal_type, created_at, meal_items(*)')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return toMeal(data as MealRow);
});

// History

export const getHistory = async (): Promise<DayEntry[]> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const [mealsResult, waterResult] = await Promise.all([
    supabase
      .from('meals')
      .select('id, date, meal_type, created_at, meal_items(*)')
      .eq('user_id', userId)
      .order('date', { ascending: false }),
    supabase.from('water_logs').select('date, amount_ml').eq('user_id', userId),
  ]);

  if (mealsResult.error) throw mealsResult.error;
  if (waterResult.error) throw waterResult.error;

  const byDate = new Map<string, MealRow[]>();
  for (const row of mealsResult.data as (MealRow & { date: string })[]) {
    const existing = byDate.get(row.date) ?? [];
    existing.push(row);
    byDate.set(row.date, existing);
  }

  const waterByDate = new Map<string, number>();
  for (const row of waterResult.data as { date: string; amount_ml: number }[]) {
    waterByDate.set(row.date, (waterByDate.get(row.date) ?? 0) + row.amount_ml);
  }

  // A day is a history entry when it has meals; water logged that day is folded
  // into its totals (water-only days would otherwise read as 0 kcal days).
  return Array.from(byDate.entries()).map(([date, rows]) => {
    const meals = rows.map(toMeal);
    const totals = { ...calculateTotals(meals), water: waterByDate.get(date) ?? 0 };
    // Only the daily water total is needed here, so individual logs aren't returned.
    return { date, meals, totals, waterLogs: [] };
  });
});

// Voice logs

export const saveVoiceLog = async (transcription: string, parsedResult: ParsedFoodResult): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('voice_logs')
    .insert({ user_id: userId, transcription, parsed_result: parsedResult });

  if (error) throw error;
};

// Calculate totals from meals

export const calculateTotals = (meals: Meal[]): DailyTotals => {
  return meals.reduce(
    (totals, meal) => ({
      ...totals,
      calories: totals.calories + meal.totalCalories,
      protein: totals.protein + meal.totalProtein,
      carbohydrate: totals.carbohydrate + meal.totalCarbohydrate,
      fat: totals.fat + meal.totalFat,
      fibre: totals.fibre + meal.totalFibre,
      sodium: totals.sodium + meal.totalSodium,
      sugar: totals.sugar + meal.totalSugar,
    }),
    { calories: 0, protein: 0, carbohydrate: 0, fat: 0, fibre: 0, sodium: 0, sugar: 0, water: 0 }
  );
};

// Create a complete day entry from meals

export const createDayEntry = async (date: string): Promise<DayEntry> => {
  const [meals, waterLogs] = await Promise.all([getMealsForDate(date), getWaterLogsForDate(date)]);
  const water = waterLogs.reduce((sum, log) => sum + log.amountMl, 0);
  const totals = { ...calculateTotals(meals), water };

  return { date, meals, totals, waterLogs };
};

// Water intake

interface WaterLogRow {
  amount_ml: number;
  created_at: string;
}

export const getWaterLogsForDate = async (date: string): Promise<WaterLog[]> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('water_logs')
    .select('amount_ml, created_at')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data as WaterLogRow[]).map((row) => ({
    amountMl: row.amount_ml,
    loggedAt: row.created_at,
  }));
});

export const addWater = async (date: string, amountMl: number): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('water_logs')
    .insert({ user_id: userId, date, amount_ml: amountMl });

  if (error) throw error;
};

// Weight

export const getWeightEntries = async (): Promise<WeightEntry[]> => withClockSkewRetry(async () => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('weight_entries')
    .select('date, weight_kg')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) throw error;

  return (data as { date: string; weight_kg: number }[]).map((row) => ({
    date: row.date,
    weightKg: Number(row.weight_kg),
  }));
});

// Records a weigh-in (replacing any earlier one that day) and, when it's the newest,
// makes it the profile's current weight so the calorie estimate stays up to date.
export const logWeight = async (date: string, weightKg: number): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('weight_entries')
    .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' });

  if (error) throw error;

  const { data: newer, error: newerError } = await supabase
    .from('weight_entries')
    .select('date')
    .eq('user_id', userId)
    .gt('date', date)
    .limit(1);

  if (newerError) throw newerError;
  if (newer.length > 0) return;

  const { error: profileError } = await supabase
    .from('users')
    .update({ weight_kg: weightKg })
    .eq('id', userId);

  if (profileError) throw profileError;
};

// Personal foods (spec §19)

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

export const getUserFoods = async (): Promise<PersonalFood[]> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_foods')
    .select('id, nickname, foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre)')
    .eq('user_id', userId);

  if (error) throw error;

  return (data as unknown as { id: string; nickname: string | null; foods: FoodRow }[]).map((row) => ({
    id: row.id,
    foodId: row.foods.id,
    name: row.foods.name,
    nickname: row.nickname ?? row.foods.name,
    servingSize: row.foods.serving_size,
    servingUnit: row.foods.serving_unit,
    calories: row.foods.calories,
    protein: row.foods.protein,
    carbohydrate: row.foods.carbohydrate,
    fat: row.foods.fat,
    fibre: row.foods.fibre ?? undefined,
  }));
};

export const createUserFood = async (input: {
  name: string;
  nickname: string;
  servingSize: number;
  servingUnit: string;
  nutrition: NutritionReference;
}): Promise<void> => {
  const userId = await getUserId();

  const { data: food, error: foodError } = await supabase
    .from('foods')
    .insert({
      name: input.name,
      serving_size: input.servingSize,
      serving_unit: input.servingUnit,
      calories: input.nutrition.calories,
      protein: input.nutrition.protein,
      carbohydrate: input.nutrition.carbohydrate,
      fat: input.nutrition.fat,
      fibre: input.nutrition.fibre ?? null,
      source: 'user',
    })
    .select('id')
    .single();

  if (foodError) throw foodError;

  const { error: linkError } = await supabase
    .from('user_foods')
    .insert({ user_id: userId, food_id: food.id, nickname: input.nickname });

  if (linkError) throw linkError;
};

export const deleteUserFood = async (userFoodId: string): Promise<void> => {
  const { error } = await supabase.from('user_foods').delete().eq('id', userFoodId);
  if (error) throw error;
};

// Usual foods / defaults (spec §20)

export const getUserDefaults = async (): Promise<UserDefault[]> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_defaults')
    .select(
      'id, name, type, quantity, unit, food_id, foods(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre), user_default_items(id, food_id, description, quantity, unit, foods(calories, protein, carbohydrate, fat, fibre, serving_size))'
    )
    .eq('user_id', userId);

  if (error) throw error;

  return (data as any[]).map((row) => {
    if (row.type === 'meal') {
      const items: DefaultItem[] = (row.user_default_items ?? []).map((item: any) => ({
        id: item.id,
        foodId: item.food_id ?? undefined,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.foods?.calories ?? 0,
        protein: item.foods?.protein ?? 0,
        carbohydrate: item.foods?.carbohydrate ?? 0,
        fat: item.foods?.fat ?? 0,
        fibre: item.foods?.fibre ?? undefined,
      }));
      return { id: row.id, name: row.name, type: 'meal', items } as UserDefault;
    }

    return {
      id: row.id,
      name: row.name,
      type: 'food',
      foodId: row.food_id ?? undefined,
      quantity: row.quantity ?? undefined,
      unit: row.unit ?? undefined,
      nutrition: row.foods
        ? {
            calories: row.foods.calories,
            protein: row.foods.protein,
            carbohydrate: row.foods.carbohydrate,
            fat: row.foods.fat,
            fibre: row.foods.fibre ?? undefined,
          }
        : undefined,
    } as UserDefault;
  });
};

export const createFoodDefault = async (input: {
  name: string;
  foodId: string;
  quantity: number;
  unit: string;
}): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase.from('user_defaults').insert({
    user_id: userId,
    name: input.name,
    type: 'food',
    food_id: input.foodId,
    quantity: input.quantity,
    unit: input.unit,
  });
  if (error) throw error;
};

export const createMealDefault = async (input: {
  name: string;
  items: { foodId?: string; description: string; quantity: number; unit: string }[];
}): Promise<void> => {
  const userId = await getUserId();

  const { data: defaultRow, error: defaultError } = await supabase
    .from('user_defaults')
    .insert({ user_id: userId, name: input.name, type: 'meal' })
    .select('id')
    .single();

  if (defaultError) throw defaultError;

  const itemRows = input.items.map((item) => ({
    default_id: defaultRow.id,
    food_id: item.foodId ?? null,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from('user_default_items').insert(itemRows);
    if (itemsError) throw itemsError;
  }
};

export const deleteUserDefault = async (defaultId: string): Promise<void> => {
  const { error } = await supabase.from('user_defaults').delete().eq('id', defaultId);
  if (error) throw error;
};
