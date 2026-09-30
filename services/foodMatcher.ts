// Asks the match-food Edge Function to find a reference food for descriptions
// the alias list doesn't know ("chicken tikka masala", "Heinz beans"). It
// shortlists real foods — CoFID, plus Open Food Facts for named brands — and
// the AI only picks one, so the nutrition comes from data, not memory.

import type { FoodRow } from './foodResolver';
import { supabase } from './supabaseClient';

export interface MatchQuery {
  key: string;
  description: string;
  preparation: string | null;
  brand: string | null;
}

export type MatchedFood =
  | (FoodRow & { source: 'cofid' })
  | (Omit<FoodRow, 'id'> & { id: null; source: 'open_food_facts' });

/**
 * Matched foods by query key; a missing key means no match. Never throws:
 * matching only improves on the AI's estimate, so if it's unavailable the
 * caller carries on without it.
 */
export const matchFoods = async (queries: MatchQuery[]): Promise<Map<string, MatchedFood>> => {
  const matched = new Map<string, MatchedFood>();
  if (queries.length === 0) return matched;
  try {
    const { data, error } = await supabase.functions.invoke<{ matches: { key: string; food: MatchedFood | null }[] }>(
      'match-food',
      { body: { queries } }
    );
    if (error) throw error;
    for (const { key, food } of data?.matches ?? []) {
      if (food) matched.set(key, food);
    }
  } catch (error) {
    console.warn('Food matching unavailable, using estimates:', error);
  }
  return matched;
};
