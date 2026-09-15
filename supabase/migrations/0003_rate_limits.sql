-- EatLog Stage 5: per-user rate limiting for the Edge Functions.
-- Written only by Edge Functions using the service role key — never exposed
-- to the client, so no RLS is needed.

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  function_name text not null,
  window_start timestamptz not null,
  count int not null default 1
);

create unique index rate_limits_user_function_window
  on public.rate_limits (user_id, function_name, window_start);
