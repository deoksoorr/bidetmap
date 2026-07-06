import { supabase } from "./supabase";
import type { LatLng } from "./toss";
import type { BuildingDetail, NearbyBuilding, NearbyFilters } from "./types";

export async function fetchNearby(
  loc: LatLng,
  radiusM = 1500,
  f: NearbyFilters = {},
): Promise<NearbyBuilding[]> {
  const { data, error } = await supabase.rpc("nearby_buildings", {
    lat: loc.lat,
    lng: loc.lng,
    radius_m: radiusM,
    f_types: f.types ?? null,
    f_access: f.access ?? null,
    f_restroom: f.restroom ?? null,
    f_only_working: f.onlyWorking ?? null,
    f_has_photo: f.hasPhoto ?? null,
    f_is_24h: f.is24h ?? null,
    f_recent_days: f.recentDays ?? null,
  });
  if (error) throw error;
  return (data ?? []) as NearbyBuilding[];
}

export async function fetchBuildingDetail(id: string): Promise<BuildingDetail | null> {
  const { data, error } = await supabase.rpc("building_detail", { p_id: id });
  if (error) throw error;
  return (data as BuildingDetail) ?? null;
}
