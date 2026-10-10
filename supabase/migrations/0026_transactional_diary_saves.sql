-- Invoker security preserves existing RLS. One RPC = one transaction, including
-- replacement/merge deletes. Serialize cooperating writes for a user's day so
-- simultaneous additions do not both create a breakfast/lunch/dinner card.
create function public.persist_diary_meal(
  p_date date, p_meal_type text, p_items jsonb, p_meal_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_destination uuid;
  v_created_at timestamptz;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_date is null or p_meal_type is null or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then
    raise exception 'Invalid meal date or type' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A meal must contain items' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || p_date::text, 0));

  if p_meal_id is not null then
    select created_at into v_created_at from public.meals
      where id = p_meal_id and user_id = v_user and date = p_date for update;
    if not found then raise exception 'Meal not found' using errcode = '42501'; end if;
  end if;

  select id into v_destination from public.meals
    where user_id = v_user and date = p_date and meal_type = p_meal_type
      and (p_meal_id is null or id <> p_meal_id)
      and (p_meal_type <> 'snack' or
        (p_meal_id is null and created_at >= now() - interval '1 hour') or
        (p_meal_id is not null and created_at between v_created_at - interval '1 hour' and v_created_at + interval '1 hour'))
    order by case when p_meal_type = 'snack' then created_at end desc,
      created_at asc, id asc limit 1 for update;

  if v_destination is null then
    if p_meal_id is null then
      insert into public.meals(user_id, date, meal_type) values(v_user, p_date, p_meal_type)
        returning id into v_destination;
    else
      v_destination := p_meal_id;
      delete from public.meal_items where meal_id = p_meal_id;
    end if;
  end if;

  insert into public.meal_items(meal_id, description, quantity, unit, calories,
    protein, carbohydrate, fat, fibre, sodium, sugar, confidence, estimated,
    source, food_id, portion_assumed)
  select v_destination, i.description, i.quantity, i.unit, i.calories, i.protein,
    i.carbohydrate, i.fat, i.fibre, i.sodium, i.sugar, coalesce(i.confidence, 'medium'),
    coalesce(i.estimated, false), i.source, i.food_id, coalesce(i.portion_assumed, false)
  from jsonb_to_recordset(p_items) as i(description text, quantity numeric, unit text,
    calories numeric, protein numeric, carbohydrate numeric, fat numeric,
    fibre numeric, sodium numeric, sugar numeric, confidence text, estimated boolean,
    source text, food_id uuid, portion_assumed boolean);

  update public.meals set meal_type = p_meal_type, updated_at = now() where id = v_destination;
  if p_meal_id is not null and p_meal_id <> v_destination then
    delete from public.meals where id = p_meal_id;
  end if;
  return v_destination;
end;
$$;
revoke all on function public.persist_diary_meal(date, text, jsonb, uuid) from public, anon;
grant execute on function public.persist_diary_meal(date, text, jsonb, uuid) to authenticated;
