import { LogFoodResult, ResolvedFoodItem } from '../../types/foodParser';

jest.mock('../defaultsMatcher', () => ({ matchDefault: jest.fn().mockResolvedValue(null) }));
jest.mock('../correctionApplier', () => ({ applyCorrections: jest.fn() }));
jest.mock('../foodResolver', () => ({ resolveFoodItems: jest.fn() }));
jest.mock('../supabaseClient', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock('../storageService', () => ({
  getMostRecentMeal: jest.fn().mockResolvedValue(null),
  saveMealForDate: jest.fn().mockResolvedValue('new-meal-id'),
  saveVoiceLog: jest.fn().mockResolvedValue(undefined),
  updateMeal: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../usualPortions', () => ({
  ...jest.requireActual('../usualPortions'),
  getUsualPortions: jest.fn().mockResolvedValue(new Map()),
  saveUsualPortions: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../healthSyncPreference', () => ({
  getAppleHealthSyncEnabled: jest.fn().mockResolvedValue(false),
}));
jest.mock('../healthKitService', () => ({
  writeMealToHealthKit: jest.fn(),
  resyncMealToHealthKit: jest.fn(),
}));

import { processTranscript, parseFoodItemsFreeText, confirmPortions, FoodParseError } from '../foodPipeline';
import { resolveFoodItems } from '../foodResolver';
import { getMostRecentMeal, saveMealForDate } from '../storageService';
import { supabase } from '../supabaseClient';
import { getUsualPortions, saveUsualPortions } from '../usualPortions';

const parsed: LogFoodResult = {
  intent: 'log_food',
  meal_type: 'dinner',
  items: [],
  needs_clarification: false,
  clarification_question: null,
  clarification_options: null,
};

const resolved = (description: string, calories: number, unresolved = false): ResolvedFoodItem => ({
  description,
  quantity: 1,
  unit: 'serving',
  calories,
  protein: 0,
  carbohydrate: 0,
  fat: 0,
  confidence: unresolved ? 'low' : 'medium',
  estimated: true,
  ...(unresolved ? { unresolved: true } : {}),
});

describe('foodPipeline partial resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: parsed, error: null });
  });

  it('logs the identified items and reports the rest as skipped', async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([
      resolved('Chicken breast', 165),
      resolved('Sesame oil', 0, true),
    ]);

    const result = await processTranscript('chicken breast, sesame oil', '2026-09-28');

    expect(result.status).toBe('logged');
    if (result.status !== 'logged') return;
    expect(result.meal.items.map((i) => i.description)).toEqual(['Chicken breast']);
    expect(result.meal.totalCalories).toBe(165);
    expect(result.skipped).toEqual(['sesame oil']);
    expect(saveMealForDate).toHaveBeenCalledTimes(1);
  });

  it('fails with a message naming the items when nothing could be identified', async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([
      resolved('Sesame oil', 0, true),
      resolved('Oyster sauce', 0, true),
    ]);

    const attempt = processTranscript('sesame oil, oyster sauce', '2026-09-28');

    await expect(attempt).rejects.toBeInstanceOf(FoodParseError);
    await expect(attempt).rejects.toMatchObject({
      message: "Couldn't work out sesame oil and oyster sauce – try describing them another way.",
      unresolvedItems: ['sesame oil', 'oyster sauce'],
    });
    expect(saveMealForDate).not.toHaveBeenCalled();
  });

  it('never sends the recent meal as context for a plain food entry', async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([resolved('Vermicelli noodles', 371)]);

    await processTranscript('vercelli noodles', '2026-09-28');

    expect(getMostRecentMeal).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'parse-food',
      expect.objectContaining({ body: expect.objectContaining({ recentMeal: null }) })
    );
  });

  it('holds a meal back, unsaved, when a big portion was guessed', async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([
      { ...resolved('Pasta', 420), quantity: 250, unit: 'g', portionAssumed: true },
      { ...resolved('Side salad', 30), portionAssumed: true },
    ]);

    const result = await processTranscript('pasta and a side salad', '2026-09-28');

    expect(result.status).toBe('needs_portion');
    if (result.status !== 'needs_portion') return;
    // The salad was guessed too, but isn't worth asking about.
    expect(result.questions.map((q) => q.item.description)).toEqual(['Pasta']);
    expect(saveMealForDate).not.toHaveBeenCalled();

    const logged = await confirmPortions(result.pending, { [result.questions[0].itemId]: 'large' });

    expect(saveMealForDate).toHaveBeenCalledWith('2026-09-28', expect.objectContaining({ totalCalories: 668.4 }));
    expect(logged.meal.id).toBe('new-meal-id');
    expect(logged.meal.items.map((i) => [i.description, i.quantity, i.portionAssumed])).toEqual([
      ['Pasta', 380, false],
      ['Side salad', 1, true],
    ]);
  });

  it("remembers the answered sizes as the user's usual portions when asked to", async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([
      { ...resolved('Pasta', 420), quantity: 250, unit: 'g', portionAssumed: true },
    ]);
    const result = await processTranscript('pasta', '2026-09-28');
    if (result.status !== 'needs_portion') throw new Error('expected a portion question');

    await confirmPortions(result.pending, { [result.questions[0].itemId]: 'small' }, true);

    expect(saveUsualPortions).toHaveBeenCalledWith([expect.objectContaining({ description: 'Pasta', quantity: 150, unit: 'g' })]);
    expect(saveMealForDate).toHaveBeenCalledTimes(1);
  });

  it('still logs the meal if remembering the portion fails', async () => {
    (saveUsualPortions as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (resolveFoodItems as jest.Mock).mockResolvedValue([
      { ...resolved('Pasta', 420), quantity: 250, unit: 'g', portionAssumed: true },
    ]);
    const result = await processTranscript('pasta', '2026-09-28');
    if (result.status !== 'needs_portion') throw new Error('expected a portion question');

    const logged = await confirmPortions(result.pending, { [result.questions[0].itemId]: 'small' }, true);
    expect(logged.status).toBe('logged');
  });

  it("uses the user's usual portion instead of asking again", async () => {
    (getUsualPortions as jest.Mock).mockResolvedValueOnce(new Map([['pasta', { quantity: 300, unit: 'g' }]]));
    (resolveFoodItems as jest.Mock).mockResolvedValue([
      { ...resolved('Pasta', 420), quantity: 250, unit: 'g', portionAssumed: true },
    ]);

    const result = await processTranscript('pasta', '2026-09-28');

    expect(result.status).toBe('logged');
    if (result.status !== 'logged') return;
    expect(result.meal.items[0]).toMatchObject({ quantity: 300, calories: 504, portionAssumed: false });
  });

  it('logs straight away when no guessed portion is worth asking about', async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([{ ...resolved('Apple', 80), portionAssumed: true }]);

    const result = await processTranscript('an apple', '2026-09-28');

    expect(result.status).toBe('logged');
    expect(saveMealForDate).toHaveBeenCalledTimes(1);
  });

  it('returns skipped items from the free-text add too', async () => {
    (resolveFoodItems as jest.Mock).mockResolvedValue([resolved('Rice', 200), resolved('Mystery sauce', 0, true)]);

    const { items, skipped } = await parseFoodItemsFreeText('rice, mystery sauce', '2026-09-28');

    expect(items.map((i) => i.description)).toEqual(['Rice']);
    expect(skipped).toEqual(['mystery sauce']);
  });
});
