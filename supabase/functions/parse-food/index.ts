// Supabase Edge Function: interprets a natural-language food description into
// structured items. Called only from the authenticated app client via
// supabase.functions.invoke('parse-food', ...). The AI never writes to the
// database and never returns final calorie arithmetic (spec §14/§34/§36) —
// this function returns structured items only; the client resolves foods and
// computes totals.

import { validateParsedFoodResult, ParsedFoodResult, PARSED_FOOD_JSON_SCHEMA } from './schema.ts';
import { verifyUser, unauthorizedResponse } from '../_shared/auth.ts';
import { isRateLimited, rateLimitedResponse } from '../_shared/rateLimit.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Groq's API is OpenAI-compatible (same request/response shape), so this is
// otherwise unchanged from an OpenAI integration — just a different base URL,
// key, and default model. Free tier: https://console.groq.com
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
// The larger model by default: its nutrition estimates are the last resort
// for foods no database knows, so recall matters more than the speed saved.
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
// Used for the retry. Groq rate-limits each model separately, so a different
// model can still answer when the main one is over its tokens-per-minute limit.
const GROQ_FALLBACK_MODEL = Deno.env.get('GROQ_FALLBACK_MODEL') ?? 'openai/gpt-oss-20b';

// Room for a clarification answer, which is sent together with the original
// description and the question it answers.
const MAX_TRANSCRIPT_LENGTH = 1000;
const RATE_LIMIT_PER_MINUTE = 10;
const MAX_ATTEMPTS = 2;
// Longest we'll wait out a rate limit before retrying on the same model.
const MAX_RATE_LIMIT_WAIT_MS = 10_000;

const JSON_SHAPE_DESCRIPTION = `Respond with a single JSON object, no prose, matching exactly this shape:
{
  "intent": "log_food" | "correction",
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "items": [{ "description": string, "brand": string | null, "quantity": number, "unit": string, "quantity_source": "stated" | "vague" | "assumed", "grams_per_unit": number | null, "preparation": string | null, "confidence": "high" | "medium" | "low", "ingredients": [{ "description": string, "grams": number, "preparation": string | null }] | null, "estimated_nutrition": { "serving_size": number, "serving_unit": string, "calories": number, "protein": number, "carbohydrate": number, "fat": number, "fibre": number | null, "sodium": number | null, "sugar": number | null } | null }] | null,
  "operations": [{ "type": "replace_item" | "remove_item" | "add_item" | "update_quantity" | "change_meal_type", "target_description": string | null, "item": <same item shape as above> | null, "new_quantity": number | null, "new_unit": string | null, "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | null }] | null,
  "needs_clarification": boolean,
  "clarification_question": string | null,
  "clarification_options": string[] | null
}
For intent "log_food": set items and meal_type, set operations to null.
For intent "correction": set operations, set items and meal_type to null.`;

const SYSTEM_PROMPT = `You are the food-interpretation engine for EatLog, a UK-based voice food diary.

Given a natural-language description of what someone ate, extract structured data. Follow these rules exactly:

- Preserve quantities the user actually stated (e.g. "three eggs" -> quantity 3, unit "whole"). Do not round or "correct" them.
- Where a quantity is vague ("a handful of almonds", "some pasta"), provide a reasonable estimate and mark confidence as "medium" or "low" accordingly. Never invent a suspiciously precise quantity (e.g. "137g") for a vague description.
- Never invent a brand. Only set "brand" when the user clearly said a real brand name — never treat an unfamiliar or misheard word as a brand.
- The description often comes from speech recognition and may contain mis-transcribed food words (e.g. "vercelli noodles" for "vermicelli noodles", "keen wah" for "quinoa"). When a word is clearly a mishearing of a food, write the item's description using the correct food name.
- Each distinct food or dish the user mentions is its own item. Never merge two separate foods into one item's description (e.g. "vegetable chilli" and "tortilla chips" are two items, not one "vegetable chilli tortilla chips"). Write each item's description in lowercase as it would read mid-sentence (e.g. "sourdough toast with melted cheese", "tea with whole milk") — the app adds the quantity in front and capitalizes the line itself. Keep the usual capitals of brand names, product names and other proper nouns (e.g. "Special K cereal with whole milk", "Greek yoghurt", "Weetabix", "Big Mac").
- Classify meal_type from explicit language first ("I had dinner: steak and chips" -> dinner), otherwise infer from the description and the given local time.
- Use UK terminology and units as spoken (grams, ml, pint, tin, packet, slice, handful, courgette, aubergine, coriander, rocket, crisps, yoghurt, jacket potato). Do not convert to US terms or units.
- Always spell it "wholegrain" as one word (e.g. "wholegrain rice", "wholegrain bread"), never "whole grain" or "whole-grain", regardless of how the user said it.
- quantity_source: "stated" when the user gave an amount — a number, weight, volume or count, including "a"/"an"/"one" of a natural unit ("200g chicken", "two slices", "a banana", "a pint"); "vague" when they gave only a rough amount or size ("some", "a bit of", "a handful", "a big plate of", "a small bowl"); "assumed" when they gave no amount at all ("pasta for dinner", "chicken and rice") and you picked a typical portion.
- Set needs_clarification to true, with a short clarification_question and 3-4 clarification_options, only when what the food is — not how much — is ambiguous in a way that materially affects nutrition. Never ask about portion size: when no amount was given, estimate a typical portion and set quantity_source to "assumed" — the app asks the user about portions itself. Do not ask for clarification on minor details.
- For each item, if you can identify it as a specific known packaged/reference food with reasonably confident nutrition values, still provide your best estimated_nutrition per a stated serving_size/serving_unit (this lets the app double check against its own food database) — set confidence to "high" only when both the identification and the quantity are clear.
- If you cannot confidently estimate nutrition for an item at all, still return your best-effort estimated_nutrition but set confidence to "low".
- grams_per_unit: when "unit" is a count or portion rather than a weight/volume (e.g. "whole", "slice", "rasher", "piece", "bowl", "packet", "bar"), set grams_per_unit to your best estimate of the edible weight in grams of ONE such unit (e.g. 1 whole medium egg -> 50, 1 slice of bread -> 36, 1 medium banana -> 100). For a bowl, plate or portion, that is the weight as eaten (e.g. a bowl of porridge or of cooked rice, not the dry oats or rice that went into it). When "unit" is a spoon or cup measure (tsp, tbsp, cup) of a food that isn't a liquid, set grams_per_unit to the weight of one level measure of that food (e.g. 1 cup of rolled oats -> 90, 1 tbsp of peanut butter -> 16, 1 cup of grated cheese -> 110). For weights (g, kg, oz), for ml, l and pint, and for spoon or cup measures of liquids, set it to null.
- ingredients: for a home-made or mixed dish that isn't one standard food (e.g. "chicken stir fry", "tuna pasta bake", "salad with feta and olives", "a ham and cheese sandwich", "homemade chilli"), list its main ingredients (2 to 8), each with its weight in grams for the WHOLE amount logged (all of quantity × unit, as eaten) and how it was prepared. Include cooking oil, butter, dressings and sauces, which carry a lot of the calories. The weights should add up to roughly the dish's total weight. For single foods (an apple, toast, a latte, a chocolate bar) and well-known standard dishes or products (lasagne, a Big Mac, a Greggs sausage roll), set ingredients to null. Each ingredient is still part of this one item — never also list it as a separate item.
- Rice, pasta, noodles, couscous, lentils, quinoa and oats: when the user says whether the amount was weighed dry/uncooked or cooked, set "preparation" to "dry" or "cooked" and keep the description to the food itself (e.g. "100g uncooked basmati rice" -> description "basmati rice", preparation "dry").
- "quantity" must always be a positive number — never 0 or null. When the user didn't state an amount, estimate a typical one and lower the confidence.
- Sauces, oils, condiments, dressings, spreads and seasonings (soy sauce, sesame oil, mayonnaise, butter, ketchup): always use a weight or volume unit ("g", "ml", "tsp" or "tbsp"), never "drizzle", "splash", "dash", "serving" or similar. If no amount was stated, estimate a typical amount (e.g. 1 tsp of sesame oil) and set confidence to "low".
- estimated_nutrition's serving_unit must be either the item's own "unit" or a weight/volume ("g" or "ml", e.g. per 100 g), so the app can scale it to the logged quantity.
- You are never responsible for final arithmetic on the logged quantity — always give estimated_nutrition per the serving_size/serving_unit you specify, not pre-multiplied by the user's quantity.
- Never fabricate a previous diary entry or reference anything the user did not say.
- Each distinct food/drink the user mentions gets exactly one entry in "items". Never list the same food twice as separate entries to represent one mention — if they ate two servings of something, that's a single item with quantity 2, not two items with quantity 1.

CORRECTIONS: you may be given the "most recently logged meal" as context. If the transcript is clearly a correction to that meal rather than a new food entry — e.g. "actually it was tuna", "add mayonnaise", "remove the crisps", "change the yoghurt to Greek yoghurt", "that was lunch, not dinner" — set intent to "correction" and describe what changed as one or more operations against that meal's item descriptions, instead of treating it as a new log. For "update_quantity", also set "item" to the full updated item (with the new quantity and unit, grams_per_unit and estimated_nutrition), so the app can recalculate it when the unit changes (e.g. "2 slices" -> "100 g"). Only use "correction" intent when recent meal context was actually provided and the transcript is unambiguously about modifying it. Every other utterance, including one that merely mentions food already in the recent meal without a corrective phrasing, is intent "log_food".

Output shape: always include both "items" and "operations" keys — set the one that doesn't apply to your intent to null (log_food: items populated, operations null, meal_type set; correction: operations populated, items null, meal_type null).

${JSON_SHAPE_DESCRIPTION}`;

interface RequestBody {
  transcript: string;
  mealHint?: string;
  localTime: string;
  recentMeal?: {
    mealType: string;
    items: { description: string; quantity: number; unit: string }[];
  } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI parser is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await verifyUser(req);
  if (!user) {
    return unauthorizedResponse();
  }

  if (await isRateLimited(user.id, 'parse-food', RATE_LIMIT_PER_MINUTE)) {
    return rateLimitedResponse();
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (typeof body.transcript !== 'string' || body.transcript.trim() === '') {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return new Response(JSON.stringify({ error: 'transcript is too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMessage = [
    `Local time: ${body.localTime}`,
    body.mealHint ? `Meal hint: ${body.mealHint}` : null,
    body.recentMeal
      ? `Most recently logged meal (${body.recentMeal.mealType}): ${body.recentMeal.items
          .map((i) => `${i.quantity} ${i.unit} ${i.description}`)
          .join(', ')}`
      : 'No recently logged meal is available as context — always use intent "log_food".',
    `Description: ${body.transcript}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Model output is non-deterministic, so one bad generation shouldn't fail
  // the user's entry — retry once, on the larger model, before giving up.
  let failure: ParseFailure | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = attempt === 1 ? GROQ_MODEL : GROQ_FALLBACK_MODEL;
    // Retrying a rate-limited model straight away fails again, so wait out a
    // short limit first. A different model has its own limit and needn't wait.
    if (failure?.upstreamStatus === 429 && model === GROQ_MODEL && failure.retryAfterMs !== undefined) {
      if (failure.retryAfterMs > MAX_RATE_LIMIT_WAIT_MS) break;
      await new Promise((resolve) => setTimeout(resolve, failure!.retryAfterMs));
    }
    // A 400 other than json_validate_failed means Groq rejected the strict
    // schema request itself, so fall back to plain JSON mode for the retry.
    const schemaRejected =
      failure?.upstreamStatus === 400 && failure.upstreamError?.code !== 'json_validate_failed';
    const strict = !schemaRejected;
    const outcome = await attemptParse(userMessage, model, strict);
    if ('result' in outcome) {
      return new Response(JSON.stringify(outcome.result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    failure = outcome;
    // Visible in the Supabase dashboard's function logs.
    console.error(`parse-food attempt ${attempt}/${MAX_ATTEMPTS} (${model}) failed: ${outcome.error}`, outcome.detail ?? '');
    await recordFailure(user.id, attempt, model, strict, outcome);
  }

  // Passed on as a 429 so the app can tell the user to wait rather than rephrase.
  return new Response(JSON.stringify({ error: failure!.error }), {
    status: failure!.upstreamStatus === 429 ? 429 : failure!.status,
    headers: { 'Content-Type': 'application/json' },
  });
});

interface ParseFailure {
  status: number;
  error: string;
  detail?: string;
  upstreamStatus?: number;
  /** Groq's error type/code/message — describes the failure, never the diary content. */
  upstreamError?: { type?: string; code?: string; message?: string };
  /** How long Groq asked us to wait before retrying, when it rate-limited the request. */
  retryAfterMs?: number;
  /** Shape of the output that failed (lengths, error positions) — never its content. */
  generation?: { length: number; validJson: boolean; parseErrorPosition: number | null; validationError: string | null };
}

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/**
 * Records a failed attempt as an analytics event so failures can be diagnosed
 * from the database. Per the analytics_events policy, no diary content: only
 * error codes, messages and sizes, never the transcript or the model's output.
 * Best-effort — never lets logging break the request.
 */
async function recordFailure(
  userId: string,
  attempt: number,
  model: string,
  strict: boolean,
  failure: ParseFailure
): Promise<void> {
  try {
    await serviceClient.from('analytics_events').insert({
      user_id: userId,
      event_name: 'parse_food_attempt_failed',
      properties: {
        attempt,
        strict,
        model,
        error: failure.error.slice(0, 200),
        upstream_status: failure.upstreamStatus ?? null,
        upstream_type: failure.upstreamError?.type ?? null,
        upstream_code: failure.upstreamError?.code ?? null,
        upstream_message: failure.upstreamError?.message?.slice(0, 300) ?? null,
        generation_length: failure.generation?.length ?? null,
        generation_valid_json: failure.generation?.validJson ?? null,
        generation_parse_error_position: failure.generation?.parseErrorPosition ?? null,
        generation_validation_error: failure.generation?.validationError?.slice(0, 200) ?? null,
      },
    });
  } catch (err) {
    console.error('Failed to record parse failure:', err);
  }
}

/**
 * Parses and validates raw model output. V8's JSON.parse messages quote a
 * snippet of the input, so only the error position is kept for diagnostics.
 */
function parseModelOutput(raw: string): { result: ParsedFoodResult } | { generation: NonNullable<ParseFailure['generation']> } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const position = /position (\d+)/.exec((err as Error).message);
    return {
      generation: {
        length: raw.length,
        validJson: false,
        parseErrorPosition: position ? Number(position[1]) : null,
        validationError: null,
      },
    };
  }
  try {
    return { result: validateParsedFoodResult(parsed) };
  } catch (err) {
    return {
      generation: { length: raw.length, validJson: true, parseErrorPosition: null, validationError: (err as Error).message },
    };
  }
}

/**
 * Groq's suggested wait on a 429: its message is more precise ("try again in
 * 269.99ms") than the whole-second retry-after header, so prefer that.
 */
function retryAfterMs(response: Response, message: string | undefined): number | undefined {
  const match = /try again in ([\d.]+)(ms|s)/.exec(message ?? '');
  if (match) return Math.ceil(Number(match[1]) * (match[2] === 's' ? 1000 : 1));
  const header = Number(response.headers.get('retry-after'));
  return Number.isFinite(header) && header > 0 ? header * 1000 : undefined;
}

async function attemptParse(
  userMessage: string,
  model: string,
  strict: boolean
): Promise<{ result: ParsedFoodResult } | ParseFailure> {
  let groqResponse: Response;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        // Strict structured outputs constrain the reply to this schema.
        response_format: strict
          ? { type: 'json_schema', json_schema: { name: 'parsed_food', strict: true, schema: PARSED_FOOD_JSON_SCHEMA } }
          : { type: 'json_object' },
        temperature: 0.2,
      }),
    });
  } catch (err) {
    return { status: 502, error: 'Could not reach the AI parser', detail: String(err) };
  }

  if (!groqResponse.ok) {
    const body = await groqResponse.text().catch(() => '');
    let upstreamError: ParseFailure['upstreamError'];
    let failedGeneration: string | undefined;
    try {
      const e = JSON.parse(body)?.error;
      upstreamError = { type: e?.type, code: e?.code, message: e?.message };
      if (typeof e?.failed_generation === 'string') failedGeneration = e.failed_generation;
    } catch {
      // Non-JSON error body; the status alone will have to do.
    }

    // Groq rejects output that doesn't pass its own JSON/schema check, but
    // hands back what the model wrote. Our validator is more forgiving (it
    // repairs sloppy items), so try to salvage that before failing.
    let generation: ParseFailure['generation'];
    if (failedGeneration !== undefined) {
      const salvaged = parseModelOutput(failedGeneration);
      if ('result' in salvaged) return salvaged;
      generation = salvaged.generation;
    }

    return {
      status: 502,
      error: `AI parser request failed (${groqResponse.status})`,
      detail: body.slice(0, 2000),
      upstreamStatus: groqResponse.status,
      upstreamError,
      retryAfterMs: groqResponse.status === 429 ? retryAfterMs(groqResponse, upstreamError?.message) : undefined,
      generation,
    };
  }

  const completion = await groqResponse.json();
  const rawContent = completion?.choices?.[0]?.message?.content;

  if (typeof rawContent !== 'string') {
    return { status: 502, error: 'AI parser returned no content' };
  }

  const outcome = parseModelOutput(rawContent);
  if ('result' in outcome) return outcome;
  return {
    status: 422,
    error: outcome.generation.validJson ? 'AI parser output failed validation' : 'AI parser returned invalid JSON',
    detail: rawContent.slice(0, 1000),
    generation: outcome.generation,
  };
}
