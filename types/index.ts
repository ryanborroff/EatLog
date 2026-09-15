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
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

export interface DailyGoals {
  calories: number;
  protein: number;
  carbohydrate?: number;
  fat?: number;
}

export interface DayEntry {
  date: string;
  meals: Meal[];
  totals: DailyTotals;
}

export interface NutritionReference {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
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