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
