import { supabase } from "./supabase";
import { tossLogin } from "./toss";

// 세션이 있으면 true. 없으면 토스 로그인 → 세션 수립 후 true. 취소/실패 시 false.
// 쓰기 액션(등록·제보·즐겨찾기 등) 직전에 호출해 browse→write를 매끄럽게 잇는다.
export async function ensureLogin(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return true;
  try {
    const { authorizationCode, referrer } = await tossLogin();
    const { data, error } = await supabase.functions.invoke("toss-auth", { body: { authorizationCode, referrer } });
    if (error || !data?.access_token) return false;
    await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    return true;
  } catch {
    return false;
  }
}
