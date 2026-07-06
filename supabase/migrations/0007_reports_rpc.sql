-- Phase 4: 제보 제출 + 관리자 검수(승인/반려) + 신뢰도 반영

-- 제보 제출 (security invoker → RLS: reporter_id=auth.uid() & is_active_reporter)
create or replace function submit_report(p_restroom_id uuid, p_type text, p_payload jsonb default null)
returns uuid language sql security invoker as $$
  insert into place_reports (restroom_id, reporter_id, report_type, payload)
  values (p_restroom_id, auth.uid(), p_type, p_payload)
  returning id;
$$;

-- 관리자: 신고 승인/반려 + 상태/신뢰도/로그 처리 (security definer, 내부 admin 가드)
create or replace function resolve_report(p_report_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare rep place_reports; neg boolean;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into rep from place_reports where id = p_report_id;
  if rep.id is null then raise exception 'report not found'; end if;
  if rep.status <> 'open' then return; end if;

  neg := rep.report_type in ('broken','removed','wrong_info');
  update place_reports set status = case when p_approve then 'approved' else 'rejected' end,
                          resolved_by = auth.uid() where id = rep.id;
  if neg then
    update restrooms set report_count = greatest(report_count - 1, 0) where id = rep.restroom_id;
  end if;

  if p_approve then
    if rep.report_type = 'broken' then
      update restrooms set bidet_status='broken', status='active', review_required_at=null where id=rep.restroom_id;
    elsif rep.report_type = 'removed' then
      update restrooms set status='hidden', hidden_reason='철거/없음 확인', review_required_at=null where id=rep.restroom_id;
    end if;
    update user_reliability_scores set reports_confirmed=reports_confirmed+1, score=score+2, updated_at=now()
      where user_id = rep.reporter_id;
  else
    update user_reliability_scores set reports_rejected=reports_rejected+1, false_report_count=false_report_count+1,
      score=greatest(score-5,0), updated_at=now() where user_id = rep.reporter_id;
    -- 반려로 신고가 임계 미만이면 자동 숨김 해제
    update restrooms set status='active', review_required_at=null
      where id=rep.restroom_id and status='pending_review' and report_count < 3;
    -- 허위 누적(>=5) 시 자동 제한 후보
    update profiles set is_restricted=true where id=rep.reporter_id
      and coalesce((select false_report_count from user_reliability_scores where user_id=rep.reporter_id),0) >= 5;
  end if;

  insert into admin_logs (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), 'resolve_report', 'place_report', rep.id,
          jsonb_build_object('approve', p_approve, 'type', rep.report_type));
end $$;

-- 관리자: 허위 제보자 제한 토글 (A11)
create or replace function set_user_restricted(p_user uuid, p_restricted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update profiles set is_restricted = p_restricted where id = p_user;
  insert into admin_logs (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), 'set_restricted', 'profile', p_user, jsonb_build_object('restricted', p_restricted));
end $$;
