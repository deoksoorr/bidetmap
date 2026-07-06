import { supabase } from "./supabase";

export type RestroomInput = {
  restroom_type: string;
  floor?: string;
  area_desc?: string;
  accessibility?: string;
  bidet_location?: string;
  bidet_status?: string;
  amenities?: string[];
  memo?: string;
};

export const emptyRestroom = (): RestroomInput => ({ restroom_type: "unisex", bidet_status: "normal", amenities: [] });

export type PlaceInput = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  place_type: string;
  accessibility: string;
  is_24h?: boolean;
  restrooms: RestroomInput[];
};

// 건물 + 화장실 원자적 등록 → building id 반환
export async function createPlace(p: PlaceInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_place", {
    p_name: p.name,
    p_lat: p.lat,
    p_lng: p.lng,
    p_address: p.address ?? null,
    p_place_type: p.place_type,
    p_accessibility: p.accessibility,
    p_is_24h: p.is_24h ?? false,
    p_restrooms: p.restrooms,
  });
  if (error) {
    if (error.code === "42501" || error.message.includes("row-level")) {
      throw new Error("로그인 후 등록할 수 있어요.");
    }
    throw error;
  }
  return data as string;
}

// 기존 건물에 화장실 1개 추가 → 새 화장실 id 반환
export async function addRestroom(buildingId: string, r: RestroomInput): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("restrooms").insert({
    building_id: buildingId,
    restroom_type: r.restroom_type,
    floor: r.floor || null,
    area_desc: r.area_desc || null,
    bidet_location: r.bidet_location || null,
    bidet_status: r.bidet_status || "need_check",
    amenities: r.amenities ?? [],
    memo: r.memo || null,
    created_by: auth.user?.id,
    review_required_at: now,
    last_verified_at: now,
  }).select("id").single();
  if (error) {
    if (error.code === "42501" || error.message.includes("row-level")) throw new Error("로그인 후 추가할 수 있어요.");
    throw error;
  }
  return data.id as string;
}

// 사진 업로드 → Storage + restroom_photos(기본 pending) + 자동검열 트리거
export async function uploadPhotos(restroomId: string, files: File[]): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  for (const file of files) {
    const path = `${restroomId}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
    const up = await supabase.storage.from("restroom-photos").upload(path, file, { upsert: false });
    if (up.error) throw up.error;

    // status는 클라이언트가 지정하지 않음(0012: insert 권한 회수) → 기본 'pending'
    const { data: photo, error } = await supabase
      .from("restroom_photos")
      .insert({ restroom_id: restroomId, storage_path: path, uploaded_by: auth.user?.id })
      .select("id")
      .single();
    if (error) throw error;

    // 자동 검열 (실패해도 등록 자체는 유지 — 관리자 수동 검수로 커버)
    await supabase.functions.invoke("moderate-photo", { body: { photo_id: photo.id, path } }).catch(() => {});
  }
}
