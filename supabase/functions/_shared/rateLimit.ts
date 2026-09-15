// Simple per-user, per-function, per-minute rate limit backed by the
// `rate_limits` table. Uses the service role key since that table has no
// client-facing RLS — it's only ever touched from inside Edge Functions.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Floors a timestamp to the start of its minute, as an ISO string. */
function currentWindowStart(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
}

/**
 * Increments this user's request count for the current one-minute window and
 * returns whether they've now exceeded `limit`. Fails open (allows the
 * request) if the rate-limit table itself is unreachable — a rate limiter
 * outage shouldn't take down the whole feature.
 */
export async function isRateLimited(
  userId: string,
  functionName: string,
  limit: number
): Promise<boolean> {
  const windowStart = currentWindowStart();

  const { data: existing } = await serviceClient
    .from('rate_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .eq('window_start', windowStart)
    .maybeSingle();

  if (!existing) {
    const { error } = await serviceClient
      .from('rate_limits')
      .insert({ user_id: userId, function_name: functionName, window_start: windowStart, count: 1 });
    if (error) return false; // fail open
    return 1 > limit;
  }

  const newCount = existing.count + 1;
  const { error } = await serviceClient
    .from('rate_limits')
    .update({ count: newCount })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .eq('window_start', windowStart);

  if (error) return false; // fail open

  return newCount > limit;
}

export function rateLimitedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Too many requests, please slow down.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
}
