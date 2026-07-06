import { supabase } from "./supabase";

export type ReportType = "helpful" | "recent_check" | "wrong_info" | "broken" | "removed";

export async function submitReport(restroomId: string, type: ReportType, payload?: unknown): Promise<void> {
  const { error } = await supabase.rpc("submit_report", {
    p_restroom_id: restroomId,
    p_type: type,
    p_payload: payload ?? null,
  });
  if (error) {
    const m = error.message || "";
    if (m.includes("auth_required") || m.includes("row-level")) throw new Error("로그인 후 이용할 수 있어요.");
    if (m.includes("duplicate_open_report")) throw new Error("이미 신고한 화장실이에요. 검수 후 다시 시도해 주세요.");
    if (m.includes("duplicate_recent_signal")) throw new Error("최근에 이미 반영했어요. 잠시 후 다시 시도해 주세요.");
    throw new Error(m);
  }
}
