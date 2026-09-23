import { ParsedFoodItem } from '../../types/foodParser';

// Rows the fake `foods` table returns by exact (lowercased) name. CoFID values, per 100 g / 100 ml.
const mockReferenceFoods: Record<string, object> = {
  egg: { id: '1', name: 'Egg', serving_size: 100, serving_unit: 'g', calories: 143, protein: 14.1, carbohydrate: 0, fat: 9.6, fibre: 0, sodium: 150, sugar: 0 },
  'black coffee': { id: '2', name: 'Black coffee', serving_size: 100, serving_unit: 'g', calories: 2, protein: 0.2, carbohydrate: 0.3, fat: 0, fibre: 0, sodium: 0, sugar: 0.3 },
  toast: { id: '3', name: 'Toast', serving_size: 100, serving_unit: 'g', calories: 250, protein: 9, carbohydrate: 48, fat: 2, fibre: 3, sodium: 400, sugar: 3 },
  beer: { id: '4', name: 'Beer', serving_size: 100, serving_unit: 'ml', calories: 30, protein: 0.3, carbohydrate: 2.2, fat: 0, fibre: 0, sodium: 6, sugar: 2.2 },
};

jest.mock('../supabaseClient', () => {
  const query = (table: string) => {
    let name = '';
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      ilike: (_column: string, value: string) => {
        name = value;
        return builder;
      },
      maybeSingle: async () => ({ data: table === 'foods' ? mockReferenceFoods[name] ?? null : null }),
    };
    return builder;
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: query,
    },
  };
});

import { resolveFoodItems } from '../foodResolver';

const parsed = (overrides: Partial<ParsedFoodItem>): ParsedFoodItem => ({
  description: 'egg',
  brand: null,
  quantity: 1,
  unit: 'whole',
  grams_per_unit: null,
  preparation: null,
  confidence: 'high',
  estimated_nutrition: null,
  ...overrides,
});

describe('resolveFoodItems unit reconciliation', () => {
  it('scales "1 whole egg" by its weight, not as 1 g (the 2 kcal egg bug)', async () => {
    const [egg] = await resolveFoodItems([parsed({ grams_per_unit: 50 })]);
    expect(egg.calories).toBeCloseTo(71.5);
    expect(egg.confidence).toBe('medium');
    expect(egg.unresolved).toBeUndefined();
  });

  it('treats 250 ml of coffee as 250 g against a per-100 g reference', async () => {
    const [coffee] = await resolveFoodItems([parsed({ description: 'black coffee', quantity: 250, unit: 'ml' })]);
    expect(coffee.calories).toBe(5);
  });

  it('scales 2 slices of toast by slice weight', async () => {
    const [toast] = await resolveFoodItems([parsed({ description: 'toast', quantity: 2, unit: 'slices', grams_per_unit: 36 })]);
    expect(toast.calories).toBe(180);
  });

  it('converts a pint exactly against a per-100 ml reference', async () => {
    const [beer] = await resolveFoodItems([parsed({ description: 'beer', quantity: 1, unit: 'pint' })]);
    expect(beer.calories).toBeCloseTo(170.5, 0);
    expect(beer.confidence).toBe('high');
    expect(beer.estimated).toBe(false);
  });

  it('falls back to the AI estimate when the reference unit cannot be reconciled', async () => {
    const [egg] = await resolveFoodItems([
      parsed({
        estimated_nutrition: { serving_size: 1, serving_unit: 'whole', calories: 72, protein: 6.3, carbohydrate: 0.4, fat: 4.8, fibre: 0, sodium: 70, sugar: 0.2 },
      }),
    ]);
    expect(egg.calories).toBe(72);
    expect(egg.estimated).toBe(true);
  });

  it('marks the item unresolved instead of logging a wrong number when nothing converts', async () => {
    const [egg] = await resolveFoodItems([parsed({})]);
    expect(egg.unresolved).toBe(true);
  });
});
