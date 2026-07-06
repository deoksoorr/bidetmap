-- Phase 7: 오래된 장소 자동 '확인 필요' 강등 (pg_cron)
create extension if not exists pg_cron;

-- last_verified_at이 N일 초과인 활성 화장실을 need_check로 강등하고 검수 대기로 표시
create or replace function stale_downgrade(p_days int default 180)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update restrooms
    set bidet_status = 'need_check', review_required_at = now()
  where status = 'active'
    and bidet_status <> 'need_check'
    and (last_verified_at is null or last_verified_at < now() - make_interval(days => p_days));
  get diagnostics n = row_count;
  return n;
end $$;

-- 매일 03:00(KST 기준 서버 UTC면 조정) 실행
select cron.schedule('bidet-stale-downgrade', '0 3 * * *', $$ select stale_downgrade(180); $$);
