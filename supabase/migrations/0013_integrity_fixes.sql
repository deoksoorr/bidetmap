-- 0013: 데이터 무결성/정책 보완 (M5·M6·M10·L8)

-- [M5] 내부 상태 enum에 CHECK (카테고리(category_settings)로 확장하는 컬럼은 제외해 A14 유연성 유지)
alter table profiles         add constraint profiles_role_chk   check (role in ('user','admin'));
alter table buildings        add constraint buildings_status_chk check (status in ('active','pending_review','hidden','deleted'));
alter table restrooms        add constraint restrooms_status_chk check (status in ('active','pending_review','hidden','deleted'));
alter table restroom_photos  add constraint photos_status_chk    check (status in ('pending','visible','hidden','rejected'));
alter table place_reports    add constraint reports_type_chk     check (report_type in ('helpful','recent_check','wrong_info','broken','removed'));
alter table place_reports    add constraint reports_status_chk   check (status in ('open','approved','rejected'));

-- [M6] 소프트삭제 정책 강제: buildings/restrooms 하드 DELETE 불가(관리자도 status='deleted'로만).
--   → cascade로 신고/사진/로그가 파괴되는 것을 방지. (사진 개별 삭제는 photos_del 유지)
drop policy buildings_del on buildings;
drop policy restrooms_del on restrooms;

-- [M10] 감사 로그 actor를 auth.uid()로 고정 → 내부자가 타인 관리자 id로 위조 불가.
drop policy adminlogs_admin on admin_logs;
create policy adminlogs_admin on admin_logs for all
  using (is_admin()) with check (is_admin() and admin_id = auth.uid());
drop policy modlogs_admin on photo_moderation_logs;
create policy modlogs_admin on photo_moderation_logs for all
  using (is_admin()) with check (is_admin() and (moderated_by = auth.uid() or moderated_by is null));

-- [L8] 사진 검수 큐 / nearby has_photo 서브쿼리용 인덱스
create index if not exists restroom_photos_status_idx on restroom_photos(status);

-- [L9] recent_views 무한 증가 방지: 90일 초과 정리(즐겨찾기는 사용자 의도이므로 미정리)
select cron.schedule('bidet-prune-recent-views', '30 3 * * *',
  $$ delete from recent_views where viewed_at < now() - interval '90 days'; $$);
