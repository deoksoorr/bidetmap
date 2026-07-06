import { useEffect, useState } from "react";
import { supabase, logAction } from "../lib/supabase";

// A14 카테고리/상태값 관리 · A15 광고/수익화 설정
export default function Settings() {
  const [cats, setCats] = useState<any[]>([]);
  const [mons, setMons] = useState<any[]>([]);

  async function load() {
    setCats((await supabase.from("category_settings").select("*").order("group").order("sort")).data ?? []);
    setMons((await supabase.from("monetization_settings").select("*").order("key")).data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function saveCat(c: any) {
    await supabase.from("category_settings").update({ label: c.label, enabled: c.enabled, sort: c.sort }).eq("id", c.id);
    await logAction("update_category", "category", c.id);
    load();
  }

  async function saveMon(m: any) {
    let cfg = m.config;
    try { cfg = typeof m.config === "string" ? JSON.parse(m.config) : m.config; } catch { return alert("config JSON 형식 오류"); }
    await supabase.from("monetization_settings").update({ enabled: m.enabled, config: cfg }).eq("id", m.id);
    await logAction("update_monetization", "monetization", m.id, { key: m.key, enabled: m.enabled });
    load();
  }

  return (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
      <section style={{ flex: 1, minWidth: 340 }}>
        <h4>카테고리 / 상태값 (A14)</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", color: "#888" }}><th>그룹</th><th>코드</th><th>라벨</th><th>노출</th><th></th></tr></thead>
          <tbody>
            {cats.map((c, i) => (
              <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                <td>{c.group}</td><td>{c.code}</td>
                <td><input value={c.label} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /></td>
                <td><input type="checkbox" checked={c.enabled} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} /></td>
                <td><button onClick={() => saveCat(c)}>저장</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ flex: 1, minWidth: 340 }}>
        <h4>광고 / 수익화 설정 (A15)</h4>
        {mons.map((m, i) => (
          <div key={m.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <b>{m.key}</b>{" "}
            <label><input type="checkbox" checked={m.enabled} onChange={(e) => setMons(mons.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} /> 활성</label>
            <textarea value={typeof m.config === "string" ? m.config : JSON.stringify(m.config)} onChange={(e) => setMons(mons.map((x, j) => j === i ? { ...x, config: e.target.value } : x))} style={{ width: "100%", minHeight: 50, margin: "8px 0" }} />
            <button onClick={() => saveMon(m)}>저장</button>
          </div>
        ))}
      </section>
    </div>
  );
}
