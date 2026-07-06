-- 비데맵 운영 스키마 일괄 적용 (0001~0014, 더미 0004 제외).
-- 개발용 더미가 필요하면 0004_seed_dummy.sql 별도 실행.

-- ===== 0001_init.sql =====
-- 비데맵 v1.0 초기 스키마 (Phase 0)
-- Postgres + PostGIS. Supabase 기준.

create extension if not exists postgis;
create extension if not exists pgcrypto;
-- pg_cron은 Phase 7(오래된 장소 자동 강등)에서 활성화

-- ---------- 공통 유틸 ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles / 신뢰도 ----------
create table profiles (
  id            uuid primary key,
  toss_user_key text unique,
  nickname      text,
  role          text not null default 'user',   -- user|admin
  is_restricted boolean not null default false,
  created_at    timestamptz not null default now()
);

create table user_reliability_scores (
  user_id            uuid primary key references profiles(id) on delete cascade,
  score              int not null default 100,
  reports_confirmed  int not null default 0,
  reports_rejected   int not null default 0,
  false_report_count int not null default 0,
  helpful_received   int not null default 0,
  updated_at         timestamptz not null default now()
);

create function is_admin() returns boolean language sql stable as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create function is_active_reporter() returns boolean language sql stable as $$
  select exists(select 1 from profiles where id = auth.uid() and is_restricted = false);
$$;

-- ---------- buildings (지도 마커 단위) ----------
create table buildings (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  location      geography(Point,4326) not null,
  address       text,
  place_type    text not null,                       -- category_settings(place_type)
  accessibility text not null default 'need_check',  -- anyone|customer_only|resident_only|need_check
  is_24h        boolean not null default false,
  status        text not null default 'active',      -- active|pending_review|hidden|deleted
  hidden_reason  text,
  deleted_reason text,
  review_required_at timestamptz,
  report_count  int not null default 0,
  helpful_count int not null default 0,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index buildings_geo_idx  on buildings using gist(location);
create index buildings_type_idx on buildings(place_type);
create index buildings_status_idx on buildings(status);
create trigger buildings_updated before update on buildings for each row execute function set_updated_at();

-- ---------- restrooms (건물 내 개별 화장실) ----------
create table restrooms (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references buildings(id) on delete cascade,
  floor          text,
  area_desc      text,
  restroom_type  text not null,                       -- male|female|unisex|family|disabled
  accessibility  text,                                -- null이면 building 상속
  bidet_location text,
  bidet_status   text not null default 'need_check',  -- normal|weak_pressure|broken|removed|need_check
  amenities      text[] not null default '{}',
  memo           text,
  status         text not null default 'active',
  hidden_reason  text,
  deleted_reason text,
  review_required_at timestamptz,
  last_verified_at   timestamptz,
  report_count   int not null default 0,
  helpful_count  int not null default 0,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index restrooms_building_idx on restrooms(building_id);
create index restrooms_status_idx on restrooms(status);
create trigger restrooms_updated before update on restrooms for each row execute function set_updated_at();

-- ---------- 사진 / 사진 검수 ----------
create table restroom_photos (
  id           uuid primary key default gen_random_uuid(),
  restroom_id  uuid not null references restrooms(id) on delete cascade,
  storage_path text not null,
  uploaded_by  uuid references profiles(id),
  status       text not null default 'pending',   -- pending|visible|hidden|rejected
  created_at   timestamptz not null default now()
);
create index restroom_photos_restroom_idx on restroom_photos(restroom_id);

create table photo_moderation_logs (
  id           uuid primary key default gen_random_uuid(),
  photo_id     uuid not null references restroom_photos(id) on delete cascade,
  action       text not null,          -- auto_flag|auto_pass|approve|reject|delete
  reason       text,
  model_result jsonb,
  moderated_by uuid references profiles(id),
  created_at   timestamptz not null default now()
);

-- ---------- 제보/신고 ----------
create table place_reports (
  id          uuid primary key default gen_random_uuid(),
  restroom_id uuid not null references restrooms(id) on delete cascade,
  reporter_id uuid references profiles(id),
  report_type text not null,           -- helpful|recent_check|wrong_info|broken|removed
  payload     jsonb,
  status      text not null default 'open',  -- open|approved|rejected
  resolved_by uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index place_reports_restroom_idx on place_reports(restroom_id);
create index place_reports_status_idx on place_reports(status);

-- ---------- 즐겨찾기 / 최근본 ----------
create table favorites (
  user_id     uuid references profiles(id) on delete cascade,
  building_id uuid references buildings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, building_id)
);
create table recent_views (
  user_id     uuid references profiles(id) on delete cascade,
  building_id uuid references buildings(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (user_id, building_id)
);

-- ---------- 관리자 로그 / 설정 ----------
create table admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references profiles(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create table monetization_settings (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  enabled    boolean not null default false,
  config     jsonb not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table category_settings (
  id      uuid primary key default gen_random_uuid(),
  "group" text not null,
  code    text not null,
  label   text not null,
  sort    int not null default 0,
  enabled boolean not null default true,
  unique ("group", code)
);

-- ---------- 신뢰도/카운트 트리거 (부정신고 누적 → 자동 숨김) ----------
create or replace function on_report_insert() returns trigger language plpgsql as $$
declare v_building uuid; v_neg int;
begin
  if new.report_type in ('broken','removed','wrong_info') then
    update restrooms set report_count = report_count + 1 where id = new.restroom_id
      returning building_id, report_count into v_building, v_neg;
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
create trigger place_reports_after_insert after insert on place_reports
  for each row execute function on_report_insert();

comment on table buildings is '지도 마커 단위. 기존 places 개념을 통합';

-- ===== 0002_rls_rpc.sql =====
-- 비데맵 v1.0 RLS + RPC (Phase 0)

-- ---------- RLS 활성화 ----------
alter table profiles enable row level security;
alter table user_reliability_scores enable row level security;
alter table buildings enable row level security;
alter table restrooms enable row level security;
alter table restroom_photos enable row level security;
alter table photo_moderation_logs enable row level security;
alter table place_reports enable row level security;
alter table favorites enable row level security;
alter table recent_views enable row level security;
alter table admin_logs enable row level security;
alter table monetization_settings enable row level security;
alter table category_settings enable row level security;

-- profiles: 본인/관리자
create policy profiles_sel on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_upd on profiles for update using (id = auth.uid() or is_admin());

-- 신뢰도: 본인 조회 / 관리자 전체
create policy urs_sel on user_reliability_scores for select using (user_id = auth.uid() or is_admin());
create policy urs_admin on user_reliability_scores for all using (is_admin()) with check (is_admin());

-- buildings / restrooms: active 공개, 그 외 관리자. 작성/수정 규칙.
create policy buildings_sel on buildings for select using (status = 'active' or is_admin() or created_by = auth.uid());
create policy buildings_ins on buildings for insert with check (auth.uid() is not null and is_active_reporter());
create policy buildings_upd on buildings for update using (created_by = auth.uid() or is_admin());
create policy buildings_del on buildings for delete using (is_admin());

create policy restrooms_sel on restrooms for select using (status = 'active' or is_admin() or created_by = auth.uid());
create policy restrooms_ins on restrooms for insert with check (auth.uid() is not null and is_active_reporter());
create policy restrooms_upd on restrooms for update using (created_by = auth.uid() or is_admin());
create policy restrooms_del on restrooms for delete using (is_admin());

-- 사진: visible 공개 / 업로드 인증 / 관리자 관리
create policy photos_sel on restroom_photos for select using (status = 'visible' or is_admin() or uploaded_by = auth.uid());
create policy photos_ins on restroom_photos for insert with check (auth.uid() is not null and is_active_reporter());
create policy photos_upd on restroom_photos for update using (is_admin());
create policy photos_del on restroom_photos for delete using (is_admin());

create policy modlogs_admin on photo_moderation_logs for all using (is_admin()) with check (is_admin());

-- 신고: 본인 조회+생성 / 관리자 전체
create policy reports_sel on place_reports for select using (reporter_id = auth.uid() or is_admin());
create policy reports_ins on place_reports for insert with check (reporter_id = auth.uid() and is_active_reporter());
create policy reports_admin on place_reports for update using (is_admin());

-- 즐겨찾기/최근본: 본인만
create policy fav_all on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rv_all on recent_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 관리자 로그/설정
create policy adminlogs_admin on admin_logs for all using (is_admin()) with check (is_admin());
create policy mon_sel on monetization_settings for select using (enabled or is_admin());
create policy mon_admin on monetization_settings for all using (is_admin()) with check (is_admin());
create policy cat_sel on category_settings for select using (enabled or is_admin());
create policy cat_admin on category_settings for all using (is_admin()) with check (is_admin());

-- ---------- RPC: 반경 검색 ----------
create or replace function nearby_buildings(
  lat double precision, lng double precision, radius_m int default 1500,
  f_types text[] default null, f_access text[] default null, f_restroom text[] default null,
  f_only_working boolean default null, f_has_photo boolean default null,
  f_is_24h boolean default null, f_recent_days int default null
) returns table (
  id uuid, name text, address text, place_type text, accessibility text,
  is_24h boolean, lat double precision, lng double precision, distance_m double precision,
  best_bidet_status text, has_photo boolean, last_verified_at timestamptz
) language sql stable as $$
  with pt as (select ST_MakePoint(lng, lat)::geography g)
  select b.id, b.name, b.address, b.place_type, b.accessibility, b.is_24h,
         ST_Y(b.location::geometry), ST_X(b.location::geometry),
         ST_Distance(b.location, (select g from pt)),
         min(r.bidet_status),
         bool_or(exists(select 1 from restroom_photos p where p.restroom_id=r.id and p.status='visible')),
         max(r.last_verified_at)
  from buildings b
  join restrooms r on r.building_id = b.id and r.status='active'
  where b.status='active'
    and ST_DWithin(b.location, (select g from pt), radius_m)
    and (f_types is null or b.place_type = any(f_types))
    and (f_access is null or b.accessibility = any(f_access))
    and (f_restroom is null or r.restroom_type = any(f_restroom))
    and (f_is_24h is null or b.is_24h = f_is_24h)
    and (f_only_working is not true or r.bidet_status in ('normal','weak_pressure'))
    and (f_recent_days is null or r.last_verified_at >= now() - make_interval(days => f_recent_days))
  group by b.id
  having (f_has_photo is not true or bool_or(exists(
            select 1 from restroom_photos p where p.restroom_id=r.id and p.status='visible')))
  order by ST_Distance(b.location, (select g from pt));
$$;

-- ===== 0003_seed.sql =====
-- 비데맵 v1.0 카테고리/상태값 시드 (Phase 0, 한국어)
insert into category_settings ("group", code, label, sort) values
 ('place_type','public_toilet','공중화장실',1),
 ('place_type','subway','지하철/역사',2),
 ('place_type','mall','백화점/몰',3),
 ('place_type','cafe','카페',4),
 ('place_type','restaurant','음식점',5),
 ('place_type','hotel','호텔',6),
 ('place_type','motel','모텔',7),
 ('place_type','hospital','병원',8),
 ('place_type','government','관공서',9),
 ('place_type','building','일반건물',10),
 ('place_type','etc','기타',11),
 ('accessibility','anyone','누구나 이용 가능',1),
 ('accessibility','customer_only','고객만 가능',2),
 ('accessibility','resident_only','숙박객/입주자 전용',3),
 ('accessibility','need_check','확인 필요',4),
 ('restroom_type','male','남자',1),
 ('restroom_type','female','여자',2),
 ('restroom_type','unisex','공용',3),
 ('restroom_type','family','가족',4),
 ('restroom_type','disabled','장애인',5),
 ('bidet_status','normal','정상',1),
 ('bidet_status','weak_pressure','수압 약함',2),
 ('bidet_status','broken','고장',3),
 ('bidet_status','removed','철거됨',4),
 ('bidet_status','need_check','확인 필요',5),
 ('amenities','tissue','휴지 있음',1),
 ('amenities','good_sink','세면대 좋음',2),
 ('amenities','diaper_table','기저귀 교환대',3),
 ('amenities','disabled_access','장애인 이용 가능',4),
 ('amenities','emergency_bell','비상벨',5)
on conflict ("group", code) do nothing;

insert into monetization_settings (key, enabled, config) values
 ('banner_main', false, '{"placement":"map_bottom"}'),
 ('rewarded_register', false, '{"reward":"badge"}')
on conflict (key) do nothing;

-- ===== 0005_create_place.sql =====
-- 건물 + 화장실 원자적 등록 RPC (Phase 2). security invoker → RLS 정책 그대로 적용.
create or replace function create_place(
  p_name text, p_lat double precision, p_lng double precision, p_address text,
  p_place_type text, p_accessibility text, p_is_24h boolean, p_restrooms jsonb
) returns uuid language plpgsql security invoker as $$
declare v_building uuid; r jsonb;
begin
  insert into buildings (name, location, address, place_type, accessibility, is_24h, created_by, review_required_at)
  values (p_name, ST_MakePoint(p_lng, p_lat)::geography, p_address, p_place_type,
          coalesce(p_accessibility, 'need_check'), coalesce(p_is_24h, false), auth.uid(), now())
  returning id into v_building;

  for r in select * from jsonb_array_elements(p_restrooms) loop
    insert into restrooms (building_id, floor, area_desc, restroom_type, accessibility,
                           bidet_location, bidet_status, amenities, memo,
                           created_by, review_required_at, last_verified_at)
    values (
      v_building, r->>'floor', r->>'area_desc', r->>'restroom_type', nullif(r->>'accessibility', ''),
      r->>'bidet_location', coalesce(nullif(r->>'bidet_status',''), 'need_check'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(r->'amenities') x), '{}'),
      r->>'memo', auth.uid(), now(), now()
    );
  end loop;
  return v_building;
end $$;

-- ===== 0006_detail_and_best_status.sql =====
-- Phase 3: building_detail RPC + nearby_buildings 대표상태 로직 개선

-- 대표 비데상태: 이용 가능한 상태를 우선(normal>weak>need_check>broken>removed)
create or replace function nearby_buildings(
  lat double precision, lng double precision, radius_m int default 1500,
  f_types text[] default null, f_access text[] default null, f_restroom text[] default null,
  f_only_working boolean default null, f_has_photo boolean default null,
  f_is_24h boolean default null, f_recent_days int default null
) returns table (
  id uuid, name text, address text, place_type text, accessibility text,
  is_24h boolean, lat double precision, lng double precision, distance_m double precision,
  best_bidet_status text, has_photo boolean, last_verified_at timestamptz
) language sql stable as $$
  with pt as (select ST_MakePoint(lng, lat)::geography g)
  select b.id, b.name, b.address, b.place_type, b.accessibility, b.is_24h,
         ST_Y(b.location::geometry), ST_X(b.location::geometry),
         ST_Distance(b.location, (select g from pt)),
         (array_agg(r.bidet_status order by case r.bidet_status
            when 'normal' then 1 when 'weak_pressure' then 2 when 'need_check' then 3
            when 'broken' then 4 when 'removed' then 5 else 6 end))[1],
         bool_or(exists(select 1 from restroom_photos p where p.restroom_id=r.id and p.status='visible')),
         max(r.last_verified_at)
  from buildings b
  join restrooms r on r.building_id = b.id and r.status='active'
  where b.status='active'
    and ST_DWithin(b.location, (select g from pt), radius_m)
    and (f_types is null or b.place_type = any(f_types))
    and (f_access is null or b.accessibility = any(f_access))
    and (f_restroom is null or r.restroom_type = any(f_restroom))
    and (f_is_24h is null or b.is_24h = f_is_24h)
    and (f_only_working is not true or r.bidet_status in ('normal','weak_pressure'))
    and (f_recent_days is null or r.last_verified_at >= now() - make_interval(days => f_recent_days))
  group by b.id
  having (f_has_photo is not true or bool_or(exists(
            select 1 from restroom_photos p where p.restroom_id=r.id and p.status='visible')))
  order by ST_Distance(b.location, (select g from pt));
$$;

-- 상세: 건물 + 활성 화장실 + visible 사진 (RLS 적용, security invoker)
create or replace function building_detail(p_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'address', b.address, 'place_type', b.place_type,
    'accessibility', b.accessibility, 'is_24h', b.is_24h, 'helpful_count', b.helpful_count,
    'lat', ST_Y(b.location::geometry), 'lng', ST_X(b.location::geometry),
    'restrooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'floor', r.floor, 'area_desc', r.area_desc, 'restroom_type', r.restroom_type,
        'accessibility', coalesce(r.accessibility, b.accessibility),
        'bidet_location', r.bidet_location, 'bidet_status', r.bidet_status,
        'amenities', r.amenities, 'memo', r.memo,
        'last_verified_at', r.last_verified_at, 'helpful_count', r.helpful_count,
        'report_count', r.report_count,
        'photos', coalesce((select jsonb_agg(p.storage_path)
                            from restroom_photos p where p.restroom_id=r.id and p.status='visible'), '[]'::jsonb)
      ) order by r.created_at)
      from restrooms r where r.building_id=b.id and r.status='active'
    ), '[]'::jsonb)
  )
  from buildings b
  where b.id=p_id and (b.status='active' or is_admin() or b.created_by=auth.uid());
$$;

-- ===== 0007_reports_rpc.sql =====
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

-- ===== 0008_storage_policies.sql =====
-- Phase 6: restroom-photos 버킷 + Storage RLS 정책
insert into storage.buckets (id, name, public) values ('restroom-photos', 'restroom-photos', true)
  on conflict (id) do nothing;

-- 공개 읽기 / 인증 업로드 / 관리자 수정·삭제
create policy "photos read"   on storage.objects for select using (bucket_id = 'restroom-photos');
create policy "photos insert" on storage.objects for insert to authenticated with check (bucket_id = 'restroom-photos');
create policy "photos admin del" on storage.objects for delete to authenticated using (bucket_id = 'restroom-photos' and public.is_admin());
create policy "photos admin upd" on storage.objects for update to authenticated using (bucket_id = 'restroom-photos' and public.is_admin());

-- ===== 0009_stale_cron.sql =====
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

-- ===== 0010_harden_stale.sql =====
-- Phase 7 보안 하드닝: 배치 전용 함수를 클라이언트에서 실행 금지
-- cron은 postgres(owner)로 실행되어 영향 없음. anon/authenticated만 차단.
revoke execute on function stale_downgrade(int) from public, anon, authenticated;

-- (선택) 보안 점검 중 강등된 더미 데이터 복구: 롯데(원래 need_check) 제외하고 normal 복원
update restrooms r set bidet_status = 'normal', review_required_at = null
from buildings b
where r.building_id = b.id
  and r.bidet_status = 'need_check'
  and b.name in ('서울시청 공중화장실', '강남역 지하상가', '스타벅스 광화문점');

-- ===== 0011_audit_fixes.sql =====
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

-- ===== 0012_photo_pipeline.sql =====
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

-- ===== 0013_integrity_fixes.sql =====
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

-- ===== 0014_photos_public.sql =====
-- 0014: 사진 버킷 공개로 복귀 (Edge Function 없이 사진 표시)
--   앱은 building_detail이 status='visible' 사진 경로만 반환 → 승인 사진만 노출.
--   업로드 권한(is_active_reporter) / status 클라이언트 지정 금지 / 관리자 삭제·수정은 유지.
update storage.buckets set public = true where id = 'restroom-photos';

drop policy if exists "photos admin read" on storage.objects;
create policy "photos read" on storage.objects for select using (bucket_id = 'restroom-photos');

