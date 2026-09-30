// Resolves each AI-parsed item to nutrition values, per spec §12's priority
// order: 1) personal foods, 2) saved defaults, 3-4) standard reference DB
// (exact name, then alias), 5) the AI's own estimate.

import { FoodItem, FoodSource } from '../types';
import { ParsedFoodItem, ResolvedFoodItem } from '../types/foodParser';
import { calculateNutrition, CalculatedNutrition, ReferenceNutrition } from './nutritionCalculator';
import { densityFor } from './foodDensity';
import { checkEstimate, plausibleGramsPerUnit } from './estimateChecks';
import { convertQuantity, isMeasuredUnit, toGrams } from './unitConversion';
import { supabase } from './supabaseClient';

export interface FoodRow {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
  fibre: number | null;
  sodium: number | null;
  sugar: number | null;
}

const normalize = (text: string): string => text.trim().toLowerCase();

const getUserId = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
};

/** Tier 1: the user's own saved/nicknamed foods. */
const findPersonalFood = async (description: string, userId: string): Promise<FoodRow | null> => {
  const query = normalize(description);

  const { data } = await supabase
    .from('user_foods')
    .select('nickname, foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre, sodium, sugar)')
    .eq('user_id', userId)
    .ilike('nickname', query)
    .limit(1)
    .maybeSingle();

  return (data?.foods as unknown as FoodRow) ?? null;
};

/** Tier 2: a saved single-food default (e.g. "coffee") — carries its own fixed quantity/unit. */
const findFoodDefault = async (
  description: string,
  userId: string
): Promise<{ food: FoodRow; quantity: number; unit: string } | null> => {
  const query = normalize(description);

  const { data } = await supabase
    .from('user_defaults')
    .select('quantity, unit, foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre, sodium, sugar)')
    .eq('user_id', userId)
    .eq('type', 'food')
    .ilike('name', query)
    .limit(1)
    .maybeSingle();

  if (!data || data.quantity == null || !data.unit) return null;
  return { food: data.foods as unknown as FoodRow, quantity: data.quantity, unit: data.unit };
};

/**
 * Possible singular forms of a word: "strawberries" -> "strawberry" but
 * "brownies" -> "brownie", so "-ies" yields both; "potatoes" -> "potato";
 * "eggs" -> "egg". Leaves "glass" alone. Only exact alias hits count, so the
 * extra wrong guess ("browny") is harmless.
 */
const singularForms = (text: string): string[] => {
  if (text.endsWith('ies') && text.length > 4) return [`${text.slice(0, -3)}y`, text.slice(0, -1)];
  if (text.endsWith('oes')) return [text.slice(0, -2)];
  if (text.endsWith('s') && !text.endsWith('ss') && text.length > 3) return [text.slice(0, -1)];
  return [];
};

const DRY_WORDS = /\b(dry|uncooked|raw)\b/;
const COOKED_WORDS = /\b(cooked|boiled|steamed)\b/;
const stripCookingState = (text: string): string =>
  text.replace(/\b(dry|uncooked|raw|cooked)\b/g, ' ').replace(/\s+/g, ' ').trim();

// Grains and pulses that CoFID lists both dry and cooked, ~2.5x apart per 100 g.
const DRY_WEIGHED_GRAIN = /\b(pasta|spaghetti|penne|fusilli|macaroni|rice|noodles?|couscous|lentils?|quinoa)$/;
const OATS = /\boats?$/;
// Above this many grams, an unqualified weight of pasta/rice reads as cooked:
// a typical dry portion is 60–100 g, a cooked one 150–250 g.
const MAX_LIKELY_DRY_GRAMS = 120;

interface CookingState {
  /** Alias lookup keys for the right form of the food, tried before any other. */
  aliases: string[];
  /** True when the state was assumed from the amount rather than said. */
  assumed: boolean;
}

/**
 * Works out whether a grain was measured dry or cooked. Unqualified aliases
 * ("pasta", "rice") point at the cooked food, so "100 g pasta" — almost always
 * weighed dry — was counted at half its calories. Oats are the reverse: "oats"
 * is dry, but "a bowl of oats" is a bowl of porridge.
 */
const cookingState = (item: ParsedFoodItem): CookingState | null => {
  const description = normalize(item.description);
  const said = `${item.preparation ? normalize(item.preparation) : ''} ${description}`;
  const base = stripCookingState(description);
  // Mixed dishes and fried rice are never weighed dry.
  if (/\b(and|with|fried)\b/.test(said)) return null;

  const saidDry = DRY_WORDS.test(said);
  const saidCooked = COOKED_WORDS.test(said);

  if (OATS.test(base)) {
    const byThePortion = !isMeasuredUnit(item.unit);
    return !saidDry && (saidCooked || byThePortion) ? { aliases: ['porridge with water'], assumed: !saidCooked } : null;
  }

  if (!DRY_WEIGHED_GRAIN.test(base) || saidCooked) return null;
  if (saidDry) return { aliases: [`dry ${base}`], assumed: false };

  const grams = toGrams(item.quantity, item.unit);
  if (grams === null) return null;
  return grams <= MAX_LIKELY_DRY_GRAMS
    ? { aliases: [`dry ${base}`], assumed: true }
    : // The cooked aliases are the defaults, so no special lookup — but it's still a guess.
      { aliases: [], assumed: true };
};

/**
 * Alias lookup keys for an item, most specific first: the right cooking state
 * ("dry pasta"), then the preparation plus the food ("boiled egg") beats the
 * bare food ("egg"); the description is also tried without a stated state
 * ("uncooked rice" -> "rice") and in singular form ("scrambled eggs" ->
 * "scrambled egg").
 */
const aliasCandidates = (item: ParsedFoodItem, state: CookingState | null): string[] => {
  const description = normalize(item.description);
  const preparation = item.preparation ? normalize(item.preparation) : '';
  const forms = [...new Set([description, stripCookingState(description)])].flatMap((form) => [
    form,
    ...singularForms(form),
  ]);
  const withPreparation =
    preparation && !description.includes(preparation) ? forms.map((form) => `${preparation} ${form}`) : [];
  const candidates = [...(state?.aliases ?? []), ...withPreparation, ...forms];
  // "deep-fried chicken" should find the "deep fried chicken" alias too.
  return [...new Set(candidates.flatMap((candidate) => [candidate, candidate.replace(/-/g, ' ')]))];
};

// Preparations that add a lot of fat, and the words CoFID uses in a food's
// name when it was prepared that way.
const FAT_ADDING_PREPARATIONS: { said: RegExp; shown: RegExp }[] = [
  { said: /\b(fried|fry|sauteed|sautéed)\b/, shown: /fried|fry|batter|coated/ },
  { said: /\bbatter(ed)?\b|\btempura\b/, shown: /batter/ },
  { said: /\b(breaded|crumbed|coated)\b|\bbreadcrumbs?\b/, shown: /coated|breadcrumb/ },
  { said: /\broast(ed)?\b/, shown: /roast/ },
  { said: /\bbutter(ed)?\b/, shown: /butter/ },
  { said: /\boil\b/, shown: /oil/ },
];

/**
 * Whether an alias match keeps a fat-adding preparation. The bare alias for
 * "fried chicken" is "chicken" — grilled skinless breast — so without this a
 * fried, battered or buttered food was logged as its plain version. A match
 * counts only if the alias itself names the preparation ("fried egg") or the
 * food it points at was prepared that way ("chips" -> fried chips).
 */
const keepsPreparation = (item: ParsedFoodItem, alias: string, food: FoodRow): boolean => {
  const preparation = item.preparation ? normalize(item.preparation) : '';
  if (!preparation || alias.includes(preparation)) return true;
  const name = food.name.toLowerCase();
  return FAT_ADDING_PREPARATIONS.every(({ said, shown }) => !said.test(preparation) || shown.test(name));
};

/**
 * Tier 3/4: look up the foods table by exact name, then by a known alias
 * (everyday names like "egg" for CoFID's "Eggs, chicken, whole, boiled").
 * Returns null if nothing matches (falls through to the AI's own estimate).
 */
const findReferenceFood = async (item: ParsedFoodItem, state: CookingState | null): Promise<FoodRow | null> => {
  const { data: exactMatch } = await supabase
    .from('foods')
    .select('id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre, sodium, sugar')
    .ilike('name', normalize(item.description))
    .limit(1)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  // Aliases are stored lowercase, so an exact `in` match is case-insensitive here.
  const candidates = aliasCandidates(item, state);
  const { data: aliasMatches } = await supabase
    .from('food_aliases')
    .select('alias, foods!inner(id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre, sodium, sugar)')
    .in('alias', candidates);

  for (const candidate of candidates) {
    const match = aliasMatches?.find((row) => row.alias === candidate);
    const food = match?.foods as unknown as FoodRow | undefined;
    if (food && keepsPreparation(item, candidate, food)) return food;
  }
  return null;
};

const toReference = (food: FoodRow): ReferenceNutrition => ({
  servingSize: food.serving_size,
  servingUnit: food.serving_unit,
  calories: food.calories,
  protein: food.protein,
  carbohydrate: food.carbohydrate,
  fat: food.fat,
  fibre: food.fibre ?? undefined,
  sodium: food.sodium ?? undefined,
  sugar: food.sugar ?? undefined,
});

const CONFIDENCE_RANK: ResolvedFoodItem['confidence'][] = ['low', 'medium', 'high'];
const capConfidence = (
  confidence: ResolvedFoodItem['confidence'],
  cap: ResolvedFoodItem['confidence']
): ResolvedFoodItem['confidence'] =>
  CONFIDENCE_RANK[Math.min(CONFIDENCE_RANK.indexOf(confidence), CONFIDENCE_RANK.indexOf(cap))];

/**
 * Scales reference nutrition to the logged quantity, converting the logged unit
 * into the reference's unit first ("1 whole" egg at 50 g each vs "per 100 g").
 * Returns null when the units can't be reconciled, so the caller can try the
 * next source instead of logging a wildly wrong number.
 */
const scaleToLoggedQuantity = (
  reference: ReferenceNutrition,
  quantity: number,
  unit: string,
  gramsPerUnit: number | null | undefined,
  gramsPerMl: number | null
): { calculated: CalculatedNutrition; approximate: boolean } | null => {
  const converted = convertQuantity(quantity, unit, reference.servingUnit, gramsPerUnit, gramsPerMl);
  if (!converted) return null;
  return { calculated: calculateNutrition(reference, converted.quantity), approximate: converted.approximate };
};

const fromFoodRow = (
  food: FoodRow,
  quantity: number,
  unit: string,
  gramsPerUnit: number | null | undefined,
  gramsPerMl: number | null,
  confidence: ResolvedFoodItem['confidence'],
  source: FoodSource
): ResolvedFoodItem | null => {
  const scaled = scaleToLoggedQuantity(toReference(food), quantity, unit, gramsPerUnit, gramsPerMl);
  if (!scaled) return null;

  return {
    description: food.name,
    quantity,
    unit,
    ...scaled.calculated,
    confidence: scaled.approximate ? capConfidence(confidence, 'medium') : confidence,
    estimated: scaled.approximate,
    source,
    foodId: food.id,
  };
};

const resolveNutrition = async (parsedItem: ParsedFoodItem): Promise<ResolvedFoodItem> => {
  // A per-unit weight the AI made up out of all proportion is worse than none.
  const item = { ...parsedItem, grams_per_unit: plausibleGramsPerUnit(parsedItem.grams_per_unit) };
  const userId = await getUserId();
  const gramsPerMl = densityFor(item.description);

  if (userId) {
    const personalFood = await findPersonalFood(item.description, userId);
    const fromPersonal =
      personalFood && fromFoodRow(personalFood, item.quantity, item.unit, item.grams_per_unit, gramsPerMl, 'high', 'personal_food');
    if (fromPersonal) return fromPersonal;

    const foodDefault = await findFoodDefault(item.description, userId);
    // A default's saved quantity/unit takes priority — that's the point of a default.
    // (The AI's grams_per_unit describes the spoken unit, not the default's, so it doesn't apply.)
    const fromDefault =
      foodDefault && fromFoodRow(foodDefault.food, foodDefault.quantity, foodDefault.unit, null, gramsPerMl, 'high', 'saved_default');
    if (fromDefault) return fromDefault;
  }

  const state = cookingState(item);
  const referenceFood = await findReferenceFood(item, state);
  const fromReference =
    referenceFood &&
    scaleToLoggedQuantity(toReference(referenceFood), item.quantity, item.unit, item.grams_per_unit, gramsPerMl);

  if (fromReference) {
    // An estimated per-unit weight, a density, or a guess at dry vs cooked
    // makes the result less trustworthy than an exact match — don't imply
    // false precision.
    const approximate = fromReference.approximate || Boolean(state?.assumed);
    return {
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      ...fromReference.calculated,
      confidence: approximate ? capConfidence(item.confidence, 'medium') : item.confidence,
      estimated: approximate,
      source: 'reference',
      foodId: referenceFood.id,
    };
  }

  if (item.estimated_nutrition) {
    const est = item.estimated_nutrition;
    // A low-confidence, all-zero "estimate" isn't real nutrition data — it's the
    // model admitting it couldn't identify the food (e.g. gibberish input).
    // Trusting it here would silently log a phantom item that never counts
    // toward the day's totals. Treat it the same as no estimate at all.
    const isBogusEstimate =
      item.confidence === 'low' &&
      est.calories === 0 &&
      est.protein === 0 &&
      est.carbohydrate === 0 &&
      est.fat === 0;
    // Numbers recalled from memory with nothing to check them against: drop
    // impossible ones, and mark ones whose calories and macros disagree as rough.
    const verdict = checkEstimate(est, item.description);

    const reference: ReferenceNutrition = {
      servingSize: est.serving_size,
      servingUnit: est.serving_unit,
      calories: est.calories,
      protein: est.protein,
      carbohydrate: est.carbohydrate,
      fat: est.fat,
      fibre: est.fibre ?? undefined,
      sodium: est.sodium ?? undefined,
      sugar: est.sugar ?? undefined,
    };
    const fromEstimate =
      !isBogusEstimate &&
      verdict !== 'impossible' &&
      scaleToLoggedQuantity(reference, item.quantity, item.unit, item.grams_per_unit, gramsPerMl);

    if (fromEstimate) {
      // Never "high": nothing but the model vouches for these numbers.
      const cap = verdict === 'inconsistent' ? 'low' : 'medium';
      return {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        ...fromEstimate.calculated,
        confidence: capConfidence(item.confidence, cap),
        estimated: true,
        source: 'ai_estimate',
      };
    }
  }

  // Spec §39: never invent a confident value when there's nothing to go on —
  // including when the units can't be reconciled (e.g. "1 whole" vs "per 100 g"
  // with no per-unit weight), which would otherwise scale by the wrong amount.
  return {
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    calories: 0,
    protein: 0,
    carbohydrate: 0,
    fat: 0,
    confidence: 'low',
    estimated: true,
    unresolved: true,
  };
};

const resolveOne = async (item: ParsedFoodItem): Promise<ResolvedFoodItem> => {
  const resolved = await resolveNutrition(item);
  // A saved default brings its own amount, so nothing was guessed.
  const portionAssumed = item.quantity_source === 'assumed' && resolved.source !== 'saved_default';
  return portionAssumed ? { ...resolved, portionAssumed } : resolved;
};

/**
 * The AI parser occasionally returns the same food mention as two
 * near-identical entries for a single utterance (a structured-output quirk,
 * not a real "two servings" case — those already carry quantity 2). Collapse
 * items with the same normalized description/quantity/unit before resolving,
 * regardless of which caller (voice, text fallback, manual add) hit this.
 */
const dedupeParsedItems = (items: ParsedFoodItem[]): ParsedFoodItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalize(item.description)}|${item.quantity}|${normalize(item.unit)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const resolveFoodItems = async (items: ParsedFoodItem[]): Promise<ResolvedFoodItem[]> => {
  return Promise.all(dedupeParsedItems(items).map(resolveOne));
};

/** Free-text search over the reference food DB, for manual "add food" pickers (no AI involved). */
export const searchFoods = async (query: string): Promise<FoodRow[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data } = await supabase
    .from('foods')
    .select('id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre, sodium, sugar')
    .ilike('name', `%${normalize(trimmed)}%`)
    .limit(15);

  return data ?? [];
};

/** Builds a full FoodItem from a picked reference food at its default serving — used by manual editing. */
export const foodRowToItem = (food: FoodRow): FoodItem => ({
  id: String(Date.now()),
  description: food.name,
  quantity: food.serving_size,
  unit: food.serving_unit,
  ...calculateNutrition(toReference(food), food.serving_size),
  confidence: 'high',
  estimated: false,
  source: 'food_search',
  foodId: food.id,
});
