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
