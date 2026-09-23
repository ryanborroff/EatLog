// Reconciles a logged quantity ("1 whole", "250 ml", "2 slices") with the unit
// a food's reference nutrition is expressed in ("per 100 g"), so that
// calculateNutrition only ever scales like-for-like. Without this, "1 egg"
// against "per 100 g" was scaled as 1 gram of egg.

type Dimension = 'mass' | 'volume';

// Factors to the base unit of each dimension (grams, millilitres). UK measures.
const MEASURED_UNITS: Record<string, { dimension: Dimension; factor: number }> = {
  mg: { dimension: 'mass', factor: 0.001 },
  g: { dimension: 'mass', factor: 1 },
  gm: { dimension: 'mass', factor: 1 },
  gram: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  kilo: { dimension: 'mass', factor: 1000 },
  kilogram: { dimension: 'mass', factor: 1000 },
  oz: { dimension: 'mass', factor: 28.3495 },
  ounce: { dimension: 'mass', factor: 28.3495 },
  lb: { dimension: 'mass', factor: 453.592 },
  pound: { dimension: 'mass', factor: 453.592 },
  ml: { dimension: 'volume', factor: 1 },
  millilitre: { dimension: 'volume', factor: 1 },
  milliliter: { dimension: 'volume', factor: 1 },
  cl: { dimension: 'volume', factor: 10 },
  l: { dimension: 'volume', factor: 1000 },
  litre: { dimension: 'volume', factor: 1000 },
  liter: { dimension: 'volume', factor: 1000 },
  'fl oz': { dimension: 'volume', factor: 28.4131 },
  pint: { dimension: 'volume', factor: 568.261 },
  tsp: { dimension: 'volume', factor: 5 },
  teaspoon: { dimension: 'volume', factor: 5 },
  tbsp: { dimension: 'volume', factor: 15 },
  tablespoon: { dimension: 'volume', factor: 15 },
  cup: { dimension: 'volume', factor: 250 },
};

/** Lowercases, trims, drops a trailing "." and a plural "s" ("Slices" -> "slice", "mls" -> "ml"). */
const normalizeUnit = (unit: string): string => {
  const text = unit.trim().toLowerCase().replace(/\.$/, '');
  return text.length > 2 && text.endsWith('s') && !text.endsWith('ss') ? text.slice(0, -1) : text;
};

const measured = (unit: string) => MEASURED_UNITS[normalizeUnit(unit)] ?? null;

export interface ConvertedQuantity {
  quantity: number;
  /** True when the conversion relied on an estimate (a per-unit weight, or treating 1 ml as 1 g). */
  approximate: boolean;
}

/**
 * Converts `quantity` of `fromUnit` into `toUnit`. `gramsPerUnit` is the
 * estimated weight of one `fromUnit` for count units ("whole", "slice") that
 * have no fixed size. Returns null when there's no sound way to convert — the
 * caller must not scale nutrition in that case.
 */
export const convertQuantity = (
  quantity: number,
  fromUnit: string,
  toUnit: string,
  gramsPerUnit?: number | null
): ConvertedQuantity | null => {
  if (normalizeUnit(fromUnit) === normalizeUnit(toUnit)) {
    return { quantity, approximate: false };
  }

  const from = measured(fromUnit);
  const to = measured(toUnit);
  const hasUnitWeight = gramsPerUnit != null && gramsPerUnit > 0;

  if (from && to) {
    const base = quantity * from.factor;
    // Mass <-> volume assumes water density: close enough for drinks, soups, milk.
    return { quantity: base / to.factor, approximate: from.dimension !== to.dimension };
  }

  // Count unit -> measured unit, e.g. 1 whole egg (50 g each) -> 50 g.
  if (!from && to && hasUnitWeight) {
    return { quantity: (quantity * gramsPerUnit) / to.factor, approximate: true };
  }

  // Measured unit -> count unit, e.g. 100 g of egg against "per 1 whole" (50 g each) -> 2.
  if (from && !to && hasUnitWeight) {
    return { quantity: (quantity * from.factor) / gramsPerUnit, approximate: true };
  }

  return null;
};
