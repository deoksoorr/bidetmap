import { useEffect, useState } from "react";
import { supabase, logAction } from "../lib/supabase";
import { PLACE_TYPE, ACCESS, RESTROOM_TYPE, BIDET_STATUS, STATUS, fmt } from "../lib/labels";

type Row = { id: string; name: string; address: string | null; place_type: string; status: string; report_count: number };
const sel = (m: Record<string, string>) => Object.entries(m);
const PAGE = 50;

// A1 목록 · A2 검색/필터 · A3 상세 · A4 수정 · A5 숨김/삭제(건물·화장실)
export default function Places() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [b, setB] = useState<any | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  async function load(p = 0) {
    let query = supabase.from("buildings")
      .select("id,name,address,place_type,status,report_count", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1);
    if (q.trim()) query = query.ilike("name", `%${q}%`);
    if (status) query = query.eq("status", status);
    const { data, count } = await query;
    setRows((data as Row[]) ?? []);
    setTotal(count ?? 0);
    setPage(p);
  }
  useEffect(() => { load(0); }, [status]);

  async function openDetail(id: string) {
    const { data: bd } = await supabase.from("buildings").select("*").eq("id", id).single();
    const { data: rs } = await supabase.from("restrooms").select("*").eq("building_id", id).order("created_at");
    setB(bd); setRooms(rs ?? []);
  }

  async function save() {
    const { error } = await supabase.from("buildings")
      .update({ name: b.name, place_type: b.place_type, accessibility: b.accessibility, is_24h: b.is_24h }).eq("id", b.id);
    if (error) return alert(error.message);
    await logAction("update_place", "building", b.id);
    alert("저장했습니다."); load(page);
  }

  async function setBuildingStatus(next: "hidden" | "deleted" | "active") {
    const patch: any = { status: next };
    if (next === "hidden") patch.hidden_reason = prompt("숨김 사유를 입력하세요") ?? "";
    if (next === "deleted") patch.deleted_reason = prompt("삭제 사유를 입력하세요") ?? "";
    const { error } = await supabase.from("buildings").update(patch).eq("id", b.id);
    if (error) return alert(error.message);
    await logAction(next === "active" ? "restore_place" : next === "hidden" ? "hide_place" : "delete_place", "building", b.id, patch);
    setB({ ...b, ...patch }); load(page);
  }

  async function saveRoomBidet(roomId: string, bidet_status: string) {
    await supabase.from("restrooms").update({ bidet_status }).eq("id", roomId);
    await logAction("update_restroom", "restroom", roomId, { bidet_status });
    setRooms(rooms.map((r) => (r.id === roomId ? { ...r, bidet_status } : r)));
  }

  // 화장실 개별 숨김/삭제/복구 (건물 삭제 없이 특정 화장실만 정리)
  async function setRoomStatus(roomId: string, next: "hidden" | "deleted" | "active") {
    const patch: any = { status: next };
    if (next === "hidden") patch.hidden_reason = prompt("숨김 사유") ?? "";
    if (next === "deleted") patch.deleted_reason = prompt("삭제 사유") ?? "";
    const { error } = await supabase.from("restrooms").update(patch).eq("id", roomId);
    if (error) return alert(error.message);
    await logAction(next === "active" ? "restore_restroom" : next === "hidden" ? "hide_restroom" : "delete_restroom", "restroom", roomId, patch);
    setRooms(rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)));
  }

  const maxPage = Math.max(0, Math.ceil(total / PAGE) - 1);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="장소명 검색" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(0)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">전체 상태</option>{sel(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => load(0)}>검색</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ textAlign: "left", color: "#888" }}><th>장소명</th><th>유형</th><th>상태</th><th>신고</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => openDetail(r.id)} style={{ borderTop: "1px solid #eee", cursor: "pointer" }}>
                <td>{r.name}</td><td>{PLACE_TYPE[r.place_type]}</td><td>{STATUS[r.status]}</td>
                <td style={{ color: r.report_count ? "#fa5252" : "#888" }}>{r.report_count}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 24, color: "#888" }}>결과가 없습니다.</td></tr>}
          </tbody>
        </table>
        {/* 페이지네이션 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, color: "#666", fontSize: 13 }}>
          <button disabled={page <= 0} onClick={() => load(page - 1)}>‹ 이전</button>
          <span>{total === 0 ? 0 : page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} / 총 {total}</span>
          <button disabled={page >= maxPage} onClick={() => load(page + 1)}>다음 ›</button>
        </div>
      </div>

      {b && (
        <aside style={{ width: 380, borderLeft: "1px solid #eee", paddingLeft: 20, fontSize: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><h4>장소 수정</h4><button onClick={() => setB(null)}>닫기</button></div>
          <label>장소명<br /><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} style={{ width: "100%" }} /></label>
          <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <select value={b.place_type} onChange={(e) => setB({ ...b, place_type: e.target.value })}>{sel(PLACE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select value={b.accessibility} onChange={(e) => setB({ ...b, accessibility: e.target.value })}>{sel(ACCESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <label><input type="checkbox" checked={b.is_24h} onChange={(e) => setB({ ...b, is_24h: e.target.checked })} /> 24시간</label>
          <div style={{ margin: "8px 0", color: "#888" }}>건물 상태: {STATUS[b.status]}{b.hidden_reason && ` (${b.hidden_reason})`}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={save}>저장</button>
            <button onClick={() => setBuildingStatus("hidden")}>건물 숨김</button>
            <button onClick={() => setBuildingStatus("deleted")}>건물 삭제</button>
            {b.status !== "active" && <button onClick={() => setBuildingStatus("active")}>건물 복구</button>}
          </div>
          <hr />
          <b>화장실 {rooms.length}개</b>
          {rooms.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid #f0f0f0", padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{RESTROOM_TYPE[r.restroom_type]}{r.floor ? ` · ${r.floor}` : ""}
                  {r.status !== "active" && <em style={{ color: "#fa5252", fontStyle: "normal" }}> ({STATUS[r.status]})</em>}
                </span>
                <select value={r.bidet_status} onChange={(e) => saveRoomBidet(r.id, e.target.value)}>
                  {sel(BIDET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ color: "#aaa", fontSize: 12, margin: "4px 0" }}>확인 {fmt(r.last_verified_at)} · 신고 {r.report_count}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {r.status === "active" ? (
                  <>
                    <button onClick={() => setRoomStatus(r.id, "hidden")}>숨김</button>
                    <button onClick={() => setRoomStatus(r.id, "deleted")} style={{ color: "#fa5252" }}>삭제</button>
                  </>
                ) : (
                  <button onClick={() => setRoomStatus(r.id, "active")}>복구</button>
                )}
              </div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
