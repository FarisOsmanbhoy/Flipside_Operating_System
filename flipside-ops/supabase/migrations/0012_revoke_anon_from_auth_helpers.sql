-- Tighten the grants from 0011: anon should never call these helpers. They are
-- meant for RLS policies invoked by `authenticated`. Leaving authenticated
-- with EXECUTE preserves the fix for "permission denied for function is_admin".
revoke execute on function public.auth_level() from anon, public;
revoke execute on function public.auth_role() from anon, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_manager_or_admin() from anon, public;
