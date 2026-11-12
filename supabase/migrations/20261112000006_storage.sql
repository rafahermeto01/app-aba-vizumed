-- LovABA · 0006 · Storage: pastas PRIVADAS para logos, fotos e assinaturas.
-- Caminho dos arquivos:
--   clinic-logos/{clinic_id}/logo.png
--   profile-photos/{clinic_id}/{profile_id}/foto.jpg
--   learner-photos/{clinic_id}/{learner_id}/foto.jpg
--   signatures/{clinic_id}/{session_id}/aplicador.png
-- Acesso apenas por URL assinada (nenhuma pasta é pública).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('clinic-logos',   'clinic-logos',   false, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('profile-photos', 'profile-photos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('learner-photos', 'learner-photos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('signatures',     'signatures',     false, 1048576, array['image/png'])
on conflict (id) do update set public = false;

-- Logos ----------------------------------------------------------------------
create policy "logos: ler da própria clínica" on storage.objects for select to authenticated
  using (bucket_id = 'clinic-logos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text);
create policy "logos: coordenação envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'clinic-logos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
              and (select public.my_role()) = 'coordenador');
create policy "logos: coordenação altera" on storage.objects for update to authenticated
  using (bucket_id = 'clinic-logos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and (select public.my_role()) = 'coordenador');
create policy "logos: coordenação remove" on storage.objects for delete to authenticated
  using (bucket_id = 'clinic-logos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and (select public.my_role()) = 'coordenador');

-- Fotos de perfil ----------------------------------------------------------------
create policy "perfil: ler da própria clínica" on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text);
create policy "perfil: a própria pessoa ou coordenação envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
              and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.my_role()) = 'coordenador'));
create policy "perfil: a própria pessoa ou coordenação altera" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.my_role()) = 'coordenador'));
create policy "perfil: a própria pessoa ou coordenação remove" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and ((storage.foldername(name))[2] = (select auth.uid())::text or (select public.my_role()) = 'coordenador'));

-- Fotos de aprendizes ------------------------------------------------------------
create policy "aprendiz: ler se pode ver o aprendiz" on storage.objects for select to authenticated
  using (bucket_id = 'learner-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and public.can_see(public.try_uuid((storage.foldername(name))[2])));
create policy "aprendiz: coordenação envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'learner-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
              and (select public.my_role()) = 'coordenador'
              and public.can_see(public.try_uuid((storage.foldername(name))[2])));
create policy "aprendiz: coordenação altera" on storage.objects for update to authenticated
  using (bucket_id = 'learner-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and (select public.my_role()) = 'coordenador');
create policy "aprendiz: coordenação remove" on storage.objects for delete to authenticated
  using (bucket_id = 'learner-photos' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and (select public.my_role()) = 'coordenador');

-- Assinaturas: lê quem pode ver a sessão; envia quem pode escrever nela -------------
-- Sem alteração nem remoção: assinatura é definitiva.
create policy "assinatura: ler se pode ver a sessão" on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
         and public.can_see_session(public.try_uuid((storage.foldername(name))[2])));
create policy "assinatura: enviar se pode escrever na sessão" on storage.objects for insert to authenticated
  with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = (select public.my_clinic_id())::text
              and public.can_write_session(public.try_uuid((storage.foldername(name))[2])));
