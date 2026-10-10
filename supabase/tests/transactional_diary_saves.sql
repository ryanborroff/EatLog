-- Run with psql -v ON_ERROR_STOP=1 against a disposable migrated database.
-- Rolls back fixtures; never use real user identities.
begin;
insert into auth.users(id, email) values
 ('11111111-1111-4111-8111-111111111111', 'transaction-test-1@example.invalid'),
 ('22222222-2222-4222-8222-222222222222', 'transaction-test-2@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare
  item jsonb := '[{"description":"toast","quantity":1,"unit":"slice","calories":80,"protein":3,"carbohydrate":15,"fat":1}]';
  invalid jsonb := '[{"quantity":1,"unit":"slice","calories":80,"protein":3,"carbohydrate":15,"fat":1}]';
  breakfast uuid;
  lunch uuid;
  result uuid;
begin
  breakfast := public.persist_diary_meal('2026-10-10', 'breakfast', item);
  result := public.persist_diary_meal('2026-10-10', 'breakfast', item);
  if result <> breakfast or (select count(*) from public.meal_items where meal_id = breakfast) <> 2 then
    raise exception 'Addition did not join the existing meal';
  end if;
  begin
    perform public.persist_diary_meal('2026-10-10', 'breakfast', invalid, breakfast);
    raise exception 'Invalid replacement unexpectedly succeeded';
  exception when not_null_violation then null;
  end;
  if (select count(*) from public.meal_items where meal_id = breakfast) <> 2 then
    raise exception 'Failed replacement lost original items';
  end if;
  begin
    perform public.persist_diary_meal('2026-10-11', 'dinner', invalid);
    raise exception 'Invalid addition unexpectedly succeeded';
  exception when not_null_violation then null;
  end;
  if exists(select 1 from public.meals where date = '2026-10-11') then
    raise exception 'Failed addition left an empty parent';
  end if;
  lunch := public.persist_diary_meal('2026-10-10', 'lunch', item);
  begin
    perform public.persist_diary_meal('2026-10-10', 'breakfast', invalid, lunch);
    raise exception 'Invalid merge unexpectedly succeeded';
  exception when not_null_violation then null;
  end;
  if not exists(select 1 from public.meals where id = lunch) or
    (select count(*) from public.meal_items where meal_id = breakfast) <> 2 then
    raise exception 'Failed merge changed source or destination';
  end if;
  result := public.persist_diary_meal('2026-10-10', 'breakfast', item, lunch);
  if result <> breakfast or exists(select 1 from public.meals where id = lunch) or
    (select count(*) from public.meal_items where meal_id = breakfast) <> 3 then
    raise exception 'Merge did not preserve all items';
  end if;
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  begin
    perform public.persist_diary_meal('2026-10-10', 'breakfast', item, breakfast);
    raise exception 'Cross-account edit unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.persist_diary_meal('2026-10-10', 'breakfast', item);
    raise exception 'Unauthenticated save unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
