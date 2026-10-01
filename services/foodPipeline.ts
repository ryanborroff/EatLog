// Orchestrates the full food-logging flow: transcript -> (known default | AI
// parse) -> resolve -> compute -> (auto-log | apply correction | ask for
// clarification). Shared by voice and text input (spec §9).

import { CookingChoice, FoodItem, Meal } from '../types';
import { ParsedFoodResult, RecentMealContext, ResolvedFoodItem } from '../types/foodParser';
import { applyCorrections } from './correctionApplier';
import { hasCorrectionCue } from '../utils/correctionCue';
import { FoodParseError } from './foodParseError';
import { matchDefault } from './defaultsMatcher';
import { resolveFoodItems } from './foodResolver';
import { calculateNutrition, ReferenceNutrition } from './nutritionCalculator';
import { applyPortions, PortionQuestion, PortionSize, portionQuestions, withUsualPortion } from './portionFollowUp';
import { getUsualPortions, saveUsualPortions, usualPortionKey } from './usualPortions';
import { applyCookingChoice, applyCookingChoices, CookingQuestion, cookingQuestions } from './cookingFollowUp';
import { getCookingPreferences, saveCookingPreferences } from './cookingPreferences';
import { getMostRecentMeal, saveMealForDate, saveVoiceLog, updateMeal } from './storageService';
import { FunctionsHttpError } from '@supabase/supabase-js';
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

export { FoodParseError };

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
    // supabase-js surfaces both network failures and non-2xx responses here,
    // with a generic message ("Edge Function returned a non-2xx status code")
    // that callers may show the user — so replace it with copy written for them.
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const body = await response.text().catch(() => '');
      console.warn(`parse-food returned ${response.status}: ${body.slice(0, 300)}`);
      throw new FoodParseError(
        response.status === 429
          ? "EatLog's busy right now – wait a minute and try again."
          : "Couldn't work that out – try again.",
        'invalid'
      );
    }
    throw new FoodParseError("Couldn't connect – check your connection and try again.", 'network');
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

/** A parsed meal held back, unsaved, until the user sizes its guessed portions. */
export interface PendingMeal {
  date: string;
  meal: Meal;
  skipped: string[];
}

export interface PortionOutcome {
  status: 'needs_portion';
  pending: PendingMeal;
  questions: PortionQuestion[];
  /** Grains weighed without saying dry or cooked. */
  cookingQuestions: CookingQuestion[];
}

export type FoodPipelineResult = LoggedOutcome | UpdatedOutcome | ClarificationOutcome | PortionOutcome;

const withItems = (meal: Omit<Meal, 'items' | `total${string}`>, items: FoodItem[]): Meal => ({
  ...meal,
  items,
  totalCalories: items.reduce((sum, i) => sum + i.calories, 0),
  totalProtein: items.reduce((sum, i) => sum + i.protein, 0),
  totalCarbohydrate: items.reduce((sum, i) => sum + i.carbohydrate, 0),
  totalFat: items.reduce((sum, i) => sum + i.fat, 0),
  totalFibre: items.reduce((sum, i) => sum + (i.fibre ?? 0), 0),
  totalSodium: items.reduce((sum, i) => sum + (i.sodium ?? 0), 0),
  totalSugar: items.reduce((sum, i) => sum + (i.sugar ?? 0), 0),
});

/** Items whose amount was guessed, set to the user's usual portion of that food when they have one. */
const applyUsualPortions = async (items: FoodItem[]): Promise<FoodItem[]> => {
  const guessed = items.filter((item) => item.portionAssumed);
  if (guessed.length === 0) return items;
  const usual = await getUsualPortions(guessed.map((item) => item.description));
  return items.map((item) => {
    const portion = usual.get(usualPortionKey(item.description));
    return portion ? withUsualPortion(item, portion) : item;
  });
};

/** Grains the user has said how they weigh before get that answer, not a question. */
const applyCookingPreferences = async (items: FoodItem[]): Promise<FoodItem[]> => {
  const open = items.filter((item) => item.cookingOptions);
  if (open.length === 0) return items;
  const preferences = await getCookingPreferences(open.map((item) => item.description));
  return items.map((item) => {
    const choice = item.cookingOptions && preferences.get(usualPortionKey(item.description));
    return choice ? applyCookingChoice(item, choice) : item;
  });
};

const saveNewMeal = async ({ date, meal: pendingMeal, skipped }: PendingMeal): Promise<LoggedOutcome> => {
  // Unanswered dry-or-cooked questions keep their guess.
  const meal = withItems(pendingMeal, applyCookingChoices(pendingMeal.items, {}));
  const saved = { ...meal, id: await saveMealForDate(date, meal) };
  await syncMealToHealthIfEnabled(saved);
  return { status: 'logged', meal: saved, skipped };
};

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
 * flagged a material ambiguity (spec §18/§39). Likewise a new meal with a big
 * guessed portion comes back unsaved as `needs_portion`; the caller asks the
 * user and finishes it with confirmPortions.
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

  const meal = withItems(
    {
      id: '', // assigned by storageService/Supabase on insert
      type: parsed.meal_type,
      loggedAt: new Date().toISOString(),
    },
    // A food the user has sized (or said how they weigh) before gets that, not a question.
    await applyCookingPreferences(
      await applyUsualPortions(resolvedItems.map((item, index) => ({ id: String(index), ...item })))
    )
  );

  // No amount given for a big item, or a grain weighed without saying dry or
  // cooked: ask before saving.
  const questions = portionQuestions(meal.items);
  const cooking = cookingQuestions(meal.items);
  if (questions.length > 0 || cooking.length > 0) {
    return { status: 'needs_portion', pending: { date, meal, skipped }, questions, cookingQuestions: cooking };
  }

  return saveNewMeal({ date, meal, skipped });
};

/**
 * Finishes a meal held back for questions: applies the sizes and dry-or-
 * cooked answers the user gave (unanswered items keep their guess, flagged as
 * such) and saves it. With `remember`, the answers become the user's usual
 * portions and how they weigh those foods, so they aren't asked again.
 */
export const confirmPortions = async (
  pending: PendingMeal,
  choices: Record<string, PortionSize>,
  remember = false,
  cookingChoices: Record<string, CookingChoice> = {}
): Promise<LoggedOutcome> => {
  const items = applyPortions(applyCookingChoices(pending.meal.items, cookingChoices), choices);
  if (remember) {
    // Best effort: failing to remember must not stop the meal being logged.
    await Promise.all([
      saveUsualPortions(items.filter((item) => choices[item.id])),
      saveCookingPreferences(
        pending.meal.items
          .filter((item) => cookingChoices[item.id])
          .map((item) => ({ item, choice: cookingChoices[item.id] }))
      ),
    ]).catch((error) => console.warn('Could not save your answers for next time:', error));
  }
  return saveNewMeal({ ...pending, meal: withItems(pending.meal, items) });
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
    // No questions here, so a dry-or-cooked grain keeps the saved answer or the guess.
    items: applyCookingChoices(
      await applyCookingPreferences(
        await applyUsualPortions(usable.map((item, index) => ({ id: `${Date.now()}-${index}`, ...item })))
      ),
      {}
    ),
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
        source: 'barcode',
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
