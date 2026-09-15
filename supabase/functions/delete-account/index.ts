// Supabase Edge Function: permanently deletes the calling user's own account
// and all their data (spec §38). Only ever acts on the identity carried by
// the verified JWT — there is no way to pass a target user id, so this can
// never delete anyone else's account even if the request body is tampered
// with.
//
// Deleting the auth.users row cascades through every user-owned table via
// their `on delete cascade` foreign keys (public.users -> user_goals,
// user_foods, user_defaults -> user_default_items, meals -> meal_items,
// voice_logs, analytics_events). The one exception is `rate_limits`, which
// has no foreign key at all (by design — see its migration) and is cleaned
// up explicitly below so no orphaned rows linger after the account is gone.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyUser, unauthorizedResponse } from '../_shared/auth.ts';
import { isRateLimited, rateLimitedResponse } from '../_shared/rateLimit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const RATE_LIMIT_PER_MINUTE = 3;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const user = await verifyUser(req);
  if (!user) {
    return unauthorizedResponse();
  }

  if (await isRateLimited(user.id, 'delete-account', RATE_LIMIT_PER_MINUTE)) {
    return rateLimitedResponse();
  }

  // Service role only from here on — deleting an auth user is an admin-only
  // operation, never available to an anon/authenticated-role client.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await adminClient.from('rate_limits').delete().eq('user_id', user.id);

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    return new Response(JSON.stringify({ error: 'Could not delete account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
