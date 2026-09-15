// Supabase Edge Function: answers natural-language questions about the user's
// own food diary (spec §27), strictly from their real Supabase data. Never
// asked to write anything — read-only, and it must say when the data doesn't
// cover the question rather than invent an entry (spec §36).

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Groq's API is OpenAI-compatible — see parse-food/index.ts for the same swap.
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const LOOKBACK_DAYS = 14;

const SYSTEM_PROMPT = `You are EatLog's diary assistant. You answer questions about the user's food diary using ONLY the JSON data provided in this message — you have no other source of truth.

Rules:
- Never invent a diary entry, date, or number that isn't in the provided data.
- If the question is about a date or period outside the provided data (it only covers the last ${LOOKBACK_DAYS} days), say so plainly instead of guessing.
- Answer concisely, in plain English, the way a helpful assistant would — not a data dump.
- You may compute simple aggregates (totals, averages, comparisons) from the provided rows.
- Do not give medical or clinical advice; this is a personal tracking tool, not a clinical system.`;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'AI assistant is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { question: string; localTime: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (typeof body.question !== 'string' || body.question.trim() === '') {
    return new Response(JSON.stringify({ error: 'question is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Scoped to the caller's own JWT — RLS applies exactly as it would for the
  // app client, so this can only ever see the requesting user's rows.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceDate = since.toISOString().split('T')[0];

  const [{ data: meals, error: mealsError }, { data: goals, error: goalsError }] = await Promise.all([
    supabase
      .from('meals')
      .select('date, meal_type, meal_items(description, quantity, unit, calories, protein, carbohydrate, fat)')
      .gte('date', sinceDate)
      .order('date', { ascending: false }),
    supabase.from('user_goals').select('daily_calories, daily_protein, daily_carbs, daily_fat').maybeSingle(),
  ]);

  if (mealsError || goalsError) {
    return new Response(JSON.stringify({ error: 'Could not read diary data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMessage = [
    `Local time: ${body.localTime}`,
    `Goals: ${JSON.stringify(goals ?? {})}`,
    `Diary data (last ${LOOKBACK_DAYS} days): ${JSON.stringify(meals ?? [])}`,
    `Question: ${body.question}`,
  ].join('\n\n');

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
        temperature: 0.2,
      }),
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Could not reach the AI assistant' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!groqResponse.ok) {
    return new Response(JSON.stringify({ error: 'AI assistant request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const completion = await groqResponse.json();
  const answer = completion?.choices?.[0]?.message?.content;

  if (typeof answer !== 'string' || answer.trim() === '') {
    return new Response(JSON.stringify({ error: 'AI assistant returned no answer' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ answer }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
