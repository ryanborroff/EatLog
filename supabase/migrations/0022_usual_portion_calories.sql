-- EatLog: remember a usual portion's calories as well as its amount. The
-- parser may describe the same food in different units from one day to the
-- next ("1 portion" of pasta, then "200 g"); when the saved unit can't be
-- converted to this time's, the usual portion is applied by its calories.

alter table public.usual_portions add column calories numeric check (calories > 0);
