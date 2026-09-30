-- EatLog: the name a user wants the app to call them, edited in Settings → Profile.
-- Optional and free text; the existing "users can read/update own row" policy covers it.

alter table public.users
  add column display_name text check (char_length(display_name) <= 50);
