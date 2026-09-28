// Orchestrates the full food-logging flow: transcript -> (known default | AI
// parse) -> resolve -> compute -> (auto-log | apply correction | ask for
// clarification). Shared by voice and text input (spec §9).

import { FoodItem, Meal } from '../types';
import { ParsedFoodResult, RecentMealContext, ResolvedFoodItem } from '../types/foodParser';
import { applyCorrections } from './correctionApplier';
import { hasCorrectionCue } from '../utils/correctionCue';
import { matchDefault } from './defaultsMatcher';
import { resolveFoodItems } from './foodResolver';
import { calculateNutrition, ReferenceNutrition } from './nutritionCalculator';
import { getMostRecentMeal, saveMealForDate, saveVoiceLog, updateMeal } from './storageService';
import { supabase } from './supabaseClient';
import { getAppleHealthSyncEnabled } from './healthSyncPreference';
import { writeMealToHealthKit, resyncMealToHealthKit } from './healthKitService';

// Best-effort: a HealthKit write failure (permission revoked, simulator, etc.) must never
// block food logging, which is the app's core function.
const syncMealToHealthIfEnabled = async (meal: Meal): Promise<void> => {
  try {
    if (await getAppleHealthSyncEnabled()) {
      await writeMealToHealthKit(meal);
    }
  } catch (error) {
    console.error('Error syncing meal to Apple Health:', error);
  }
};

// Same as above, but for a correction/edit: clears any samples already written for this
// meal first so the re-write doesn't double-count calories/macros in Apple Health.
const resyncMealToHealthIfEnabled = async (meal: Meal): Promise<void> => {
  try {
    if (await getAppleHealthSyncEnabled()) {
      await resyncMealToHealthKit(meal);
    }
  } catch (error) {
    console.error('Error re-syncing meal to Apple Health:', error);
  }
};

export class FoodParseError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'invalid',
    // Set when the failure is specific items that couldn't be identified — the
    // message then names them and is safe to show the user as-is.
    readonly unresolvedItems?: string[]
  ) {
    super(message);
  }
}

const formatList = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Splits resolved items into the usable ones and the names of those nothing
 * could identify. One unidentifiable condiment shouldn't sink a whole meal, so
 * callers keep the usable items and tell the user what was skipped; only when
 * nothing resolved does this throw, naming the items.
 */
const partitionResolved = (resolvedItems: ResolvedFoodItem[]): { usable: ResolvedFoodItem[]; skipped: string[] } => {
  const usable = resolvedItems.filter((item) => !item.unresolved);
  const skipped = resolvedItems.filter((item) => item.unresolved).map((item) => item.description.toLowerCase());

  if (usable.length === 0) {
    const message =
      skipped.length > 0
        ? `Couldn't work out ${formatList(skipped)} – try describing ${skipped.length === 1 ? 'it' : 'them'} another way.`
        : "Couldn't work that out – try again.";
    throw new FoodParseError(message, 'invalid', skipped);
  }

  return { usable, skipped };
};

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
  /** Items the user mentioned that couldn't be identified and were left out of the meal. */
  skipped: string[];
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
    const savedId = await saveMealForDate(date, defaultMeal);
    const savedMeal = { ...defaultMeal, id: savedId };
    await syncMealToHealthIfEnabled(savedMeal);
    return { status: 'logged', meal: savedMeal, skipped: [] };
  }

  // Only offer the last meal as correction context when the wording asks for a
  // correction — otherwise the parser could "correct" it with a new entry.
  const recentMeal = hasCorrectionCue(transcript) ? await getMostRecentMeal(date) : null;
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
    await resyncMealToHealthIfEnabled(updated);
    return { status: 'updated', meal: updated };
  }

  // Never log a phantom zero-calorie item: unidentifiable items are left out
  // and reported back as `skipped` so the user can add them another way.
  const { usable: resolvedItems, skipped } = partitionResolved(await resolveFoodItems(parsed.items));

  const meal: Meal = {
    id: '', // assigned by storageService/Supabase on insert
    type: parsed.meal_type,
    items: resolvedItems.map((item, index) => ({ id: String(index), ...item })),
    totalCalories: resolvedItems.reduce((sum, i) => sum + i.calories, 0),
    totalProtein: resolvedItems.reduce((sum, i) => sum + i.protein, 0),
    totalCarbohydrate: resolvedItems.reduce((sum, i) => sum + i.carbohydrate, 0),
    totalFat: resolvedItems.reduce((sum, i) => sum + i.fat, 0),
    totalFibre: resolvedItems.reduce((sum, i) => sum + (i.fibre ?? 0), 0),
    totalSodium: resolvedItems.reduce((sum, i) => sum + (i.sodium ?? 0), 0),
    totalSugar: resolvedItems.reduce((sum, i) => sum + (i.sugar ?? 0), 0),
    loggedAt: new Date().toISOString(),
  };

  const savedId = await saveMealForDate(date, meal);
  meal.id = savedId;
  await syncMealToHealthIfEnabled(meal);

  return { status: 'logged', meal, skipped };
};

/**
 * Free-text add for screens that hold their own in-progress item list (Edit
 * Meal's manual "Add food" field) rather than logging a whole meal straight
 * away. Runs the same parse+resolve steps as processTranscript's log_food
 * path, but never persists — the caller owns saving. Always treated as a
 * fresh addition (recentMeal: null) since there is no meal being corrected.
 */
export const parseFoodItemsFreeText = async (
  description: string,
  date: string
): Promise<{ items: FoodItem[]; skipped: string[] }> => {
  const parsed = await parseTranscript(description, date, undefined, null);

  if (parsed.needs_clarification) {
    throw new FoodParseError(
      parsed.clarification_question ?? "Couldn't work that out – try being more specific.",
      'invalid'
    );
  }

  if (parsed.intent === 'correction') {
    throw new FoodParseError("Couldn't work that out – try again.", 'invalid');
  }

  const { usable, skipped } = partitionResolved(await resolveFoodItems(parsed.items));

  return {
    items: usable.map((item, index) => ({ id: `${Date.now()}-${index}`, ...item })),
    skipped,
  };
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
    totalFibre: calculated.fibre ?? 0,
    totalSodium: calculated.sodium ?? 0,
    totalSugar: calculated.sugar ?? 0,
    loggedAt: new Date().toISOString(),
  };

  const savedId = await saveMealForDate(date, meal);
  meal.id = savedId;
  await syncMealToHealthIfEnabled(meal);
  return meal;
};
