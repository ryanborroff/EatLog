// Verifies the caller's Supabase JWT before a function does any paid-API
// work. Without this, anyone who discovers a function's URL could call it
// for free and burn the project's Groq quota.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export interface VerifiedUser {
  id: string;
  token: string;
}

/** Returns the verified user for a request's Authorization header, or null if missing/invalid. */
export async function verifyUser(req: Request): Promise<VerifiedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, token };
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
