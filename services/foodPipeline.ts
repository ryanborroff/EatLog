// Orchestrates the full food-logging flow: transcript -> (known default | AI
// parse) -> resolve -> compute -> (auto-log | apply correction | ask for
// clarification). Shared by voice and text input (spec §9).

import { Meal } from '../types';
import { ParsedFoodResult, RecentMealContext } from '../types/foodParser';
import { applyCorrections } from './correctionApplier';
import { matchDefault } from './defaultsMatcher';
import { resolveFoodItems } from './foodResolver';
import { getMostRecentMeal, saveMealForDate, saveVoiceLog, updateMeal } from './storageService';
import { supabase } from './supabaseClient';

export class FoodParseError extends Error {
  constructor(message: string, readonly kind: 'network' | 'invalid') {
    super(message);
  }
}

const parseTranscript = async (
  transcript: string,
  mealHint: string | undefined,
  recentMeal: RecentMealContext | null
): Promise<ParsedFoodResult> => {
  const { data, error } = await supabase.functions.invoke<ParsedFoodResult>('parse-food', {
    body: {
      transcript,
      mealHint,
      localTime: new Date().toISOString(),
      recentMeal,
    },
  });

  if (error) {
    // supabase-js surfaces both network failures and non-2xx responses here.
    const isNetworkError = error.message?.toLowerCase().includes('network');
    throw new FoodParseError(error.message ?? 'AI parser failed', isNetworkError ? 'network' : 'invalid');
  }

  if (!data) {
    throw new FoodParseError('AI parser returned no data', 'invalid');
  }

  return data;
};

export interface LoggedOutcome {
  status: 'logged';
  meal: Meal;
}

export interface UpdatedOutcome {
  status: 'updated';
  meal: Meal;
}

export interface ClarificationOutcome {
  status: 'needs_clarification';
  question: string;
  options: string[];
}

export type FoodPipelineResult = LoggedOutcome | UpdatedOutcome | ClarificationOutcome;

const toRecentMealContext = (meal: Meal | null): RecentMealContext | null =>
  meal
    ? {
        mealType: meal.type,
        items: meal.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit })),
      }
    : null;

/**
 * Runs the full pipeline for one utterance/text entry and, unless clarification
 * is needed, persists the result (a new meal, or a correction applied to the
 * day's most recent meal). Callers (VoiceModal) handle the clarification
 * branch themselves — this never guesses on the user's behalf when the AI
 * flagged a material ambiguity (spec §18/§39).
 */
export const processTranscript = async (
  transcript: string,
  date: string,
  mealHint?: string
): Promise<FoodPipelineResult> => {
  // Known-phrase short-circuit (spec §20): saved defaults skip the AI entirely.
  const defaultMeal = await matchDefault(transcript, mealHint);
  if (defaultMeal) {
    await saveMealForDate(date, defaultMeal);
    return { status: 'logged', meal: defaultMeal };
  }

  const recentMeal = await getMostRecentMeal(date);
  const parsed = await parseTranscript(transcript, mealHint, toRecentMealContext(recentMeal));

  await saveVoiceLog(transcript, parsed);

  if (parsed.needs_clarification) {
    return {
      status: 'needs_clarification',
      question: parsed.clarification_question ?? 'Can you clarify what you ate?',
      options: parsed.clarification_options ?? [],
    };
  }

  if (parsed.intent === 'correction') {
    if (!recentMeal) {
      throw new FoodParseError('Nothing to correct', 'invalid');
    }
    const updated = await applyCorrections(recentMeal, parsed.operations);
    await updateMeal(date, recentMeal.id, updated);
    return { status: 'updated', meal: updated };
  }

  const resolvedItems = await resolveFoodItems(parsed.items);

  const meal: Meal = {
    id: '', // assigned by storageService/Supabase on insert
    type: parsed.meal_type,
    items: resolvedItems.map((item, index) => ({ id: String(index), ...item })),
    totalCalories: resolvedItems.reduce((sum, i) => sum + i.calories, 0),
    totalProtein: resolvedItems.reduce((sum, i) => sum + i.protein, 0),
    totalCarbohydrate: resolvedItems.reduce((sum, i) => sum + i.carbohydrate, 0),
    totalFat: resolvedItems.reduce((sum, i) => sum + i.fat, 0),
  };

  await saveMealForDate(date, meal);

  return { status: 'logged', meal };
};
