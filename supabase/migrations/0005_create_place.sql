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
