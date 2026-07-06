// Edge Function: 토스 authorizationCode 검증 → profiles 매핑 → Supabase 세션 발급
// 보안: 클라이언트 토큰을 신뢰하지 않음(fail-closed). service_role는 서버(이 함수)에서만 사용.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { authorizationCode } = await req.json();
    if (!authorizationCode) return json({ error: "authorizationCode_required" }, 400);

    // 1) 토스 서버로 authorizationCode 검증 (서버-서버). 실패 시 즉시 거부.
    const tossUserKey = await verifyTossAuthorizationCode(authorizationCode);
    if (!tossUserKey) return json({ error: "invalid_authorization" }, 401);

    // 2) profiles를 toss_user_key로 조회(인덱스). listUsers 페이지네이션 문제 회피.
    let userId: string | undefined;
    const { data: prof } = await admin.from("profiles").select("id").eq("toss_user_key", tossUserKey).maybeSingle();
    userId = prof?.id;

    const email = `${tossUserKey}@toss.bidetmap`;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error || !created.user) return json({ error: "user_create_failed" }, 500);
      userId = created.user.id;
      await admin.from("profiles").insert({ id: userId, toss_user_key: tossUserKey });
      await admin.from("user_reliability_scores").insert({ user_id: userId });
    }

    // 3) 서버에서 세션 발급(action_link를 클라이언트에 노출하지 않음)
    const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (le || !link?.properties?.hashed_token) return json({ error: "session_init_failed" }, 500);
    const { data: sess, error: ve } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
    if (ve || !sess.session) return json({ error: "session_failed" }, 500);

    return json({
      userId,
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
    });
  } catch (e) {
    console.error("toss-auth error:", e); // 원문은 로그로만
    return json({ error: "internal_error" }, 500);
  }
});

// 토스 authorizationCode → tossUserKey. 실제 토스 API 연동 지점.
// TOSS_* 미설정 시 기본 fail-closed. 로컬 개발은 TOSS_AUTH_DEV=1 명시 옵트인일 때만 허용.
async function verifyTossAuthorizationCode(code: string): Promise<string | null> {
  const base = Deno.env.get("TOSS_API_BASE");
  const clientId = Deno.env.get("TOSS_CLIENT_ID");
  const clientSecret = Deno.env.get("TOSS_CLIENT_SECRET");
  if (!base || !clientId || !clientSecret) {
    if (Deno.env.get("TOSS_AUTH_DEV") === "1") return `dev-${code}`;
    console.error("TOSS_* env not configured — refusing to trust client token");
    return null;
  }
  const res = await fetch(`${base}/api/v1/apps-in-toss/user/oauth2/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ authorizationCode: code, clientId, clientSecret }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.userKey ?? data.sub ?? data.body?.userKey ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
