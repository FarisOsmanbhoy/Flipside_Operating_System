-- ────────────────────────────────────────────────────────────────────
-- Password metadata on profiles.
--   password_set_at        — when the password was last set
--   password_set_by        — who set it (null = user set their own)
--   must_change_password   — true after an admin sets a temp password
--
-- Plaintext passwords are never stored. auth.users.encrypted_password
-- holds the bcrypt hash; these columns only describe *when* and *by whom*.
-- ────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists password_set_at      timestamptz,
  add column if not exists password_set_by      uuid references public.profiles(id) on delete set null,
  add column if not exists must_change_password boolean not null default false;
