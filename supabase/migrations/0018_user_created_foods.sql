-- EatLog: let users create their own foods ("My foods", barcode scans).
--
-- foods was reference data writable only by the service role, so the client's
-- insert in createUserFood was rejected by RLS and every save failed.
-- User foods are now owned via created_by and visible only to their owner;
-- reference foods (created_by null) stay readable by everyone.

alter table public.foods
  add column created_by uuid references public.users(id) on delete cascade;

drop policy "authenticated users can read foods" on public.foods;

create policy "authenticated users can read reference and own foods" on public.foods
  for select using (
    auth.role() = 'authenticated'
    and (created_by is null or created_by = auth.uid())
  );

create policy "users can create own foods" on public.foods
  for insert with check (source = 'user' and created_by = auth.uid());

create policy "users can delete own foods" on public.foods
  for delete using (created_by = auth.uid());
