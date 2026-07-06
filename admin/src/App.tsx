import { useEffect, useState, type FormEvent } from "react";
import { supabase, checkAdmin } from "./lib/supabase";
import Places from "./pages/Places";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Photos from "./pages/Photos";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Dashboard from "./pages/Dashboard";

const NAV: { name: string; ico: string }[] = [
  { name: "대시보드", ico: "📊" },
  { name: "장소 목록", ico: "📍" },
  { name: "신고 관리", ico: "🚩" },
  { name: "사진 검수", ico: "🖼️" },
  { name: "사용자 관리", ico: "👤" },
  { name: "운영 설정", ico: "⚙️" },
  { name: "활동 로그", ico: "📜" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState(NAV[0].name);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) setIsAdmin(await checkAdmin(data.user.id));
      setReady(true);
    });
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error || !data.user) return alert("로그인 실패");
    if (!(await checkAdmin(data.user.id))) return alert("관리자 권한이 없습니다");
    setIsAdmin(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }

  if (!ready) return <div style={{ padding: 40, color: "#8b95a1" }}>불러오는 중…</div>;

  if (!isAdmin)
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <div className="brand"><img src="/bidetmap_logo_128.png" alt="" /> 비데맵 관리자</div>
          <p className="sub">운영자 계정으로 로그인해 주세요.</p>
          <input placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="비밀번호" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="submit" className="btn-primary">로그인</button>
        </form>
      </div>
    );

  return (
    <div className="admin-shell">
      <nav className="sidebar">
        <div className="brand"><img src="/bidetmap_logo_128.png" alt="" /> 비데맵 관리자</div>
        {NAV.map((n) => (
          <button key={n.name} className={`nav-item${tab === n.name ? " active" : ""}`} onClick={() => setTab(n.name)}>
            <span className="ico">{n.ico}</span> {n.name}
          </button>
        ))}
        <div className="spacer" />
        <button className="signout" onClick={signOut}>로그아웃</button>
      </nav>
      <div className="main">
        <div className="topbar">
          <h1>{tab}</h1>
        </div>
        <div className="content">
          <div className="panel">
            {tab === "대시보드" && <Dashboard />}
            {tab === "장소 목록" && <Places />}
            {tab === "신고 관리" && <Reports />}
            {tab === "사진 검수" && <Photos />}
            {tab === "사용자 관리" && <Users />}
            {tab === "운영 설정" && <Settings />}
            {tab === "활동 로그" && <Logs />}
          </div>
        </div>
      </div>
    </div>
  );
}
