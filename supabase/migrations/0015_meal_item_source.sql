-- EatLog: record where each logged item's nutrition came from, so wrong
-- estimates can be traced to their source (and data from a buggy source —
-- e.g. barcode sodium stored in grams — can be found and fixed later).
--
-- source: personal_food | saved_default | reference | ai_estimate | barcode |
-- food_search. Null for items logged before this column existed.
-- food_id (already present, previously never written) now holds the foods row
-- the nutrition came from, when there was one.

alter table public.meal_items add column source text;

-- food_id is now written, so deleting a food must not fail on (or delete) the
-- diary entries that used it.
alter table public.meal_items drop constraint meal_items_food_id_fkey;
alter table public.meal_items
  add constraint meal_items_food_id_fkey
  foreign key (food_id) references public.foods(id) on delete set null;
