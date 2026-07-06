import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchBuildingDetail } from "../lib/api";
import { submitReport } from "../lib/reports";
import { getFavorite, toggleFavorite, recordView, shareBuilding, openDirections } from "../lib/social";
import { ensureLogin } from "../lib/auth";
import { photoUrl } from "../lib/supabase";
import type { BuildingDetail } from "../lib/types";
import { PLACE_TYPE, ACCESS, RESTROOM_TYPE, BIDET_STATUS, AMENITIES, verifiedText } from "../lib/labels";
import ReportModal from "../components/ReportModal";

export default function PlaceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState<BuildingDetail | null>(null);
  const [err, setErr] = useState(false);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [toast, setToast] = useState("");

  function reload() {
    fetchBuildingDetail(id!)
      .then((d) => {
        if (!d) { setErr(true); return; } // 숨김/삭제/없는 장소 → 무한 로딩 방지
        setD(d);
      })
      .catch(() => setErr(true));
  }
  useEffect(() => {
    reload();
    recordView(id!);
    getFavorite(id!).then(setFav).catch(() => {});
  }, [id]);

  async function onToggleFav() {
    if (!(await ensureLogin())) return;
    try { setFav(await toggleFavorite(id!)); } catch (e: any) { alert(e.message); }
  }

  async function quick(restroomId: string, type: "helpful" | "recent_check") {
    if (!(await ensureLogin())) return;
    try {
      await submitReport(restroomId, type);
      setToast(type === "helpful" ? "도움돼요로 표시했어요" : "최근 확인으로 갱신했어요");
      setTimeout(() => setToast(""), 1500);
      reload();
    } catch (e: any) {
      alert(e.message ?? "처리에 실패했어요.");
    }
  }

  if (err) return <Center>정보를 불러오지 못했어요.</Center>;
  if (!d) return <Center>불러오는 중…</Center>;

  return (
    <div className="detail">
      <header className="detail-head">
        <button onClick={() => nav(-1)}>‹</button>
        <span>{d.name}</span>
      </header>

      <div className="detail-body">
        <div className="dbadges">
          <span className="tag">{PLACE_TYPE[d.place_type] ?? d.place_type}</span>
          <span className="tag">{ACCESS[d.accessibility] ?? d.accessibility}</span>
          {d.is_24h && <span className="tag">24시간</span>}
        </div>
        {d.address && <p className="daddr">{d.address}</p>}

        <div className="bactions">
          <button className={fav ? "on" : ""} onClick={onToggleFav}>{fav ? "★ 저장됨" : "☆ 즐겨찾기"}</button>
          <button onClick={() => shareBuilding(d)}>↗ 공유</button>
          <button onClick={() => openDirections(d)}>🧭 길찾기</button>
        </div>

        {d.restrooms.map((r) => (
          <div key={r.id} className="rcard">
            <div className="rtop">
              <b>{RESTROOM_TYPE[r.restroom_type] ?? r.restroom_type}{r.floor ? ` · ${r.floor}` : ""}</b>
              <span className={`badge s-${r.bidet_status}`}>{BIDET_STATUS[r.bidet_status]}</span>
            </div>
            {r.area_desc && <div className="rline">📍 {r.area_desc}</div>}
            {r.bidet_location && <div className="rline">🚽 비데 위치: {r.bidet_location}</div>}
            {r.amenities.length > 0 && (
              <div className="ramen">{r.amenities.map((a) => <span key={a}>{AMENITIES[a] ?? a}</span>)}</div>
            )}
            {r.photos.length > 0 && (
              <div className="rphotos">{r.photos.map((p) => <img key={p} src={photoUrl(p)} alt="" />)}</div>
            )}
            {r.memo && <p className="rmemo">{r.memo}</p>}
            <div className="rverify">{verifiedText(r.last_verified_at)} · 도움 {r.helpful_count}</div>
            <div className="ractions">
              <button onClick={() => quick(r.id, "helpful")}>👍 도움됐어요</button>
              <button onClick={() => quick(r.id, "recent_check")}>✅ 최근 확인</button>
              <button onClick={() => setReportFor(r.id)}>🚩 신고</button>
            </div>
          </div>
        ))}
        <button className="add-restroom" onClick={() => nav(`/place/${d.id}/add`)}>＋ 이 장소에 화장실 추가</button>
      </div>
      {/* 즐겨찾기/공유/길찾기 건물 액션은 Phase 5에서 연결 */}
      {toast && <div className="map-toast">{toast}</div>}
      {reportFor && (
        <ReportModal
          restroomId={reportFor}
          onClose={() => setReportFor(null)}
          onDone={() => { setReportFor(null); setToast("신고가 접수됐어요"); setTimeout(() => setToast(""), 1500); reload(); }}
        />
      )}
    </div>
  );
}

const Center = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: 40, textAlign: "center", color: "#8b95a1" }}>{children}</div>
);
