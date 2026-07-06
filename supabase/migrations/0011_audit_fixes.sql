-- 0011: 보안 감사 반영 (권한 잠금 + RLS 헬퍼/트리거 DEFINER + 신고 중복 차단)

-- [C2] profiles: 권한 컬럼 자가 변경 차단.
--   role/is_restricted/toss_user_key는 클라이언트(authenticated/anon)가 직접 UPDATE 불가.
--   관리자의 is_restricted 변경은 set_user_restricted(DEFINER)로만, role은 운영 SQL(postgres)로만.
revoke update (role, is_restricted, toss_user_key) on profiles from authenticated, anon;

-- [H6] RLS 헬퍼를 SECURITY DEFINER로 → profiles RLS 재귀/플랜의존 제거.
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function is_active_reporter() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and is_restricted = false);
$$;

-- [H1] buildings/restrooms UPDATE는 관리자만. (사용자앱엔 장소 수정 기능이 없음)
--   → 작성자가 status/review_required_at/report_count 등으로 검수·자동숨김 우회 불가.
drop policy buildings_upd on buildings;
create policy buildings_upd on buildings for update using (is_admin()) with check (is_admin());
drop policy restrooms_upd on restrooms;
create policy restrooms_upd on restrooms for update using (is_admin()) with check (is_admin());

-- [H2] 신고 카운트/자동숨김 트리거를 DEFINER로 → 신고자가 안 만든 화장실도 갱신 가능(RLS 우회).
create or replace function on_report_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_neg int;
begin
  if new.report_type in ('broken','removed','wrong_info') then
    update restrooms set report_count = report_count + 1 where id = new.restroom_id
      returning report_count into v_neg;
    if v_neg >= 3 then
      update restrooms set status='pending_review', review_required_at=now() where id=new.restroom_id;
    end if;
  elsif new.report_type = 'helpful' then
    update restrooms set helpful_count = helpful_count + 1 where id = new.restroom_id;
  elsif new.report_type = 'recent_check' then
    update restrooms set last_verified_at = now(),
      bidet_status = case when bidet_status='need_check' then 'normal' else bidet_status end
      where id = new.restroom_id;
  end if;
  return new;
end $$;

-- [M8] 신고 중복/어뷰징 차단: 부정신고는 사용자·화장실당 open 1건, 긍정신호는 1일 1회.
--   → 단일 사용자가 3건으로 임의 장소 자동숨김하는 그리핑 방지(임계 3 = 서로 다른 3명 필요).
create or replace function submit_report(p_restroom_id uuid, p_type text, p_payload jsonb default null)
returns uuid language plpgsql security invoker as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode='42501'; end if;
  if p_type in ('broken','removed','wrong_info') then
    if exists(select 1 from place_reports where restroom_id=p_restroom_id and reporter_id=auth.uid()
              and report_type in ('broken','removed','wrong_info') and status='open') then
      raise exception 'duplicate_open_report' using errcode='23505';
    end if;
  elsif p_type in ('helpful','recent_check') then
    if exists(select 1 from place_reports where restroom_id=p_restroom_id and reporter_id=auth.uid()
              and report_type=p_type and created_at > now() - interval '1 day') then
      raise exception 'duplicate_recent_signal' using errcode='23505';
    end if;
  end if;
  insert into place_reports (restroom_id, reporter_id, report_type, payload)
  values (p_restroom_id, auth.uid(), p_type, p_payload) returning id into v_id;
  return v_id;
end $$;
