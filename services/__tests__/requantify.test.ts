import { FoodItem } from '../../types';
import { ResolvedFoodItem } from '../../types/foodParser';

const mockResolve = jest.fn();
jest.mock('../foodResolver', () => ({ resolveFoodItems: (...args: unknown[]) => mockResolve(...args) }));

import { requantify } from '../requantify';

const toast = (overrides: Partial<FoodItem> = {}): FoodItem => ({
  id: 'item-1',
  description: 'Toast',
  quantity: 2,
  unit: 'slices',
  calories: 180,
  protein: 6,
  carbohydrate: 34,
  fat: 2,
  confidence: 'high',
  estimated: false,
  source: 'reference',
  ...overrides,
});

beforeEach(() => mockResolve.mockReset());

describe('requantify', () => {
  it('scales linearly when the unit is unchanged', async () => {
    const updated = await requantify(toast(), 3, 'slices');
    expect(updated).toMatchObject({ quantity: 3, unit: 'slices', calories: 270, protein: 9, confidence: 'high', estimated: false });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('treats a singular/plural spelling of the same unit as unchanged', async () => {
    const updated = await requantify(toast(), 1, 'slice');
    expect(updated).toMatchObject({ quantity: 1, unit: 'slice', calories: 90 });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('converts between measured units of the same kind before scaling', async () => {
    const milk = toast({ description: 'Milk', quantity: 200, unit: 'ml', calories: 100 });
    const updated = await requantify(milk, 1, 'pint');
    expect(updated?.calories).toBeCloseTo(284.2, 0);
    expect(updated).toMatchObject({ quantity: 1, unit: 'pint', estimated: false, confidence: 'high' });
  });

  it("uses the food's density for weight <-> volume and marks the result approximate", async () => {
    const oats = toast({ description: 'Porridge oats', quantity: 40, unit: 'g', calories: 150 });
    const updated = await requantify(oats, 1, 'cup');
    // 1 cup = 250 ml x 0.36 g/ml = 90 g, i.e. 2.25x the original 40 g.
    expect(updated?.calories).toBeCloseTo(337.5, 1);
    expect(updated).toMatchObject({ unit: 'cup', estimated: true, confidence: 'medium' });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('re-resolves rather than scaling 50x when "2 slices" becomes "100 g"', async () => {
    const resolved: ResolvedFoodItem = {
      description: 'Toast', quantity: 100, unit: 'g', calories: 250, protein: 8, carbohydrate: 47, fat: 3,
      confidence: 'high', estimated: false, source: 'reference', foodId: 'food-9',
    };
    mockResolve.mockResolvedValue([resolved]);

    const updated = await requantify(toast(), 100, 'g');

    expect(mockResolve).toHaveBeenCalledWith([expect.objectContaining({ description: 'Toast', quantity: 100, unit: 'g' })]);
    expect(updated).toMatchObject({ id: 'item-1', quantity: 100, unit: 'g', calories: 250, foodId: 'food-9' });
  });

  it('re-resolves the (possibly renamed) description when switching between count units', async () => {
    mockResolve.mockResolvedValue([
      { description: 'Sourdough toast', quantity: 1, unit: 'piece', calories: 120, protein: 4, carbohydrate: 22, fat: 1, confidence: 'medium', estimated: true },
    ]);

    const updated = await requantify(toast({ description: 'Sourdough toast' }), 1, 'piece');

    expect(mockResolve).toHaveBeenCalledWith([expect.objectContaining({ description: 'Sourdough toast', quantity: 1, unit: 'piece' })]);
    expect(updated).toMatchObject({ id: 'item-1', calories: 120 });
  });

  it('returns null rather than a wrong number when the new amount cannot be worked out', async () => {
    mockResolve.mockResolvedValue([
      { description: 'Toast', quantity: 100, unit: 'g', calories: 0, protein: 0, carbohydrate: 0, fat: 0, confidence: 'low', estimated: true, unresolved: true },
    ]);
    await expect(requantify(toast(), 100, 'g')).resolves.toBeNull();
  });

  it('clears portionAssumed whichever way the amount was worked out', async () => {
    const scaled = await requantify(toast({ portionAssumed: true }), 3, 'slices');
    expect(scaled?.portionAssumed).toBe(false);

    mockResolve.mockResolvedValue([
      { description: 'Toast', quantity: 100, unit: 'g', calories: 250, protein: 8, carbohydrate: 47, fat: 3, confidence: 'high', estimated: false },
    ]);
    const resolved = await requantify(toast({ portionAssumed: true }), 100, 'g');
    expect(resolved?.portionAssumed).toBe(false);
  });
});
