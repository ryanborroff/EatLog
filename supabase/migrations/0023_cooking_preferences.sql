-- EatLog: whether a user weighs a grain dry or cooked. Pasta, rice and the
-- like are 2–3x more calorific per gram dry, so when one is logged by weight
-- without saying which, the app asks; the user can have their answer
-- remembered so they aren't asked about that food again.

create table public.cooking_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  -- The food's description, lowercased with spaces collapsed.
  food_key text not null check (char_length(food_key) between 1 and 200),
  weighed text not null check (weighed in ('dry', 'cooked')),
  updated_at timestamptz not null default now(),
  primary key (user_id, food_key)
);

alter table public.cooking_preferences enable row level security;

create policy "users can manage own cooking preferences" on public.cooking_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
