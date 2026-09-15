// Orchestrates the full food-logging flow: transcript -> (known default | AI
// parse) -> resolve -> compute -> (auto-log | apply correction | ask for
// clarification). Shared by voice and text input (spec §9).

import { Meal } from '../types';
import { ParsedFoodResult, RecentMealContext } from '../types/foodParser';
import { applyCorrections } from './correctionApplier';
import { matchDefault } from './defaultsMatcher';
import { resolveFoodItems } from './foodResolver';
import { calculateNutrition, ReferenceNutrition } from './nutritionCalculator';
import { getMostRecentMeal, saveMealForDate, saveVoiceLog, updateMeal } from './storageService';
import { supabase } from './supabaseClient';

export class FoodParseError extends Error {
  constructor(message: string, readonly kind: 'network' | 'invalid') {
    super(message);
  }
}

const todayDate = (): string => new Date().toISOString().split('T')[0];

/**
 * For a backdated entry, using the real current time would bias meal-type
 * classification (e.g. logging breakfast in the evening would get read as
 * dinner). Anchor to midday on the target date instead so the AI relies on
 * explicit language ("I had breakfast...") rather than the wrong clock.
 */
const localTimeFor = (date: string): string =>
  date === todayDate() ? new Date().toISOString() : `${date}T12:00:00.000Z`;

const parseTranscript = async (
  transcript: string,
  date: string,
  mealHint: string | undefined,
  recentMeal: RecentMealContext | null
): Promise<ParsedFoodResult> => {
  const { data, error } = await supabase.functions.invoke<ParsedFoodResult>('parse-food', {
    body: {
      transcript,
      mealHint,
      localTime: localTimeFor(date),
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
  const parsed = await parseTranscript(transcript, date, mealHint, toRecentMealContext(recentMeal));

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

  // Rather than silently logging a phantom zero-calorie item, fail the whole
  // entry so the user hits the normal error UI (retry / scan barcode instead)
  // when nothing could identify what they meant.
  if (resolvedItems.some((item) => item.unresolved)) {
    throw new FoodParseError("Couldn't identify one or more items", 'invalid');
  }

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

/**
 * Barcode fallback (used when parsing fails on a packaged food): the lookup
 * already gives exact nutrition, so this skips resolveFoodItems/AI entirely
 * and logs directly.
 */
export const logBarcodeItem = async (
  date: string,
  mealType: Meal['type'],
  name: string,
  reference: ReferenceNutrition,
  quantity: number
): Promise<Meal> => {
  const calculated = calculateNutrition(reference, quantity);

  const meal: Meal = {
    id: '',
    type: mealType,
    items: [
      {
        id: '0',
        description: name,
        quantity,
        unit: reference.servingUnit,
        ...calculated,
        confidence: 'high',
        estimated: false,
      },
    ],
    totalCalories: calculated.calories,
    totalProtein: calculated.protein,
    totalCarbohydrate: calculated.carbohydrate,
    totalFat: calculated.fat,
  };

  await saveMealForDate(date, meal);
  return meal;
};
