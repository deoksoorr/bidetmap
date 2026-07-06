-- Phase 6: restroom-photos 버킷 + Storage RLS 정책
insert into storage.buckets (id, name, public) values ('restroom-photos', 'restroom-photos', true)
  on conflict (id) do nothing;

-- 공개 읽기 / 인증 업로드 / 관리자 수정·삭제
create policy "photos read"   on storage.objects for select using (bucket_id = 'restroom-photos');
create policy "photos insert" on storage.objects for insert to authenticated with check (bucket_id = 'restroom-photos');
create policy "photos admin del" on storage.objects for delete to authenticated using (bucket_id = 'restroom-photos' and public.is_admin());
create policy "photos admin upd" on storage.objects for update to authenticated using (bucket_id = 'restroom-photos' and public.is_admin());
