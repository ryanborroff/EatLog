import { FoodItem } from '../../types';
import { applyCookingChoices, cookingQuestions } from '../cookingFollowUp';

const pasta = (overrides: Partial<FoodItem> = {}): FoodItem => ({
  id: '0',
  description: 'Pasta',
  quantity: 100,
  unit: 'g',
  calories: 343,
  protein: 11.3,
  carbohydrate: 75.6,
  fat: 1.6,
  confidence: 'medium',
  estimated: true,
  source: 'reference',
  foodId: 'dry-pasta',
  cookingOptions: {
    guess: 'dry',
    dry: { calories: 343, protein: 11.3, carbohydrate: 75.6, fat: 1.6, foodId: 'dry-pasta' },
    cooked: { calories: 169, protein: 5.5, carbohydrate: 37.2, fat: 0.8, fibre: 2.5, foodId: 'cooked-pasta' },
  },
  ...overrides,
});

describe('cookingQuestions', () => {
  it('asks about items that could be either, with both calorie counts', () => {
    const [question] = cookingQuestions([pasta(), pasta({ id: '1', cookingOptions: undefined })]);
    expect(question.itemId).toBe('0');
    expect(question.options).toEqual([
      { choice: 'dry', label: 'Dry', calories: 343 },
      { choice: 'cooked', label: 'Cooked', calories: 169 },
    ]);
  });
});

describe('applyCookingChoices', () => {
  it("switches to the chosen version, which isn't a guess any more", () => {
    const [item] = applyCookingChoices([pasta()], { '0': 'cooked' });
    expect(item).toMatchObject({ calories: 169, fibre: 2.5, foodId: 'cooked-pasta', confidence: 'high', estimated: false });
    expect(item.cookingOptions).toBeUndefined();
  });

  it('keeps the guess, still marked as estimated, when unanswered', () => {
    const [item] = applyCookingChoices([pasta()], {});
    expect(item).toMatchObject({ calories: 343, confidence: 'medium', estimated: true });
    expect(item.cookingOptions).toBeUndefined();
  });
});
