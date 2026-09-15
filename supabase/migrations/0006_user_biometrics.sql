-- Add optional biometric fields used to suggest a calorie target (Mifflin-St Jeor).
-- All nullable: users are never required to fill these in.

alter table public.users
  add column sex text check (sex in ('male', 'female')),
  add column birth_year int,
  add column height_cm numeric,
  add column weight_kg numeric,
  add column activity_level text check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  );
