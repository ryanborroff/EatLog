-- EatLog: fill in a user food's owner server-side, so app builds that don't
-- send created_by (anything before 0018) can still save to "My foods".
-- Service-role inserts (reference data) have no auth.uid(), so stay null.

alter table public.foods alter column created_by set default auth.uid();
