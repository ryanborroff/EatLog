// Shared shape for the food parser's output, and a runtime validator so the
// Edge Function never trusts unvalidated model output (spec §34/§36) — this
// matters more than usual since the model (Groq/Llama) is only asked for
// plain JSON mode, not a provider-enforced schema.
//
// A discriminated union on `intent`: `log_food` (the original Stage 3 shape)
// or `correction` (a set of operations against a recent meal the client
// supplies as context — see index.ts's `recentMeal`).

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export const OPERATION_TYPES = [
  'replace_item',
  'remove_item',
  'add_item',
  'update_quantity',
  'change_meal_type',
] as const;

export type MealType = (typeof MEAL_TYPES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export type OperationType = (typeof OPERATION_TYPES)[number];

export interface ParsedFoodItem {
  description: string;
  brand: string | null;
  quantity: number;
  unit: string;
  grams_per_unit: number | null;
  preparation: string | null;
  confidence: ConfidenceLevel;
  estimated_nutrition: {
    serving_size: number;
    serving_unit: string;
    calories: number;
    protein: number;
    carbohydrate: number;
    fat: number;
    fibre: number | null;
    sodium: number | null;
    sugar: number | null;
  } | null;
}

export interface CorrectionOperation {
  type: OperationType;
  target_description: string | null;
  item: ParsedFoodItem | null;
  new_quantity: number | null;
  new_unit: string | null;
  meal_type: MealType | null;
}

export interface ParsedFoodResult {
  intent: 'log_food' | 'correction';
  meal_type: MealType | null;
  items: ParsedFoodItem[] | null;
  operations: CorrectionOperation[] | null;
  needs_clarification: boolean;
  clarification_question: string | null;
  clarification_options: string[] | null;
}

const isConfidence = (v: unknown): v is ConfidenceLevel => CONFIDENCE_LEVELS.includes(v as ConfidenceLevel);

const isPositiveNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Validates one item, repairing what can be repaired rather than failing the
 * whole parse over one sloppy field (a multi-item meal gives the model many
 * chances to slip). Returns null only when the item has no usable description.
 */
function validateItem(raw: unknown): ParsedFoodItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  if (!isNonEmptyString(item.description)) return null;

  let estimated_nutrition: ParsedFoodItem['estimated_nutrition'] = null;
  const n = item.estimated_nutrition as Record<string, unknown> | null | undefined;
  const nutritionIsValid =
    typeof n === 'object' &&
    n !== null &&
    (['serving_size', 'calories', 'protein', 'carbohydrate', 'fat'] as const).every(
      (field) => typeof n[field] === 'number' && Number.isFinite(n[field] as number)
    ) &&
    isPositiveNumber(n.serving_size) &&
    isNonEmptyString(n.serving_unit);

  if (nutritionIsValid) {
    estimated_nutrition = {
      serving_size: n.serving_size as number,
      serving_unit: n.serving_unit as string,
      calories: n.calories as number,
      protein: n.protein as number,
      carbohydrate: n.carbohydrate as number,
      fat: n.fat as number,
      fibre: typeof n.fibre === 'number' ? n.fibre : null,
      sodium: typeof n.sodium === 'number' ? n.sodium : null,
      sugar: typeof n.sugar === 'number' ? n.sugar : null,
    };
  }

  // A missing/zero quantity or unit falls back to one of the model's own
  // estimated servings (a typical portion), and failing that to "1 serving".
  // Either way the amount was guessed, so confidence drops to low.
  const quantityIsValid = isPositiveNumber(item.quantity);
  const unitIsValid = isNonEmptyString(item.unit);
  const unit = unitIsValid ? (item.unit as string) : estimated_nutrition?.serving_unit ?? 'serving';
  // The serving size only makes sense as a quantity in the serving's own unit.
  const servingMatchesUnit =
    estimated_nutrition !== null && estimated_nutrition.serving_unit.trim().toLowerCase() === unit.trim().toLowerCase();
  const quantity = quantityIsValid
    ? (item.quantity as number)
    : servingMatchesUnit
      ? estimated_nutrition!.serving_size
      : 1;
  const confidence: ConfidenceLevel =
    quantityIsValid && unitIsValid && isConfidence(item.confidence) ? item.confidence : 'low';

  return {
    description: item.description,
    brand: typeof item.brand === 'string' ? item.brand : null,
    quantity,
    unit,
    // Optional hint: a missing or nonsensical weight just means the client can't
    // convert count units for this item, so drop it rather than reject the parse.
    grams_per_unit:
      typeof item.grams_per_unit === 'number' && Number.isFinite(item.grams_per_unit) && item.grams_per_unit > 0
        ? item.grams_per_unit
        : null,
    preparation: typeof item.preparation === 'string' ? item.preparation : null,
    confidence,
    estimated_nutrition,
  };
}

/** Runtime validation of parsed model output before it ever leaves the function. */
export function validateParsedFoodResult(value: unknown): ParsedFoodResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Parsed result is not an object');
  }
  const v = value as Record<string, unknown>;

  if (v.intent !== 'log_food' && v.intent !== 'correction') {
    throw new Error('Invalid intent');
  }
  if (typeof v.needs_clarification !== 'boolean') {
    throw new Error('needs_clarification is not a boolean');
  }

  const needs_clarification = v.needs_clarification;
  const clarification_question = typeof v.clarification_question === 'string' ? v.clarification_question : null;
  const clarification_options = Array.isArray(v.clarification_options)
    ? v.clarification_options.filter((o): o is string => typeof o === 'string')
    : null;

  if (v.intent === 'log_food') {
    if (!MEAL_TYPES.includes(v.meal_type as MealType)) {
      throw new Error('Invalid meal_type');
    }
    if (!Array.isArray(v.items)) {
      throw new Error('items is not an array');
    }
    const items = v.items.map(validateItem).filter((item): item is ParsedFoodItem => item !== null);
    if (v.items.length > 0 && items.length === 0) {
      throw new Error('No item had a usable description');
    }

    return {
      intent: 'log_food',
      meal_type: v.meal_type as MealType,
      items,
      operations: null,
      needs_clarification,
      clarification_question,
      clarification_options,
    };
  }

  if (!Array.isArray(v.operations)) {
    throw new Error('operations is not an array');
  }

  const operations: CorrectionOperation[] = v.operations.map((raw, i) => {
    const op = raw as Record<string, unknown>;
    if (!OPERATION_TYPES.includes(op.type as OperationType)) {
      throw new Error(`operations[${i}].type is invalid`);
    }
    return {
      type: op.type as OperationType,
      target_description: typeof op.target_description === 'string' ? op.target_description : null,
      item: validateItem(op.item),
      new_quantity: typeof op.new_quantity === 'number' ? op.new_quantity : null,
      new_unit: typeof op.new_unit === 'string' ? op.new_unit : null,
      meal_type: MEAL_TYPES.includes(op.meal_type as MealType) ? (op.meal_type as MealType) : null,
    };
  });

  return {
    intent: 'correction',
    meal_type: null,
    items: null,
    operations,
    needs_clarification,
    clarification_question,
    clarification_options,
  };
}
