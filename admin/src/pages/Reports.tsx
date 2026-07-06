import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { REPORT_TYPE, fmt } from "../lib/labels";

// A7 신고 관리 · A8 승인/반려
export default function Reports() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("place_reports")
      .select("id,report_type,payload,created_at,reporter_id,restrooms(id,restroom_type,buildings(name))")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function resolve(id: string, approve: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("resolve_report", { p_report_id: id, p_approve: approve });
    setBusy(null);
    if (error) return alert(error.message);
    load();
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead><tr style={{ textAlign: "left", color: "#888" }}><th>장소</th><th>유형</th><th>내용</th><th>일시</th><th>처리</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
            <td>{r.restrooms?.buildings?.name} ({r.restrooms?.restroom_type})</td>
            <td>{REPORT_TYPE[r.report_type]}</td>
            <td style={{ color: "#666" }}>{r.payload?.note ?? "-"}</td>
            <td>{fmt(r.created_at)}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button disabled={busy === r.id} onClick={() => resolve(r.id, true)}>승인</button>{" "}
              <button disabled={busy === r.id} onClick={() => resolve(r.id, false)}>반려</button>
            </td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24, color: "#888" }}>처리할 신고가 없습니다.</td></tr>}
      </tbody>
    </table>
  );
}
