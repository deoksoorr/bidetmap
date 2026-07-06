import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmt } from "../lib/labels";

// A13 관리자 활동 로그
export default function Logs() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("admin_logs")
      .select("id,action,target_type,target_id,detail,created_at,profiles(nickname)")
      .order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead><tr style={{ textAlign: "left", color: "#888" }}><th>관리자</th><th>작업</th><th>대상</th><th>상세</th><th>일시</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
            <td>{r.profiles?.nickname ?? r.admin_id?.slice?.(0, 8) ?? "-"}</td>
            <td>{r.action}</td>
            <td>{r.target_type}</td>
            <td style={{ color: "#888", fontSize: 12 }}>{r.detail ? JSON.stringify(r.detail) : "-"}</td>
            <td>{fmt(r.created_at)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24, color: "#888" }}>로그가 없습니다.</td></tr>}
      </tbody>
    </table>
  );
}
