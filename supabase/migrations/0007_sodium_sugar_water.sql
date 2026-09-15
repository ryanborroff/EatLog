-- EatLog: track sodium and sugar per food item, and daily water intake.

alter table public.foods add column sodium numeric;
alter table public.foods add column sugar numeric;

alter table public.meal_items add column sodium numeric;
alter table public.meal_items add column sugar numeric;

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  amount_ml int not null,
  created_at timestamptz not null default now()
);

alter table public.water_logs enable row level security;

create policy "users can manage own water logs" on public.water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
