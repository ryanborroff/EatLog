-- EatLog: flag items whose amount was guessed. When the user names a food but
-- no amount ("pasta for dinner"), the parser assumes a typical portion; the
-- app asks about it for big items, and anything left as a guess is marked
-- "portion guessed" in the diary until the user sets an amount.

alter table public.meal_items add column portion_assumed boolean not null default false;
