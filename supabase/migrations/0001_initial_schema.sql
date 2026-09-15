-- EatLog Stage 2: initial schema, RLS policies, auth trigger.
-- Run this once in the Supabase SQL editor for a fresh project.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  daily_calories int not null default 2000,
  daily_protein int not null default 130,
  daily_carbs int,
  daily_fat int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  serving_size numeric not null,
  serving_unit text not null,
  calories numeric not null,
  protein numeric not null,
  carbohydrate numeric not null,
  fat numeric not null,
  fibre numeric,
  source text not null default 'standard',
  source_id text,
  created_at timestamptz not null default now()
);

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null
);

create table public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now()
);

create table public.user_defaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  type text not null,
  food_id uuid references public.foods(id),
  quantity numeric,
  unit text,
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  meal_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  food_id uuid references public.foods(id),
  description text not null,
  quantity numeric not null,
  unit text not null,
  calories numeric not null,
  protein numeric not null,
  carbohydrate numeric not null,
  fat numeric not null,
  fibre numeric,
  confidence text not null default 'medium',
  estimated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voice_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  transcription text not null,
  parsed_result jsonb,
  created_at timestamptz not null default now()
);

-- Auto-create a public.users row (and default goals) when someone signs up.
create function public.handle_new_user() returns trigger as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  insert into public.user_goals (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security -------------------------------------------------------

alter table public.users enable row level security;
alter table public.user_goals enable row level security;
alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.user_foods enable row level security;
alter table public.user_defaults enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.voice_logs enable row level security;

create policy "users can read/update own row" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users can manage own goals" on public.user_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own saved foods" on public.user_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own defaults" on public.user_defaults
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own voice logs" on public.voice_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can manage own meal items" on public.meal_items
  for all using (
    meal_id in (select id from public.meals where user_id = auth.uid())
  ) with check (
    meal_id in (select id from public.meals where user_id = auth.uid())
  );

-- foods / food_aliases are shared reference data: readable by any authenticated
-- user, writable only by the service role (no insert/update/delete policy here).
create policy "authenticated users can read foods" on public.foods
  for select using (auth.role() = 'authenticated');

create policy "authenticated users can read food aliases" on public.food_aliases
  for select using (auth.role() = 'authenticated');
