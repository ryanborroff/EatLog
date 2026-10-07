-- EatLog: food descriptions used to be stored sentence-cased ("Sourdough
-- toast"), which read wrongly once the app put a quantity in front ("2 slices
-- of Sourdough toast"). Descriptions are now stored as they'd read
-- mid-sentence, with brand capitals kept, and the app capitalizes the line.
-- Lowercase the leading capital on older rows that have no other capitals —
-- the old prompt forbade any, so their first capital was never a brand's.

update public.meal_items
set description = lower(left(description, 1)) || substr(description, 2)
where description ~ '^[A-Z]' and substr(description, 2) !~ '[A-Z]';
