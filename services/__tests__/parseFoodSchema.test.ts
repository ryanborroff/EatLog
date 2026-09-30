import { validateParsedFoodResult } from '../../supabase/functions/parse-food/schema';

const result = (item: Record<string, unknown>) => ({
  intent: 'log_food',
  meal_type: 'dinner',
  items: [
    {
      description: 'Chicken stir fry',
      brand: null,
      quantity: 1,
      unit: 'plate',
      quantity_source: 'stated',
      grams_per_unit: 400,
      preparation: null,
      confidence: 'medium',
      estimated_nutrition: null,
      ...item,
    },
  ],
  operations: null,
  needs_clarification: false,
  clarification_question: null,
  clarification_options: null,
});

const ingredientsOf = (item: Record<string, unknown>) => {
  const parsed = validateParsedFoodResult(result(item));
  return parsed.items![0].ingredients;
};

describe('parse-food ingredients validation', () => {
  it('keeps well-formed ingredients', () => {
    expect(
      ingredientsOf({
        ingredients: [
          { description: 'chicken breast', grams: 150, preparation: 'fried' },
          { description: 'egg noodles', grams: 200, preparation: 'boiled' },
          { description: 'vegetable oil', grams: 10, preparation: null },
        ],
      })
    ).toHaveLength(3);
  });

  it('drops malformed ingredients and treats one-or-none as no breakdown', () => {
    expect(
      ingredientsOf({
        ingredients: [
          { description: 'chicken', grams: 150, preparation: null },
          { description: '', grams: 100, preparation: null },
          { description: 'rice', grams: 0, preparation: null },
        ],
      })
    ).toBeNull();
  });

  it('treats a missing field as no breakdown (older model output)', () => {
    expect(ingredientsOf({})).toBeNull();
  });

  it('caps a runaway list', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ description: `thing ${i}`, grams: 10, preparation: null }));
    expect(ingredientsOf({ ingredients: many })).toHaveLength(8);
  });
});
