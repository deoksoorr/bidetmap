import { useEffect, useState } from "react";
import { supabase, photoUrl } from "../lib/supabase";

// A9 사진 검수 및 삭제
export default function Photos() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("pending");

  async function load() {
    let q = supabase.from("restroom_photos")
      .select("id,storage_path,status,created_at,restrooms(buildings(name))")
      .order("created_at", { ascending: false }).limit(100);
    if (status) q = q.eq("status", status);
    setRows((await q).data ?? []);
  }
  useEffect(() => { load(); }, [status]);

  async function moderate(row: any, action: "approve" | "reject" | "delete") {
    const { data: u } = await supabase.auth.getUser();
    if (action === "delete") {
      // 로그 먼저 기록(사진 행 삭제 시 FK cascade로 로그가 사라지지 않도록 별도 감사 확보)
      await supabase.from("admin_logs").insert({ admin_id: u.user?.id, action: "delete_photo", target_type: "photo", target_id: row.id, detail: { path: row.storage_path } });
      const rm = await supabase.storage.from("restroom-photos").remove([row.storage_path]);
      if (rm.error) return alert("스토리지 삭제 실패: " + rm.error.message);
      await supabase.from("restroom_photos").delete().eq("id", row.id);
    } else {
      await supabase.from("restroom_photos").update({ status: action === "approve" ? "visible" : "hidden" }).eq("id", row.id);
      await supabase.from("photo_moderation_logs").insert({ photo_id: row.id, action, reason: "manual", moderated_by: u.user?.id });
    }
    load();
  }

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginBottom: 12 }}>
        <option value="pending">검수 대기</option><option value="visible">노출중</option>
        <option value="hidden">숨김</option><option value="">전체</option>
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
            <img src={photoUrl(r.storage_path)} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 6 }} />
            <div style={{ fontSize: 12, color: "#888", margin: "6px 0" }}>{r.restrooms?.buildings?.name} · {r.status}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => moderate(r, "approve")}>승인</button>
              <button onClick={() => moderate(r, "reject")}>숨김</button>
              <button onClick={() => moderate(r, "delete")} style={{ color: "#fa5252" }}>삭제</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p style={{ color: "#888" }}>대상 사진이 없습니다.</p>}
      </div>
    </div>
  );
}
