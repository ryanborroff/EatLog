// Supabase Edge Function: matches foods the app couldn't find by name to a
// real reference food, so their nutrition comes from data rather than the
// AI's memory. For each description it shortlists CoFID foods (and, when a
// brand was named, Open Food Facts products), then asks the model to pick the
// one that is the same food — or none. The model only chooses; the numbers
// returned are the database's.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyUser, unauthorizedResponse } from '../_shared/auth.ts';
import { isRateLimited, rateLimitedResponse } from '../_shared/rateLimit.ts';
import { indexCatalogue, shortlist, CatalogueIndex } from './search.ts';
import { searchBranded, ProductNutrition } from './openFoodFacts.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
// Picking from a shortlist is an easy job, and Groq rate-limits each model
// separately, so this stays off parse-food's larger model and its token budget.
const GROQ_MODEL = Deno.env.get('GROQ_MATCH_MODEL') ?? 'openai/gpt-oss-20b';
const RATE_LIMIT_PER_MINUTE = 20;
// One meal's items plus their ingredients.
const MAX_QUERIES = 30;
const SHORTLIST_SIZE = 12;

interface Query {
  key: string;
  description: string;
  preparation: string | null;
  brand: string | null;
}

interface FoodRow {
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

/** What the app gets back for a query: a food to scale, or null for "no match". */
interface Match {
  key: string;
  food: (FoodRow & { source: 'cofid' }) | (Omit<FoodRow, 'id'> & { id: null; source: 'open_food_facts' }) | null;
}

const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// The CoFID catalogue barely changes, so it's loaded once per function instance.
let catalogue: Promise<{ rows: Map<string, FoodRow>; index: CatalogueIndex }> | null = null;

const loadCatalogue = () => {
  catalogue ??= (async () => {
    const rows: FoodRow[] = [];
    // PostgREST caps each response at 1,000 rows.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await serviceClient
        .from('foods')
        .select('id, name, serving_size, serving_unit, calories, protein, carbohydrate, fat, fibre, sodium, sugar')
        .eq('source', 'cofid')
        .order('id')
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...(data as FoodRow[]));
      if (!data || data.length < 1000) break;
    }
    return { rows: new Map(rows.map((row) => [row.id, row])), index: indexCatalogue(rows) };
  })().catch((error) => {
    catalogue = null; // retry on the next request
    throw error;
  });
  return catalogue;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const isQuery = (value: unknown): value is Query => {
  const q = value as Query;
  return (
    typeof q === 'object' &&
    q !== null &&
    typeof q.key === 'string' &&
    typeof q.description === 'string' &&
    q.description.trim() !== '' &&
    q.description.length <= 200 &&
    (q.preparation === null || typeof q.preparation === 'string') &&
    (q.brand === null || typeof q.brand === 'string')
  );
};

interface Candidate {
  label: string;
  /** Shown to the model so it can weigh crowd-sourced products against reference data. */
  kind: 'reference' | 'branded product';
  name: string;
  kcalPer100: number;
  pick: () => Match['food'];
}

const SYSTEM_PROMPT = `You match foods someone ate to entries in a food database, for EatLog, a UK food diary.

For each query you get a description of one food (with how it was prepared and its brand, when known) and a numbered list of candidate database entries with their kcal per 100 g. Choose the candidate that is the same food, prepared the same way — or null.

Rules:
- Choose a candidate only if its nutrition would be a fair stand-in for what was eaten. Same food, same kind of preparation (fried vs grilled, cooked vs raw, with vs without skin, in batter or not).
- When the preparation isn't stated, prefer the way the food is normally eaten (cooked meat and fish, boiled rice and pasta, raw fruit), not raw ingredients.
- A dish and its main ingredient are different foods: "chicken curry" is not "Chicken, breast, grilled"; "apple pie" is not "Apples, raw".
- A close variant is fine when nothing better is listed (e.g. "Lasagne, homemade" for "beef lasagne"; "Curry, chicken, homemade" for "chicken jalfrezi").
- When a brand was named and a candidate is that brand's product of that food, choose it over a generic reference entry — unless their kcal per 100 g disagree a lot: branded products are crowd-sourced and sometimes mislabelled, so then prefer the reference entry.
- Never choose an alcohol-free, low-alcohol, diet, zero-sugar, light or low-fat version unless the description says so ("Guinness" is the regular stout, not Guinness 0.0) — and never the regular version when the description names one of those.
- If no candidate is a fair stand-in, choose null. A wrong match is worse than none.

Respond with JSON only: {"matches": [{"query": "<query id>", "choice": "<candidate number>" | null}]} with one entry per query.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matches'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['query', 'choice'],
        properties: { query: { type: 'string' }, choice: { type: ['string', 'null'] } },
      },
    },
  },
};

const describe = (query: Query): string =>
  [
    `"${query.description}"`,
    query.preparation ? `preparation: ${query.preparation}` : null,
    query.brand ? `brand: ${query.brand}` : null,
  ]
    .filter(Boolean)
    .join(', ');

/** Asks the model to choose among each query's candidates. Returns query id -> candidate label (or null). */
async function choose(queries: { id: string; query: Query; candidates: Candidate[] }[]): Promise<Map<string, string | null>> {
  const userMessage = queries
    .map(
      ({ id, query, candidates }) =>
        `Query ${id}: ${describe(query)}\n` +
        candidates.map((c) => `  ${c.label}. ${c.name} (${c.kind}, ${Math.round(c.kcalPer100)} kcal/100 g)`).join('\n')
    )
    .join('\n\n');

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'food_matches', strict: true, schema: RESPONSE_SCHEMA } },
        temperature: 0,
      }),
    });
    if (!response.ok) {
      console.error(`match-food attempt ${attempt} failed: ${response.status} ${(await response.text()).slice(0, 500)}`);
      continue;
    }
    try {
      const content = (await response.json())?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content) as { matches: { query: string; choice: string | null }[] };
      return new Map(parsed.matches.map((m) => [m.query, m.choice]));
    } catch (error) {
      console.error(`match-food attempt ${attempt} returned unusable output:`, error);
    }
  }
  throw new Error('Food matching failed');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!GROQ_API_KEY) return json({ error: 'Food matching is not configured' }, 503);

  const user = await verifyUser(req);
  if (!user) return unauthorizedResponse();
  if (await isRateLimited(user.id, 'match-food', RATE_LIMIT_PER_MINUTE)) return rateLimitedResponse();

  let queries: Query[];
  try {
    const body = await req.json();
    queries = body?.queries;
    if (!Array.isArray(queries) || queries.length > MAX_QUERIES || !queries.every(isQuery)) {
      return json({ error: 'Invalid queries' }, 400);
    }
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (queries.length === 0) return json({ matches: [] });

  try {
    const { rows, index } = await loadCatalogue();

    // Branded products are looked up in parallel; generic foods only need CoFID.
    const branded = await Promise.all(
      queries.map((q) => (q.brand ? searchBranded(q.brand, q.description) : Promise.resolve([] as ProductNutrition[])))
    );

    const asked = queries.map((query, i) => {
      const products: Candidate[] = branded[i].map((product) => ({
        label: '',
        kind: 'branded product' as const,
        name: product.name,
        kcalPer100: product.calories,
        pick: () => ({
          id: null,
          source: 'open_food_facts' as const,
          name: product.name,
          serving_size: 100,
          serving_unit: 'g',
          calories: product.calories,
          protein: product.protein,
          carbohydrate: product.carbohydrate,
          fat: product.fat,
          fibre: product.fibre,
          sodium: product.sodium,
          sugar: product.sugar,
        }),
      }));
      const generic: Candidate[] = shortlist(index, `${query.preparation ?? ''} ${query.description}`, SHORTLIST_SIZE).map(
        (entry) => {
          const row = rows.get(entry.id)!;
          return {
            label: '',
            kind: 'reference' as const,
            name: row.name,
            kcalPer100: row.calories,
            pick: () => ({ ...row, source: 'cofid' as const }),
          };
        }
      );
      const candidates = [...products, ...generic].map((c, n) => ({ ...c, label: String(n + 1) }));
      return { id: String(i + 1), query, candidates };
    });

    const withCandidates = asked.filter((q) => q.candidates.length > 0);
    const choices = withCandidates.length > 0 ? await choose(withCandidates) : new Map<string, string | null>();

    const matches: Match[] = asked.map(({ id, query, candidates }) => {
      const choice = choices.get(id);
      const candidate = choice ? candidates.find((c) => c.label === choice) : undefined;
      return { key: query.key, food: candidate ? candidate.pick() : null };
    });
    return json({ matches });
  } catch (error) {
    console.error('match-food failed:', error);
    return json({ error: 'Food matching failed' }, 502);
  }
});
