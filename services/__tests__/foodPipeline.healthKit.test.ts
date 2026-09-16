import { Meal } from '../../types';
import { CorrectionResult } from '../../types/foodParser';

jest.mock('../defaultsMatcher', () => ({ matchDefault: jest.fn() }));
jest.mock('../correctionApplier', () => ({ applyCorrections: jest.fn() }));
jest.mock('../foodResolver', () => ({ resolveFoodItems: jest.fn() }));
jest.mock('../supabaseClient', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock('../storageService', () => ({
  getMostRecentMeal: jest.fn(),
  saveMealForDate: jest.fn(),
  saveVoiceLog: jest.fn().mockResolvedValue(undefined),
  updateMeal: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../healthSyncPreference', () => ({
  getAppleHealthSyncEnabled: jest.fn().mockResolvedValue(true),
}));
jest.mock('../healthKitService', () => ({
  writeMealToHealthKit: jest.fn().mockResolvedValue(undefined),
  resyncMealToHealthKit: jest.fn().mockResolvedValue(undefined),
}));

import { processTranscript } from '../foodPipeline';
import { matchDefault } from '../defaultsMatcher';
import { applyCorrections } from '../correctionApplier';
import { getMostRecentMeal, saveMealForDate } from '../storageService';
import { supabase } from '../supabaseClient';
import { writeMealToHealthKit, resyncMealToHealthKit } from '../healthKitService';

const baseMeal: Meal = {
  id: 'meal-123',
  type: 'breakfast',
  items: [],
  totalCalories: 300,
  totalProtein: 20,
  totalCarbohydrate: 30,
  totalFat: 10,
  totalFibre: 2,
  totalSodium: 100,
  totalSugar: 5,
  loggedAt: '2026-09-16T08:00:00.000Z',
};

describe('processTranscript HealthKit sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes a fresh sample (not resync) when logging a brand-new default meal', async () => {
    (matchDefault as jest.Mock).mockResolvedValue({ ...baseMeal, id: '' });
    (saveMealForDate as jest.Mock).mockResolvedValue('new-meal-id');

    const result = await processTranscript('the usual oatmeal', '2026-09-16');

    expect(result.status).toBe('logged');
    expect(writeMealToHealthKit).toHaveBeenCalledTimes(1);
    expect(writeMealToHealthKit).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-meal-id' }));
    expect(resyncMealToHealthKit).not.toHaveBeenCalled();
  });

  it('deletes prior HealthKit samples before re-writing when a correction is applied', async () => {
    (matchDefault as jest.Mock).mockResolvedValue(null);
    (getMostRecentMeal as jest.Mock).mockResolvedValue(baseMeal);

    const correctionResponse: CorrectionResult = {
      intent: 'correction',
      operations: [],
      needs_clarification: false,
      clarification_question: null,
      clarification_options: null,
    };
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: correctionResponse, error: null });

    const updatedMeal: Meal = { ...baseMeal, totalCalories: 450 };
    (applyCorrections as jest.Mock).mockResolvedValue(updatedMeal);

    const result = await processTranscript('actually make that a large portion', '2026-09-16');

    expect(result.status).toBe('updated');
    // The correction path must clear the meal's old samples before writing the corrected
    // totals — a plain write here would leave both the old and new samples in Health.
    expect(resyncMealToHealthKit).toHaveBeenCalledTimes(1);
    expect(resyncMealToHealthKit).toHaveBeenCalledWith(updatedMeal);
    expect(writeMealToHealthKit).not.toHaveBeenCalled();
  });
});
