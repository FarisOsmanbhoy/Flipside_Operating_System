-- ────────────────────────────────────────────────────────────────────
-- Profile fields expansion: extension, DOB, job title, car reg, specialisation.
-- All nullable; admins (L3) populate them on the staff record.
-- ────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists extension        text,
  add column if not exists date_of_birth    date,
  add column if not exists job_title        text,
  add column if not exists car_registration text,
  add column if not exists specialisation   text;
