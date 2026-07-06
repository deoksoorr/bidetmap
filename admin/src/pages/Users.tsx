import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { REPORT_TYPE, fmt } from "../lib/labels";

// A10 제보 이력 · A11 제한 · A12 신뢰도
export default function Users() {
  const [rows, setRows] = useState<any[]>([]);
  const [history, setHistory] = useState<any[] | null>(null);

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("id,nickname,is_restricted,role,user_reliability_scores(score,reports_confirmed,reports_rejected,false_report_count)")
      .order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: string, restricted: boolean) {
    const { error } = await supabase.rpc("set_user_restricted", { p_user: id, p_restricted: restricted });
    if (error) return alert(error.message);
    load();
  }

  async function showHistory(id: string) {
    const { data } = await supabase.from("place_reports")
      .select("report_type,status,created_at,restrooms(buildings(name))")
      .eq("reporter_id", id).order("created_at", { ascending: false }).limit(50);
    setHistory(data ?? []);
  }

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <table style={{ flex: 1, borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ textAlign: "left", color: "#888" }}><th>사용자</th><th>신뢰도</th><th>승인/반려</th><th>허위</th><th>상태</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => {
            const s = Array.isArray(u.user_reliability_scores) ? u.user_reliability_scores[0] : u.user_reliability_scores;
            return (
              <tr key={u.id} style={{ borderTop: "1px solid #eee" }}>
                <td onClick={() => showHistory(u.id)} style={{ cursor: "pointer" }}>{u.nickname ?? u.id.slice(0, 8)}{u.role === "admin" && " (관리자)"}</td>
                <td>{s?.score ?? "-"}</td>
                <td>{s?.reports_confirmed ?? 0}/{s?.reports_rejected ?? 0}</td>
                <td style={{ color: (s?.false_report_count ?? 0) >= 5 ? "#fa5252" : "#888" }}>{s?.false_report_count ?? 0}</td>
                <td>{u.is_restricted ? "제한됨" : "정상"}</td>
                <td><button onClick={() => toggle(u.id, !u.is_restricted)}>{u.is_restricted ? "해제" : "제한"}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {history && (
        <aside style={{ width: 320, borderLeft: "1px solid #eee", paddingLeft: 20 }}>
          <h4>제보 이력</h4>
          {history.map((h, i) => (
            <div key={i} style={{ borderTop: "1px solid #f0f0f0", padding: "6px 0", fontSize: 13 }}>
              {REPORT_TYPE[h.report_type]} · {h.status} <div style={{ color: "#aaa" }}>{h.restrooms?.buildings?.name} · {fmt(h.created_at)}</div>
            </div>
          ))}
          {history.length === 0 && <p style={{ color: "#888" }}>이력이 없습니다.</p>}
          <button onClick={() => setHistory(null)}>닫기</button>
        </aside>
      )}
    </div>
  );
}
