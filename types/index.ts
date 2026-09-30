export interface FoodItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
  sodium?: number;
  sugar?: number;
  confidence: 'high' | 'medium' | 'low';
  estimated: boolean;
  /** Where the nutrition came from. Unset for items logged before this was recorded. */
  source?: FoodSource;
  /** The foods-table row the nutrition came from, when there was one. */
  foodId?: string;
  /** True when the user gave no amount and a typical portion was assumed. */
  portionAssumed?: boolean;
}

/**
 * personal_food / saved_default: the user's own foods. reference: the shared
 * foods table (CoFID). ai_estimate: the parser's own numbers, with no
 * database match. barcode: Open Food Facts. food_search: picked by hand from
 * the foods table.
 */
export type FoodSource = 'personal_food' | 'saved_default' | 'reference' | 'ai_estimate' | 'barcode' | 'food_search';

export interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbohydrate: number;
  totalFat: number;
  totalFibre: number;
  totalSodium: number;
  totalSugar: number;
  /** ISO timestamp of when this meal was logged — set automatically by the database. */
  loggedAt: string;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre: number;
  sodium: number;
  sugar: number;
  water: number;
}

export interface DailyGoals {
  calories: number;
  protein: number;
  carbohydrate?: number;
  fat?: number;
  fibre?: number;
}

export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface UserProfile {
  sex?: Sex;
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
}

export interface WaterLog {
  amountMl: number;
  /** ISO timestamp of when this water entry was logged — set automatically by the database. */
  loggedAt: string;
}

export interface WeightEntry {
  /** UTC day key (YYYY-MM-DD), same as DayEntry.date. */
  date: string;
  weightKg: number;
}

export interface DayEntry {
  date: string;
  meals: Meal[];
  totals: DailyTotals;
  waterLogs: WaterLog[];
}

export interface NutritionReference {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
  sodium?: number;
  sugar?: number;
}

export interface PersonalFood extends NutritionReference {
  id: string;
  foodId: string;
  name: string;
  nickname: string;
  servingSize: number;
  servingUnit: string;
}

export interface DefaultItem extends NutritionReference {
  id: string;
  foodId?: string;
  description: string;
  quantity: number;
  unit: string;
}

export interface UserDefault {
  id: string;
  name: string;
  type: 'food' | 'meal';
  // 'food' defaults use these directly; 'meal' defaults ignore them and use `items`.
  foodId?: string;
  quantity?: number;
  unit?: string;
  nutrition?: NutritionReference;
  items?: DefaultItem[];
}