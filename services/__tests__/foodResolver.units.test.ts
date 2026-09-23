import { ParsedFoodItem } from '../../types/foodParser';

// Fake reference data: CoFID-style foods (per 100 g / 100 ml) reachable only via
// their everyday aliases, as in production.
const mockFood = (name: string, serving_unit: string, calories: number) => ({
  id: name, name, serving_size: 100, serving_unit, calories, protein: 1, carbohydrate: 1, fat: 1, fibre: 0, sodium: 0, sugar: 0,
});
const mockAliases: Record<string, object> = {
  egg: mockFood('Eggs, chicken, whole, boiled', 'g', 143),
  'scrambled egg': mockFood('Eggs, chicken, scrambled, with semi-skimmed milk', 'g', 237),
  'black coffee': mockFood('Coffee, infusion, average', 'g', 2),
  toast: mockFood('Bread, white, toasted', 'g', 250),
  beer: mockFood('Beer, bitter, average (<4% ABV)', 'ml', 30),
  strawberry: mockFood('Strawberries, raw', 'g', 30),
};

jest.mock('../supabaseClient', () => {
  const query = (table: string) => {
    let aliases: string[] = [];
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      ilike: () => builder,
      // No CoFID food is ever named "egg", so exact-name/personal/default lookups miss.
      maybeSingle: async () => ({ data: null }),
      in: (_column: string, values: string[]) => {
        aliases = values;
        return builder;
      },
      then: (resolve: (value: unknown) => void) =>
        resolve({
          data:
            table === 'food_aliases'
              ? aliases.filter((alias) => mockAliases[alias]).map((alias) => ({ alias, foods: mockAliases[alias] }))
              : null,
        }),
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

  it('finds a food by its alias in singular form ("strawberries" -> "strawberry")', async () => {
    const [berries] = await resolveFoodItems([parsed({ description: 'Strawberries', quantity: 150, unit: 'g' })]);
    expect(berries.calories).toBe(45);
    expect(berries.unresolved).toBeUndefined();
  });

  it('prefers the preparation-specific alias ("scrambled" + "eggs")', async () => {
    const [eggs] = await resolveFoodItems([
      parsed({ description: 'Eggs', preparation: 'scrambled', quantity: 2, grams_per_unit: 60 }),
    ]);
    expect(eggs.calories).toBeCloseTo(284.4);
  });

  it('marks the item unresolved instead of logging a wrong number when nothing converts', async () => {
    const [egg] = await resolveFoodItems([parsed({})]);
    expect(egg.unresolved).toBe(true);
  });
});
