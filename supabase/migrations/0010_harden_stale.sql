-- Phase 7 보안 하드닝: 배치 전용 함수를 클라이언트에서 실행 금지
-- cron은 postgres(owner)로 실행되어 영향 없음. anon/authenticated만 차단.
revoke execute on function stale_downgrade(int) from public, anon, authenticated;

-- (선택) 보안 점검 중 강등된 더미 데이터 복구: 롯데(원래 need_check) 제외하고 normal 복원
update restrooms r set bidet_status = 'normal', review_required_at = null
from buildings b
where r.building_id = b.id
  and r.bidet_status = 'need_check'
  and b.name in ('서울시청 공중화장실', '강남역 지하상가', '스타벅스 광화문점');
