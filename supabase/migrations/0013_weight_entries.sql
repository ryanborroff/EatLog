-- EatLog: body weight history, for weight trends on the Insights screen.
-- One weigh-in per user per day: logging again on the same day replaces it.
-- users.weight_kg stays as the "current weight" used for the calorie estimate.

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 700),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.weight_entries enable row level security;

create policy "users can manage own weight entries" on public.weight_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
