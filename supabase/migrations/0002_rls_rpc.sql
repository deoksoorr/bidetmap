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
