-- EatLog Stage 4: multi-item meal defaults (e.g. "usual breakfast").

create table public.user_default_items (
  id uuid primary key default gen_random_uuid(),
  default_id uuid not null references public.user_defaults(id) on delete cascade,
  food_id uuid references public.foods(id),
  description text not null,
  quantity numeric not null,
  unit text not null,
  created_at timestamptz not null default now()
);

alter table public.user_default_items enable row level security;

create policy "users can manage own default items" on public.user_default_items
  for all using (
    default_id in (select id from public.user_defaults where user_id = auth.uid())
  ) with check (
    default_id in (select id from public.user_defaults where user_id = auth.uid())
  );
