import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { tossLogin } from "../lib/toss";
import { supabase } from "../lib/supabase";

export default function Onboarding() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  // 토스 로그인(선택). 앱인토스에선 이미 토스 로그인 상태라 한 번에 연결됨.
  async function loginWithToss() {
    setLoading(true);
    try {
      const { authorizationCode } = await tossLogin();
      const { data, error } = await supabase.functions.invoke("toss-auth", { body: { authorizationCode } });
      if (error || !data?.access_token) throw new Error("no_session");
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      nav("/map");
    } catch {
      alert("로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  // 로컬 테스트용(dev 빌드에서만)
  async function devLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) return alert("개발용 로그인 실패: " + error.message);
    nav("/map");
  }

  return (
    <main className="onboarding">
      <div className="ob-hero">
        <img className="ob-logo" src="/bidetmap_logo_128.png" alt="비데맵" />
        <h1 className="ob-title">비데맵</h1>
        <p className="ob-tagline">전국 화장실 비데 지도</p>
      </div>

      <ul className="ob-features">
        <li><span>📍</span> 현재 위치 기준 주변 비데 화장실</li>
        <li><span>🧻</span> 비데 상태·편의시설 한눈에</li>
        <li><span>✅</span> 최근 확인일로 믿을 수 있는 정보</li>
      </ul>

      <div className="ob-actions">
        <button className="primary" onClick={() => nav("/map")}>비데맵 구경하기</button>
        <button className="ob-login" onClick={loginWithToss} disabled={loading}>
          {loading ? "연결 중…" : "토스로 로그인"}
        </button>
      </div>
      <p className="notice">구경은 로그인 없이 가능해요. 장소 등록·제보 시에만 토스 로그인이 필요해요.</p>
      <button className="ob-terms" onClick={() => nav("/terms")}>서비스 이용약관</button>

      {import.meta.env.DEV && (
        <div className="dev-login">
          <p className="notice">— 개발용 로그인 (로컬 테스트) —</p>
          <input placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="비밀번호" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="ghost" onClick={devLogin}>개발용 로그인</button>
        </div>
      )}
    </main>
  );
}
