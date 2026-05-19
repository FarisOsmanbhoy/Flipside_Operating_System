-- ────────────────────────────────────────────────────────────────────
-- Storage buckets
-- ────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('avatars',      'avatars',      true),
  ('client-logos', 'client-logos', true),
  ('client-docs',  'client-docs',  false)
on conflict (id) do nothing;

-- avatars: read public; owner uploads to {user_id}/...
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- client-logos: read public; manager/admin write
create policy "client_logos_read" on storage.objects
  for select using (bucket_id = 'client-logos');
create policy "client_logos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-logos' and public.is_manager_or_admin());
create policy "client_logos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-logos' and public.is_manager_or_admin());
create policy "client_logos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-logos' and public.is_manager_or_admin());

-- client-docs: authenticated read; manager/admin write
create policy "client_docs_read" on storage.objects
  for select to authenticated using (bucket_id = 'client-docs');
create policy "client_docs_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-docs' and public.is_manager_or_admin());
create policy "client_docs_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-docs' and public.is_manager_or_admin());
create policy "client_docs_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-docs' and public.is_manager_or_admin());
