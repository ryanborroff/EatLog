import { Meal } from '../../types';
jest.mock('../supabaseClient', () => ({
  supabase: { rpc: jest.fn() },
  withClockSkewRetry: jest.fn((fn) => fn()),
}));
import { supabase } from '../supabaseClient';
import { onDiaryChanged, saveMealForDate, updateMeal } from '../storageService';
const meal = {
  type: 'breakfast', items: [{ description: 'toast', quantity: 1, unit: 'slice',
    calories: 80, protein: 3, carbohydrate: 15, fat: 1, confidence: 'high', estimated: false }],
} as Meal;
const rpc = supabase.rpc as jest.Mock;
beforeEach(() => rpc.mockReset());

test('save uses one RPC and returns the destination meal id', async () => {
  rpc.mockResolvedValue({ data: 'destination', error: null });
  expect(await saveMealForDate('2026-10-10', meal)).toBe('destination');
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('persist_diary_meal', expect.objectContaining({
    p_date: '2026-10-10', p_meal_type: 'breakfast', p_meal_id: null,
    p_items: [expect.objectContaining({ description: 'toast', portion_assumed: false })],
  }));
});

test('edit returns a merged destination instead of retaining the source id', async () => {
  rpc.mockResolvedValue({ data: 'merged', error: null });
  expect(await updateMeal('2026-10-10', 'source', meal)).toBe('merged');
  expect(rpc.mock.calls[0][1].p_meal_id).toBe('source');
});

test('failed transaction propagates the error and does not announce a diary change', async () => {
  const listener = jest.fn();
  const unsubscribe = onDiaryChanged(listener);
  try {
    const error = { message: 'item insert failed' };
    rpc.mockResolvedValue({ data: null, error });
    await expect(updateMeal('2026-10-10', 'source', meal)).rejects.toEqual(error);
    expect(listener).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: 'saved', error: null });
    await saveMealForDate('2026-10-10', meal);
    expect(listener).toHaveBeenCalledTimes(1);
  } finally { unsubscribe(); }
});

test('an empty RPC result is not treated as a successful save', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(saveMealForDate('2026-10-10', meal)).rejects.toThrow('Meal save returned no id');
});
