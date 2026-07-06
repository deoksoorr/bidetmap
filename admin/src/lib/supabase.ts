import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// 로그인 사용자가 관리자(role=admin)인지 확인
export async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export const photoUrl = (path: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/restroom-photos/${path}`;

// A13: 관리자 활동 로그 기록
export async function logAction(action: string, targetType: string, targetId: string, detail?: unknown) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("admin_logs").insert({
    admin_id: data.user?.id, action, target_type: targetType, target_id: targetId, detail: detail ?? null,
  });
}
