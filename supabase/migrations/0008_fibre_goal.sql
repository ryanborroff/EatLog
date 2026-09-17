-- EatLog: add an optional daily fibre target alongside carbs/fat.

alter table public.user_goals add column daily_fibre int;
