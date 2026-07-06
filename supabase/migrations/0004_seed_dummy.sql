-- 개발용 더미 데이터 (Phase 1). 운영 배포 전 삭제 가능.
with b as (
  insert into buildings (name, location, address, place_type, accessibility, is_24h, status) values
  ('서울시청 공중화장실', ST_MakePoint(126.9780, 37.5665)::geography, '서울 중구 세종대로 110', 'government', 'anyone', true, 'active'),
  ('강남역 지하상가', ST_MakePoint(127.0276, 37.4979)::geography, '서울 강남구 강남대로 396', 'subway', 'anyone', true, 'active'),
  ('스타벅스 광화문점', ST_MakePoint(126.9769, 37.5721)::geography, '서울 종로구 세종대로 175', 'cafe', 'customer_only', false, 'active'),
  ('롯데백화점 본점', ST_MakePoint(126.9816, 37.5651)::geography, '서울 중구 남대문로 81', 'mall', 'anyone', false, 'active')
  returning id, name
)
insert into restrooms (building_id, floor, restroom_type, bidet_location, bidet_status, amenities, last_verified_at, status)
select id, '1F', 'unisex', '입구 기준 1번째 칸', 'normal', array['tissue','good_sink'], now() - interval '3 days', 'active' from b where name='서울시청 공중화장실'
union all
select id, 'B1', 'male', '가장 안쪽 칸', 'weak_pressure', array['tissue'], now() - interval '20 days', 'active' from b where name='강남역 지하상가'
union all
select id, 'B1', 'female', '장애인칸', 'normal', array['diaper_table','disabled_access'], now() - interval '20 days', 'active' from b where name='강남역 지하상가'
union all
select id, '2F', 'unisex', '엘리베이터 뒤', 'normal', array['tissue','good_sink'], now() - interval '1 day', 'active' from b where name='스타벅스 광화문점'
union all
select id, '5F', 'female', '푸드코트 옆', 'need_check', array['diaper_table'], now() - interval '200 days', 'active' from b where name='롯데백화점 본점';
