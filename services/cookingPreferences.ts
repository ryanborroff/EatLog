// Whether a user weighs a grain dry or cooked ("I always weigh pasta dry"),
// remembered from the dry-or-cooked question so they aren't asked every time.

import { CookingChoice, FoodItem } from '../types';
import { supabase } from './supabaseClient';
import { usualPortionKey } from './usualPortions';

/** Saved answers for these descriptions, by key. Empty on any failure — this only saves a question. */
export const getCookingPreferences = async (descriptions: string[]): Promise<Map<string, CookingChoice>> => {
  const preferences = new Map<string, CookingChoice>();
  const keys = [...new Set(descriptions.map(usualPortionKey))];
  if (keys.length === 0) return preferences;
  try {
    const { data, error } = await supabase.from('cooking_preferences').select('food_key, weighed').in('food_key', keys);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.weighed === 'dry' || row.weighed === 'cooked') preferences.set(row.food_key, row.weighed);
    }
  } catch (error) {
    console.warn('Could not load cooking preferences:', error);
  }
  return preferences;
};

/** Remembers how the user weighs each of these foods. */
export const saveCookingPreferences = async (
  answers: { item: Pick<FoodItem, 'description'>; choice: CookingChoice }[]
): Promise<void> => {
  if (answers.length === 0) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('cooking_preferences').upsert(
    answers.map(({ item, choice }) => ({
      user_id: session.user.id,
      food_key: usualPortionKey(item.description),
      weighed: choice,
      updated_at: new Date().toISOString(),
    }))
  );
  if (error) throw error;
};
