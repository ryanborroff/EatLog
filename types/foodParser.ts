// Mirrors supabase/functions/parse-food/schema.ts (kept as a separate copy
// since Edge Functions run on Deno and can't share an import with the RN app).

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface EstimatedNutrition {
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre: number | null;
}

export interface ParsedFoodItem {
  description: string;
  brand: string | null;
  quantity: number;
  unit: string;
  preparation: string | null;
  confidence: ConfidenceLevel;
  estimated_nutrition: EstimatedNutrition | null;
}

export interface LogFoodResult {
  intent: 'log_food';
  meal_type: MealType;
  items: ParsedFoodItem[];
  needs_clarification: boolean;
  clarification_question: string | null;
  clarification_options: string[] | null;
}

export type OperationType = 'replace_item' | 'remove_item' | 'add_item' | 'update_quantity' | 'change_meal_type';

// Matches the wire shape from supabase/functions/parse-food/schema.ts exactly:
// OpenAI structured outputs require every field present with nullable types,
// so this is flat rather than a per-variant discriminated union.
export interface CorrectionOperation {
  type: OperationType;
  target_description: string | null;
  item: ParsedFoodItem | null;
  new_quantity: number | null;
  new_unit: string | null;
  meal_type: MealType | null;
}

export interface CorrectionResult {
  intent: 'correction';
  operations: CorrectionOperation[];
  needs_clarification: boolean;
  clarification_question: string | null;
  clarification_options: string[] | null;
}

export type ParsedFoodResult = LogFoodResult | CorrectionResult;

/** Minimal context about the day's most recent meal, sent so the AI can recognize corrections against it. */
export interface RecentMealContext {
  mealType: MealType;
  items: { description: string; quantity: number; unit: string }[];
}

/** Result of resolving one parsed item against the foods table or an AI estimate. */
export interface ResolvedFoodItem {
  description: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
  confidence: ConfidenceLevel;
  estimated: boolean;
  /** True when nothing—reference DB, personal food, nor a usable AI estimate—could identify this item. */
  unresolved?: boolean;
}
