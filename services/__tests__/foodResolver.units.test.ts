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
  guinness: mockFood('Stout, Guinness', 'ml', 37),
  strawberry: mockFood('Strawberries, raw', 'g', 30),
  brownie: mockFood('Brownies, chocolate, homemade', 'g', 506),
  oats: mockFood('Porridge oats, unfortified', 'g', 381),
  'porridge with water': mockFood('Porridge, made with water', 'g', 47),
  pasta: mockFood('Pasta, white, dried, boiled in unsalted water', 'g', 169),
  'dry pasta': mockFood('Pasta, white, dried, raw', 'g', 343),
  rice: mockFood('Rice, white, long grain, boiled in unsalted water', 'g', 131),
  'dry rice': mockFood('Rice, white, long grain, raw', 'g', 355),
  'egg fried rice': mockFood('Rice, egg fried, takeaway', 'g', 186),
  chicken: mockFood('Chicken, breast, grilled without skin, meat only', 'g', 148),
  'fried chicken': mockFood('Chicken pieces, coated, takeaway', 'g', 272),
  'deep fried chicken': mockFood('Chicken pieces, coated, takeaway', 'g', 272),
  chips: mockFood('Potato chips, fried in commercial oil, from takeaway fish and chip shops', 'g', 204),
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

const mockMatchFoods = jest.fn();
jest.mock('../foodMatcher', () => ({ matchFoods: (...args: unknown[]) => mockMatchFoods(...args) }));

import { resolveFoodItems } from '../foodResolver';

beforeEach(() => {
  mockMatchFoods.mockReset();
  mockMatchFoods.mockResolvedValue(new Map());
});

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

describe('resolveFoodItems preparation', () => {
  const buttered = {
    serving_size: 1, serving_unit: 'slice', calories: 110, protein: 3, carbohydrate: 13, fat: 5, fibre: 1, sodium: 150, sugar: 1,
  };

  it('uses the fried alias for fried chicken', async () => {
    const [chicken] = await resolveFoodItems([parsed({ description: 'Chicken', preparation: 'fried', quantity: 200, unit: 'g' })]);
    expect(chicken.calories).toBe(544);
  });

  it('finds the alias whatever the hyphenation ("deep-fried")', async () => {
    const [chicken] = await resolveFoodItems([
      parsed({ description: 'Chicken', preparation: 'deep-fried', quantity: 100, unit: 'g' }),
    ]);
    expect(chicken.calories).toBe(272);
  });

  it('never falls back from a fat-adding preparation to the plain food', async () => {
    const [toast] = await resolveFoodItems([
      parsed({ description: 'Toast', preparation: 'buttered', quantity: 2, unit: 'slice', grams_per_unit: 36, estimated_nutrition: buttered }),
    ]);
    // The AI's buttered-toast estimate, not 180 kcal of dry toast.
    expect(toast.calories).toBe(220);
    expect(toast.source).toBe('ai_estimate');
  });

  it('keeps the plain food when it was already prepared that way ("fried" chips)', async () => {
    const [chips] = await resolveFoodItems([parsed({ description: 'Chips', preparation: 'fried', quantity: 100, unit: 'g' })]);
    expect(chips.calories).toBe(204);
  });

  it('keeps the plain food for preparations that add no fat', async () => {
    const [chicken] = await resolveFoodItems([parsed({ description: 'Chicken', preparation: 'grilled', quantity: 100, unit: 'g' })]);
    expect(chicken.calories).toBe(148);
  });
});

describe('resolveFoodItems portion guesses', () => {
  it('flags an item whose amount the parser assumed', async () => {
    const [pasta] = await resolveFoodItems([
      parsed({ description: 'Pasta', quantity: 250, unit: 'g', quantity_source: 'assumed' }),
    ]);
    expect(pasta.portionAssumed).toBe(true);
  });

  it('does not flag stated or rough amounts', async () => {
    const [stated, vague] = await resolveFoodItems([
      parsed({ description: 'Pasta', quantity: 250, unit: 'g', quantity_source: 'stated' }),
      parsed({ description: 'Rice', quantity: 200, unit: 'g', quantity_source: 'vague' }),
    ]);
    expect(stated.portionAssumed).toBeUndefined();
    expect(vague.portionAssumed).toBeUndefined();
  });
});

describe('resolveFoodItems source', () => {
  it('records the reference food it matched', async () => {
    const [egg] = await resolveFoodItems([parsed({ grams_per_unit: 50 })]);
    expect(egg.source).toBe('reference');
    expect(egg.foodId).toBe('Eggs, chicken, whole, boiled');
  });

  it('records an AI estimate, with no food row', async () => {
    const [egg] = await resolveFoodItems([
      parsed({
        estimated_nutrition: { serving_size: 1, serving_unit: 'whole', calories: 72, protein: 6.3, carbohydrate: 0.4, fat: 4.8, fibre: 0, sodium: 70, sugar: 0.2 },
      }),
    ]);
    expect(egg.source).toBe('ai_estimate');
    expect(egg.foodId).toBeUndefined();
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

describe('resolveFoodItems AI estimate checks', () => {
  const curry = (nutrition: Partial<NonNullable<ParsedFoodItem['estimated_nutrition']>>) =>
    parsed({
      description: 'Katsu curry',
      quantity: 350,
      unit: 'g',
      confidence: 'high',
      estimated_nutrition: {
        serving_size: 100, serving_unit: 'g', calories: 150, protein: 6, carbohydrate: 20, fat: 5, fibre: null, sodium: null, sugar: null,
        ...nutrition,
      },
    });

  it('never rates an AI estimate as high confidence', async () => {
    const [item] = await resolveFoodItems([curry({})]);
    expect(item.calories).toBe(525);
    expect(item.confidence).toBe('medium');
    expect(item.source).toBe('ai_estimate');
  });

  it('marks an estimate whose calories and macros disagree as low confidence', async () => {
    const [item] = await resolveFoodItems([curry({ calories: 320 })]);
    expect(item.confidence).toBe('low');
    expect(item.unresolved).toBeUndefined();
  });

  it('throws out an impossible estimate instead of logging it', async () => {
    const [item] = await resolveFoodItems([curry({ calories: 1500, fat: 160, protein: 0, carbohydrate: 0 })]);
    expect(item.unresolved).toBe(true);
  });

  it('ignores an absurd per-unit weight', async () => {
    const [egg] = await resolveFoodItems([parsed({ grams_per_unit: 50000 })]);
    expect(egg.unresolved).toBe(true);
  });
});

describe('resolveFoodItems matched foods', () => {
  const cofid = (name: string, calories: number) => ({ ...mockFood(name, 'g', calories), source: 'cofid' as const });
  const estimate = { serving_size: 100, serving_unit: 'g', calories: 150, protein: 6, carbohydrate: 20, fat: 5, fibre: null, sodium: null, sugar: null };

  it('only asks match-food about items the aliases missed', async () => {
    await resolveFoodItems([parsed({ description: 'toast', quantity: 2, unit: 'slices', grams_per_unit: 36 }), parsed({ description: 'Tikka masala', quantity: 300, unit: 'g' })]);
    expect(mockMatchFoods).toHaveBeenCalledTimes(1);
    expect(mockMatchFoods.mock.calls[0][0]).toEqual([
      { key: '1', description: 'Tikka masala', preparation: null, brand: null },
    ]);
  });

  it('uses the reference food match-food picked, over the AI estimate', async () => {
    mockMatchFoods.mockResolvedValue(new Map([['0', cofid('Curry, chicken tikka masala, retail, reheated', 140)]]));
    const [curry] = await resolveFoodItems([
      parsed({ description: 'Chicken tikka masala', quantity: 300, unit: 'g', estimated_nutrition: estimate }),
    ]);
    expect(curry.calories).toBe(420);
    expect(curry.source).toBe('reference');
    expect(curry.foodId).toBe('Curry, chicken tikka masala, retail, reheated');
    expect(curry.confidence).toBe('medium');
  });

  it('uses a branded product with no food id', async () => {
    const { id: _id, ...beans } = mockFood('Heinz Beanz', 'g', 81);
    mockMatchFoods.mockResolvedValue(new Map([['0', { ...beans, id: null, source: 'open_food_facts' }]]));
    const [item] = await resolveFoodItems([
      parsed({ description: 'Beanz', brand: 'Heinz', quantity: 200, unit: 'g' }),
    ]);
    expect(item.calories).toBe(162);
    expect(item.source).toBe('open_food_facts');
    expect(item.foodId).toBeUndefined();
  });

  it('falls back to the AI estimate when any ingredient is not found', async () => {
    // Only the noodles match; the fried egg isn't an alias (plain "egg" would drop the frying) and isn't matched.
    mockMatchFoods.mockResolvedValue(new Map([['0.1', cofid('Noodles, egg, medium, dried, boiled in unsalted water', 166)]]));
    const [dish] = await resolveFoodItems([
      parsed({
        description: 'Egg noodle stir fry',
        quantity: 1,
        unit: 'plate',
        grams_per_unit: 350,
        estimated_nutrition: estimate,
        ingredients: [
          { description: 'egg', grams: 100, preparation: 'fried' },
          { description: 'noodles', grams: 250, preparation: null },
        ],
      }),
    ]);
    const keys = mockMatchFoods.mock.calls[0][0].map((q: { key: string }) => q.key).sort();
    expect(keys).toEqual(['0', '0.0', '0.1']);
    expect(dish.source).toBe('ai_estimate');
    expect(dish.calories).toBe(525);
  });

  it('builds the dish when all ingredients resolve', async () => {
    mockMatchFoods.mockResolvedValue(new Map([['0.1', cofid('Noodles, egg, medium, dried, boiled in unsalted water', 166)]]));
    const [dish] = await resolveFoodItems([
      parsed({
        description: 'Egg noodle stir fry',
        quantity: 1,
        unit: 'plate',
        grams_per_unit: 350,
        estimated_nutrition: estimate,
        ingredients: [
          { description: 'egg', grams: 100, preparation: null },
          { description: 'noodles', grams: 250, preparation: null },
        ],
      }),
    ]);
    // 100 g egg at 143 + 250 g noodles at 166 per 100 g
    expect(dish.calories).toBeCloseTo(558, 0);
    expect(dish.source).toBe('ingredients');
    expect(dish.estimated).toBe(true);
    expect(dish.confidence).toBe('medium');
  });

  it('falls back to the AI estimate when matching is unavailable', async () => {
    const [curry] = await resolveFoodItems([
      parsed({ description: 'Katsu curry', quantity: 200, unit: 'g', estimated_nutrition: estimate }),
    ]);
    expect(curry.calories).toBe(300);
    expect(curry.source).toBe('ai_estimate');
  });
});

describe('resolveFoodItems dry-or-cooked options', () => {
  it('offers both versions of a grain weighed without saying which, keeping the guess', async () => {
    const [pasta] = await resolveFoodItems([parsed({ description: 'Pasta', quantity: 100, unit: 'g', quantity_source: 'stated' })]);
    expect(pasta.calories).toBe(343);
    expect(pasta.cookingOptions).toMatchObject({
      guess: 'dry',
      dry: { calories: 343, foodId: 'Pasta, white, dried, raw' },
      cooked: { calories: 169, foodId: 'Pasta, white, dried, boiled in unsalted water' },
    });

    const [rice] = await resolveFoodItems([parsed({ description: 'Rice', quantity: 200, unit: 'g', quantity_source: 'stated' })]);
    expect(rice.cookingOptions?.guess).toBe('cooked');
    expect(rice.calories).toBe(262);
  });

  it("doesn't ask when the user said dry or cooked", async () => {
    const [dry] = await resolveFoodItems([parsed({ description: 'Pasta', preparation: 'dry', quantity: 100, unit: 'g' })]);
    const [cooked] = await resolveFoodItems([parsed({ description: 'Cooked rice', quantity: 100, unit: 'g' })]);
    expect(dry.cookingOptions).toBeUndefined();
    expect(cooked.cookingOptions).toBeUndefined();
  });

  it("treats a weight the parser assumed as cooked, and doesn't ask", async () => {
    const [pasta] = await resolveFoodItems([parsed({ description: 'Pasta', quantity: 100, unit: 'g', quantity_source: 'assumed' })]);
    expect(pasta.calories).toBe(169);
    expect(pasta.cookingOptions).toBeUndefined();
  });

  it("doesn't ask without a weight", async () => {
    const [pasta] = await resolveFoodItems([parsed({ description: 'Pasta', quantity: 1, unit: 'bowl', grams_per_unit: 250 })]);
    expect(pasta.cookingOptions).toBeUndefined();
  });
});

describe('resolveFoodItems drinks', () => {
  it('counts a pint of Guinness as the regular stout (~210 kcal), not an alcohol-free version', async () => {
    const [guinness] = await resolveFoodItems([
      parsed({ description: 'Guinness', brand: 'Guinness', quantity: 1, unit: 'pint' }),
    ]);
    expect(guinness.calories).toBeCloseTo(210.3, 0);
    expect(guinness.source).toBe('reference');
    // Found by name, so nothing goes to match-food (and its branded products).
    expect(mockMatchFoods).toHaveBeenCalledWith([]);
  });
});
