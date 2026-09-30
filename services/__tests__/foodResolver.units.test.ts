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
  brownie: mockFood('Brownies, chocolate, homemade', 'g', 506),
  oats: mockFood('Porridge oats, unfortified', 'g', 381),
  'porridge with water': mockFood('Porridge, made with water', 'g', 47),
  pasta: mockFood('Pasta, white, dried, boiled in unsalted water', 'g', 169),
  'dry pasta': mockFood('Pasta, white, dried, raw', 'g', 343),
  rice: mockFood('Rice, white, long grain, boiled in unsalted water', 'g', 131),
  'dry rice': mockFood('Rice, white, long grain, raw', 'g', 355),
  'egg fried rice': mockFood('Rice, egg fried, takeaway', 'g', 186),
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

  it('finds "-ies" plurals whose singular ends in "-ie" ("brownies" -> "brownie")', async () => {
    const [brownies] = await resolveFoodItems([parsed({ description: 'Brownies', quantity: 50, unit: 'g' })]);
    expect(brownies.calories).toBe(253);
    expect(brownies.unresolved).toBeUndefined();
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

describe('resolveFoodItems volume measures', () => {
  it('weighs a cup of oats by its density, not as 250 g of water', async () => {
    const [oats] = await resolveFoodItems([parsed({ description: 'Oats', quantity: 1, unit: 'cup' })]);
    // 250 ml x 0.36 g/ml = 90 g -> 342.9 kcal (was 952.5)
    expect(oats.calories).toBeCloseTo(342.9, 0);
    expect(oats.estimated).toBe(true);
  });

  it("uses the AI's weight for a spoon measure of a food with no known density", async () => {
    const [brownie] = await resolveFoodItems([
      parsed({ description: 'Brownies', quantity: 2, unit: 'tbsp', grams_per_unit: 10 }),
    ]);
    expect(brownie.calories).toBeCloseTo(101.2, 0);
  });

  it('still treats a drink as water when measured by volume', async () => {
    const [coffee] = await resolveFoodItems([parsed({ description: 'black coffee', quantity: 1, unit: 'cup' })]);
    expect(coffee.calories).toBe(5);
  });
});

describe('resolveFoodItems dry vs cooked grains', () => {
  it('reads a small weight of pasta as dry', async () => {
    const [pasta] = await resolveFoodItems([parsed({ description: 'Pasta', quantity: 100, unit: 'g' })]);
    expect(pasta.calories).toBe(343);
    expect(pasta.confidence).toBe('medium');
    expect(pasta.estimated).toBe(true);
  });

  it('reads a large weight of pasta as cooked, but flags the guess', async () => {
    const [pasta] = await resolveFoodItems([parsed({ description: 'Pasta', quantity: 250, unit: 'g' })]);
    expect(pasta.calories).toBeCloseTo(422.5);
    expect(pasta.confidence).toBe('medium');
  });

  it('follows what the user said over the weight', async () => {
    const [dry] = await resolveFoodItems([parsed({ description: 'Uncooked rice', quantity: 200, unit: 'g' })]);
    expect(dry.calories).toBe(710);
    expect(dry.confidence).toBe('high');

    const [cooked] = await resolveFoodItems([
      parsed({ description: 'Rice', preparation: 'cooked', quantity: 100, unit: 'g' }),
    ]);
    expect(cooked.calories).toBe(131);
    expect(cooked.confidence).toBe('high');
  });

  it('leaves fried rice alone — it is never weighed dry', async () => {
    const [rice] = await resolveFoodItems([parsed({ description: 'Egg fried rice', quantity: 100, unit: 'g' })]);
    expect(rice.calories).toBe(186);
    expect(rice.confidence).toBe('high');
  });

  it('reads a bowl of oats as porridge, weighed as eaten', async () => {
    const [oats] = await resolveFoodItems([
      parsed({ description: 'Oats', quantity: 1, unit: 'bowl', grams_per_unit: 250 }),
    ]);
    expect(oats.calories).toBeCloseTo(117.5);
  });

  it('keeps weighed oats dry', async () => {
    const [oats] = await resolveFoodItems([parsed({ description: 'Oats', quantity: 40, unit: 'g' })]);
    expect(oats.calories).toBeCloseTo(152.4);
    expect(oats.confidence).toBe('high');
  });
});
