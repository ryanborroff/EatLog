// Supabase Edge Function: interprets a natural-language food description into
// structured items. Called only from the authenticated app client via
// supabase.functions.invoke('parse-food', ...). The AI never writes to the
// database and never returns final calorie arithmetic (spec §14/§34/§36) —
// this function returns structured items only; the client resolves foods and
// computes totals.

import { validateParsedFoodResult } from './schema.ts';
import { verifyUser, unauthorizedResponse } from '../_shared/auth.ts';
import { isRateLimited, rateLimitedResponse } from '../_shared/rateLimit.ts';

// Groq's API is OpenAI-compatible (same request/response shape), so this is
// otherwise unchanged from an OpenAI integration — just a different base URL,
// key, and default model. Free tier: https://console.groq.com
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b';

const MAX_TRANSCRIPT_LENGTH = 500;
const RATE_LIMIT_PER_MINUTE = 10;

const JSON_SHAPE_DESCRIPTION = `Respond with a single JSON object, no prose, matching exactly this shape:
{
  "intent": "log_food" | "correction",
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "items": [{ "description": string, "brand": string | null, "quantity": number, "unit": string, "preparation": string | null, "confidence": "high" | "medium" | "low", "estimated_nutrition": { "serving_size": number, "serving_unit": string, "calories": number, "protein": number, "carbohydrate": number, "fat": number, "fibre": number | null, "sodium": number | null, "sugar": number | null } | null }] | null,
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
- Never invent a brand. Only set "brand" when the user said one.
- Each distinct food or dish the user mentions is its own item. Never merge two separate foods into one item's description (e.g. "vegetable chilli" and "tortilla chips" are two items, not one "vegetable chilli tortilla chips"). Write each item's description in lowercase, except for capitalizing only the first letter of the description itself (sentence case) — never capitalize other words within it.
- Classify meal_type from explicit language first ("I had dinner: steak and chips" -> dinner), otherwise infer from the description and the given local time.
- Use UK terminology and units as spoken (grams, ml, pint, tin, packet, slice, handful, courgette, aubergine, coriander, rocket, crisps, yoghurt, jacket potato). Do not convert to US terms or units.
- Always spell it "wholegrain" as one word (e.g. "wholegrain rice", "wholegrain bread"), never "whole grain" or "whole-grain", regardless of how the user said it.
- Set needs_clarification to true, with a short clarification_question and 3-4 clarification_options, only when the ambiguity materially affects nutrition (e.g. "some pasta" with no portion cue at all). Do not ask for clarification on minor details.
- For each item, if you can identify it as a specific known packaged/reference food with reasonably confident nutrition values, still provide your best estimated_nutrition per a stated serving_size/serving_unit (this lets the app double check against its own food database) — set confidence to "high" only when both the identification and the quantity are clear.
- If you cannot confidently estimate nutrition for an item at all, still return your best-effort estimated_nutrition but set confidence to "low".
- You are never responsible for final arithmetic on the logged quantity — always give estimated_nutrition per the serving_size/serving_unit you specify, not pre-multiplied by the user's quantity.
- Never fabricate a previous diary entry or reference anything the user did not say.
- Each distinct food/drink the user mentions gets exactly one entry in "items". Never list the same food twice as separate entries to represent one mention — if they ate two servings of something, that's a single item with quantity 2, not two items with quantity 1.

CORRECTIONS: you may be given the "most recently logged meal" as context. If the transcript is clearly a correction to that meal rather than a new food entry — e.g. "actually it was tuna", "add mayonnaise", "remove the crisps", "change the yoghurt to Greek yoghurt", "that was lunch, not dinner" — set intent to "correction" and describe what changed as one or more operations against that meal's item descriptions, instead of treating it as a new log. Only use "correction" intent when recent meal context was actually provided and the transcript is unambiguously about modifying it. Every other utterance, including one that merely mentions food already in the recent meal without a corrective phrasing, is intent "log_food".

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

  let groqResponse: Response;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Could not reach the AI parser' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!groqResponse.ok) {
    return new Response(JSON.stringify({ error: 'AI parser request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const completion = await groqResponse.json();
  const rawContent = completion?.choices?.[0]?.message?.content;

  if (typeof rawContent !== 'string') {
    return new Response(JSON.stringify({ error: 'AI parser returned no content' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return new Response(JSON.stringify({ error: 'AI parser returned invalid JSON' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const validated = validateParsedFoodResult(parsed);
    return new Response(JSON.stringify(validated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `AI parser output failed validation: ${(err as Error).message}` }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
