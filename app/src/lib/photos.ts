import { supabase } from "./supabase";

// 비공개 버킷 → visible 사진의 서명 URL 맵(path→url) 요청
export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.functions.invoke("photo-url", { body: { paths } });
  if (error || !data) return {};
  return (data.urls as Record<string, string>) ?? {};
}
