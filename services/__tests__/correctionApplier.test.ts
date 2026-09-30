import { FoodItem, Meal } from '../../types';
import { CorrectionOperation, ParsedFoodItem, ResolvedFoodItem } from '../../types/foodParser';

const mockResolve = jest.fn();
jest.mock('../foodResolver', () => ({ resolveFoodItems: (...args: unknown[]) => mockResolve(...args) }));

import { applyCorrections } from '../correctionApplier';
import { FoodParseError } from '../foodParseError';

const item = (overrides: Partial<FoodItem>): FoodItem => ({
  id: '0',
  description: 'Toast',
  quantity: 2,
  unit: 'slices',
  calories: 180,
  protein: 6,
  carbohydrate: 34,
  fat: 2,
  confidence: 'high',
  estimated: false,
  ...overrides,
});

const meal = (items: FoodItem[]): Meal => ({
  id: 'm1',
  type: 'breakfast',
  items,
  totalCalories: 0,
  totalProtein: 0,
  totalCarbohydrate: 0,
  totalFat: 0,
  totalFibre: 0,
  totalSodium: 0,
  totalSugar: 0,
  loggedAt: '2026-09-30T08:00:00.000Z',
});

const updateQuantity = (new_quantity: number, new_unit: string, target = 'toast'): CorrectionOperation => ({
  type: 'update_quantity',
  target_description: target,
  item: null,
  new_quantity,
  new_unit,
  meal_type: null,
});

beforeEach(() => mockResolve.mockReset());

describe('applyCorrections update_quantity', () => {
  it('scales linearly when the unit is unchanged', async () => {
    const updated = await applyCorrections(meal([item({})]), [updateQuantity(3, 'slices')]);
    expect(updated.items[0].calories).toBe(270);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('clears a guessed portion once the user says how much', async () => {
    const updated = await applyCorrections(meal([item({ portionAssumed: true })]), [updateQuantity(3, 'slices')]);
    expect(updated.items[0].portionAssumed).toBe(false);
  });

  it('converts between measured units before scaling', async () => {
    const milk = item({ description: 'Milk', quantity: 200, unit: 'ml', calories: 100 });
    const updated = await applyCorrections(meal([milk]), [updateQuantity(1, 'pint', 'milk')]);
    expect(updated.items[0].calories).toBeCloseTo(284.2, 0);
    expect(updated.items[0].unit).toBe('pint');
  });

  it('re-resolves instead of scaling 50x when "2 slices" becomes "100 g"', async () => {
    const resolved: ResolvedFoodItem = {
      description: 'Toast', quantity: 100, unit: 'g', calories: 250, protein: 8, carbohydrate: 47, fat: 3,
      confidence: 'high', estimated: false,
    };
    mockResolve.mockResolvedValue([resolved]);

    const updated = await applyCorrections(meal([item({})]), [updateQuantity(100, 'g')]);

    expect(mockResolve).toHaveBeenCalledWith([expect.objectContaining({ description: 'Toast', quantity: 100, unit: 'g' })]);
    expect(updated.items[0].calories).toBe(250);
    expect(updated.items[0].id).toBe('0');
    expect(updated.totalCalories).toBe(250);
  });

  it('refuses rather than logging a wrong number when the new amount cannot be worked out', async () => {
    mockResolve.mockResolvedValue([
      { description: 'Toast', quantity: 100, unit: 'g', calories: 0, protein: 0, carbohydrate: 0, fat: 0, confidence: 'low', estimated: true, unresolved: true },
    ]);
    await expect(applyCorrections(meal([item({})]), [updateQuantity(100, 'g')])).rejects.toBeInstanceOf(FoodParseError);
  });
});

describe('applyCorrections add_item / replace_item', () => {
  const parsedItem = (description: string): ParsedFoodItem => ({
    description, brand: null, quantity: 1, unit: 'tbsp', grams_per_unit: null, preparation: null,
    confidence: 'medium', estimated_nutrition: null,
  });
  const itemOp = (type: 'add_item' | 'replace_item', description: string, target: string | null = null): CorrectionOperation => ({
    type, target_description: target, item: parsedItem(description), new_quantity: null, new_unit: null, meal_type: null,
  });
  const unresolved = (description: string): ResolvedFoodItem => ({
    description, quantity: 1, unit: 'tbsp', calories: 0, protein: 0, carbohydrate: 0, fat: 0,
    confidence: 'low', estimated: true, unresolved: true,
  });

  it('adds an item that resolves', async () => {
    mockResolve.mockResolvedValue([
      { description: 'Butter', quantity: 1, unit: 'tbsp', calories: 100, protein: 0, carbohydrate: 0, fat: 11, confidence: 'medium', estimated: true },
    ]);
    const updated = await applyCorrections(meal([item({})]), [itemOp('add_item', 'Butter')]);
    expect(updated.items).toHaveLength(2);
    expect(updated.totalCalories).toBe(280);
  });

  it('refuses to add a zero-calorie item nothing could identify', async () => {
    mockResolve.mockResolvedValue([unresolved('Blorp')]);
    await expect(applyCorrections(meal([item({})]), [itemOp('add_item', 'Blorp')])).rejects.toMatchObject({
      unresolvedItems: ['blorp'],
    });
  });

  it('keeps the original food rather than replacing it with one nothing could identify', async () => {
    mockResolve.mockResolvedValue([unresolved('Blorp')]);
    const original = meal([item({})]);
    await expect(applyCorrections(original, [itemOp('replace_item', 'Blorp', 'toast')])).rejects.toBeInstanceOf(
      FoodParseError
    );
    expect(original.items[0].description).toBe('Toast');
  });
});
