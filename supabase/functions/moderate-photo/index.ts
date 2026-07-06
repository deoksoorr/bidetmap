// Edge Function: 업로드 사진 자동 검열 → photo_moderation_logs 기록 + status 결정
// Phase 2 골격. 실제 얼굴/개인정보/NSFW 판별 모델 연동은 Phase 7에서 채운다.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { photo_id, path } = await req.json();
    if (!photo_id) return json({ error: "photo_id required" }, 400);

    const result = await moderate(path);

    // fail-closed: 검열 미연동이면 자동 공개하지 않고 관리자 수동 검수(pending) 유지.
    let status: string;
    let action: string;
    if (!result.configured) {
      status = "pending"; action = "auto_flag";
    } else if (result.flagged) {
      status = "rejected"; action = "reject";
    } else {
      status = "visible"; action = "auto_pass";
    }
    await admin.from("restroom_photos").update({ status }).eq("id", photo_id);
    await admin.from("photo_moderation_logs").insert({ photo_id, action, reason: result.reason, model_result: result.raw });
    return json({ status });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function moderate(path: string): Promise<{ configured: boolean; flagged: boolean; reason: string | null; raw: unknown }> {
  const endpoint = Deno.env.get("MODERATION_API_URL");
  if (!endpoint) {
    // 미연동 → 자동 공개 금지(fail-closed). 관리자 수동 검수(A9)로만 노출.
    return { configured: false, flagged: false, reason: "moderation_not_configured", raw: { stub: true } };
  }
  // 연동 지점: 얼굴/개인정보/NSFW 판별 비전 모델 호출
  const publicUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/restroom-photos/${path}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("MODERATION_API_KEY") ?? ""}` },
    body: JSON.stringify({ imageUrl: publicUrl, checks: ["face", "personal_info", "nsfw"] }),
  }).then((r) => r.json());
  const flagged = !!(res.face || res.personal_info || res.nsfw);
  return { configured: true, flagged, reason: flagged ? Object.keys(res).filter((k) => res[k]).join(",") : null, raw: res };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
