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
}

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