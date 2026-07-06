-- 0012: 사진 파이프라인 하드닝 (H3/H4/H5)

-- [H3/H5] 버킷 비공개 전환 + 크기/타입 제한 (검수 전/거부 사진 직접 URL 접근 차단)
update storage.buckets
  set public = false,
      file_size_limit = 5242880,                                   -- 5MB
      allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'restroom-photos';

-- 공개 읽기 제거 → 서명 URL(photo-url 함수, service_role)로만 노출
drop policy "photos read" on storage.objects;
-- 관리자만 직접 select 가능(검수 미리보기 서명 URL 생성용)
create policy "photos admin read" on storage.objects for select to authenticated
  using (bucket_id = 'restroom-photos' and public.is_admin());
-- 업로드는 활성 사용자만(제한 사용자 차단)
drop policy "photos insert" on storage.objects;
create policy "photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'restroom-photos' and public.is_active_reporter());

-- [H4] status는 클라이언트가 지정 불가 → 항상 기본 'pending'으로만 삽입, 승격은 검수(서버)로만
revoke insert (status) on restroom_photos from authenticated, anon;
