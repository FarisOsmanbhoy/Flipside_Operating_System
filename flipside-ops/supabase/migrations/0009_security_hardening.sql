-- Lock down internal helper functions: they're called by RLS policies and
-- triggers, never via REST RPC. Without this revoke, the advisors flag them
-- as anonymously executable.
revoke execute on function public.auth_role() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, authenticated, public;
revoke execute on function public.is_manager_or_admin() from anon, authenticated, public;
revoke execute on function public.set_audit_columns() from anon, authenticated, public;
revoke execute on function public.log_audit() from anon, authenticated, public;
revoke execute on function public.handle_new_auth_user() from anon, authenticated, public;

-- Public buckets serve files via the storage CDN without needing a SELECT
-- policy on storage.objects. The broad policy from 0008 allowed clients to
-- *list* every object in the bucket, which we never want.
drop policy if exists "avatars_read" on storage.objects;
drop policy if exists "client_logos_read" on storage.objects;
