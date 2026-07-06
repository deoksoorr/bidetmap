import { supabase } from "./supabase";
import { shareLink, openExternal } from "./toss";

export type SavedBuilding = { id: string; name: string; address: string | null; place_type: string };

async function uid(): Promise<string | undefined> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

// U9 즐겨찾기
export async function getFavorite(buildingId: string): Promise<boolean> {
  const { data } = await supabase.from("favorites").select("building_id").eq("building_id", buildingId).maybeSingle();
  return !!data;
}

export async function toggleFavorite(buildingId: string): Promise<boolean> {
  const id = await uid();
  if (!id) throw new Error("로그인 후 이용할 수 있어요.");
  if (await getFavorite(buildingId)) {
    await supabase.from("favorites").delete().eq("user_id", id).eq("building_id", buildingId);
    return false;
  }
  await supabase.from("favorites").insert({ user_id: id, building_id: buildingId });
  return true;
}

export async function listFavorites(): Promise<SavedBuilding[]> {
  // 관리자가 숨김/삭제한 장소는 제외 (active 건물만)
  const { data } = await supabase
    .from("favorites")
    .select("buildings!inner(id,name,address,place_type,status)")
    .eq("buildings.status", "active")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => r.buildings).filter(Boolean);
}

// U10 최근 본 장소
export async function recordView(buildingId: string): Promise<void> {
  const id = await uid();
  if (!id) return;
  await supabase.from("recent_views").upsert(
    { user_id: id, building_id: buildingId, viewed_at: new Date().toISOString() },
    { onConflict: "user_id,building_id" },
  );
}

export async function listRecentViews(): Promise<SavedBuilding[]> {
  // 관리자가 숨김/삭제한 장소는 제외 (active 건물만)
  const { data } = await supabase
    .from("recent_views")
    .select("buildings!inner(id,name,address,place_type,status)")
    .eq("buildings.status", "active")
    .order("viewed_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((r: any) => r.buildings).filter(Boolean);
}

// U11 공유
export async function shareBuilding(b: { name: string; lat: number; lng: number }): Promise<void> {
  const url = `https://map.kakao.com/link/map/${encodeURIComponent(b.name)},${b.lat},${b.lng}`;
  await shareLink(`비데맵 · ${b.name} 비데 화장실 정보`, url);
}

// U12 길찾기 딥링크 (카카오맵)
export function openDirections(b: { name: string; lat: number; lng: number }): void {
  openExternal(`https://map.kakao.com/link/to/${encodeURIComponent(b.name)},${b.lat},${b.lng}`);
}
