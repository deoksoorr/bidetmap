-- 0014: 사진 버킷 공개로 복귀 (Edge Function 없이 사진 표시)
--   앱은 building_detail이 status='visible' 사진 경로만 반환 → 승인 사진만 노출.
--   업로드 권한(is_active_reporter) / status 클라이언트 지정 금지 / 관리자 삭제·수정은 유지.
update storage.buckets set public = true where id = 'restroom-photos';

drop policy if exists "photos admin read" on storage.objects;
create policy "photos read" on storage.objects for select using (bucket_id = 'restroom-photos');
