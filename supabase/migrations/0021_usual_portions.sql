-- EatLog: a user's usual portion of a food. When they log a food without an
-- amount and answer the portion question, they can ask the app to remember
-- it; next time that food is logged without an amount, their usual portion
-- is used instead of a typical one, and they aren't asked again.

create table public.usual_portions (
  user_id uuid not null references public.users(id) on delete cascade,
  -- The food's description, lowercased with spaces collapsed.
  food_key text not null check (char_length(food_key) between 1 and 200),
  quantity numeric not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (user_id, food_key)
);

alter table public.usual_portions enable row level security;

create policy "users can manage own usual portions" on public.usual_portions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
