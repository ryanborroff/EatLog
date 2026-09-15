// Pure arithmetic: quantity x per-reference-unit nutrition. The AI never
// computes final numbers (spec §14/§36) — this is the one place that does.

export interface ReferenceNutrition {
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
  sodium?: number;
  sugar?: number;
}

export interface CalculatedNutrition {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre?: number;
  sodium?: number;
  sugar?: number;
}

const round = (value: number): number => Math.ceil(value * 10) / 10;

/**
 * Scales a food's reference nutrition (e.g. "per 100g") to a requested quantity.
 * Assumes quantity and reference are already in compatible units (the resolver
 * is responsible for unit reconciliation) — this function is deliberately unit-agnostic.
 */
export const calculateNutrition = (
  reference: ReferenceNutrition,
  quantity: number
): CalculatedNutrition => {
  const scale = reference.servingSize > 0 ? quantity / reference.servingSize : 0;

  return {
    calories: round(reference.calories * scale),
    protein: round(reference.protein * scale),
    carbohydrate: round(reference.carbohydrate * scale),
    fat: round(reference.fat * scale),
    fibre: reference.fibre !== undefined ? round(reference.fibre * scale) : undefined,
    sodium: reference.sodium !== undefined ? round(reference.sodium * scale) : undefined,
    sugar: reference.sugar !== undefined ? round(reference.sugar * scale) : undefined,
  };
};
