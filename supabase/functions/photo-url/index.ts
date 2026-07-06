// Edge Function: 공개 열람용 서명 URL 발급. status='visible' 사진만 서명(비공개 버킷).
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { paths } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) return json({ urls: {} });

    // visible 사진만 화이트리스트 (요청 경로 중 실제 노출 대상만 서명)
    const { data: rows } = await admin
      .from("restroom_photos")
      .select("storage_path")
      .in("storage_path", paths.slice(0, 30))
      .eq("status", "visible");

    const urls: Record<string, string> = {};
    for (const r of rows ?? []) {
      const { data } = await admin.storage.from("restroom-photos").createSignedUrl(r.storage_path, 3600);
      if (data?.signedUrl) urls[r.storage_path] = data.signedUrl;
    }
    return json({ urls });
  } catch (e) {
    console.error("photo-url error:", e);
    return json({ urls: {} }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
