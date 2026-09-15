-- EatLog Stage 5: product analytics (spec §43). Insert-only from the client;
-- properties must never contain diary content (transcripts, food
-- descriptions) — only small non-content fields (counts, enums, booleans).

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_name text not null,
  properties jsonb,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create policy "users can insert own events" on public.analytics_events
  for insert with check (auth.uid() = user_id);
