// A user's usual portion of a food, remembered from the portion question so
// they aren't asked about the same food every time.

import { FoodItem } from '../types';
import { supabase } from './supabaseClient';

export interface UsualPortion {
  quantity: number;
  unit: string;
}

/** The key a food's usual portion is stored under: its description, lowercased, spaces collapsed. */
export const usualPortionKey = (description: string): string => description.trim().toLowerCase().replace(/\s+/g, ' ');

/** Usual portions for these descriptions, by key. Empty on any failure — this only saves a question. */
export const getUsualPortions = async (descriptions: string[]): Promise<Map<string, UsualPortion>> => {
  const portions = new Map<string, UsualPortion>();
  const keys = [...new Set(descriptions.map(usualPortionKey))];
  if (keys.length === 0) return portions;
  try {
    const { data, error } = await supabase.from('usual_portions').select('food_key, quantity, unit').in('food_key', keys);
    if (error) throw error;
    for (const row of data ?? []) portions.set(row.food_key, { quantity: Number(row.quantity), unit: row.unit });
  } catch (error) {
    console.warn('Could not load usual portions:', error);
  }
  return portions;
};

/** Remembers each item's amount as the user's usual portion of that food. */
export const saveUsualPortions = async (items: Pick<FoodItem, 'description' | 'quantity' | 'unit'>[]): Promise<void> => {
  if (items.length === 0) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('usual_portions').upsert(
    items.map((item) => ({
      user_id: session.user.id,
      food_key: usualPortionKey(item.description),
      quantity: item.quantity,
      unit: item.unit,
      updated_at: new Date().toISOString(),
    }))
  );
  if (error) throw error;
};
