import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LocationPicker from "../components/LocationPicker";
import PhotoUploader from "../components/PhotoUploader";
import { createPlace, uploadPhotos, emptyRestroom, type RestroomInput } from "../lib/places";
import { fetchNearby } from "../lib/api";
import { ensureLogin } from "../lib/auth";
import type { NearbyBuilding } from "../lib/types";
import { supabase } from "../lib/supabase";
import RestroomFields from "../components/RestroomFields";
import { PLACE_TYPE, ACCESS, opts, ACCESS_REQUIRED_TYPES, distanceText } from "../lib/labels";

export default function Register() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [loc, setLoc] = useState({ lat: 0, lng: 0, address: "", name: "" });
  const [b, setB] = useState({ name: "", place_type: "cafe", accessibility: "need_check", is_24h: false });
  const [rooms, setRooms] = useState<RestroomInput[]>([emptyRestroom()]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [nearby, setNearby] = useState<NearbyBuilding[]>([]);

  const accessRequired = ACCESS_REQUIRED_TYPES.includes(b.place_type);

  // 선택 위치 근처(150m)에 이미 등록된 장소가 있으면 "화장실 추가"로 유도(중복 방지)
  useEffect(() => {
    if (step !== 0 || !loc.lat) { setNearby([]); return; }
    fetchNearby({ lat: loc.lat, lng: loc.lng }, 150).then(setNearby).catch(() => setNearby([]));
  }, [step, loc.lat, loc.lng]);

  function next() {
    if (step === 0 && !loc.lat) return alert("위치를 선택해 주세요.");
    if (step === 1) {
      if (!b.name.trim()) return alert("장소명을 입력해 주세요.");
      if (accessRequired && b.accessibility === "need_check")
        return alert("호텔/모텔/일반건물은 이용 조건을 반드시 선택해 주세요.");
    }
    if (step === 2 && rooms.some((r) => !r.restroom_type || !r.bidet_status))
      return alert("각 화장실의 구분과 비데 상태를 선택해 주세요.");
    setStep((s) => s + 1);
  }

  function setRoom(i: number, patch: Partial<RestroomInput>) {
    setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (!(await ensureLogin())) return alert("로그인 후 등록할 수 있어요.");
    setSaving(true);
    try {
      const buildingId = await createPlace({
        name: b.name,
        place_type: b.place_type,
        accessibility: b.accessibility,
        is_24h: b.is_24h,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        restrooms: rooms,
      });
      if (photos.length) {
        const { data } = await supabase.from("restrooms").select("id").eq("building_id", buildingId).order("created_at").limit(1);
        if (data?.[0]) await uploadPhotos(data[0].id, photos);
      }
      alert("등록되었어요. 관리자 검수 후 지도에 반영됩니다.");
      nav("/map");
    } catch (e: any) {
      alert("등록에 실패했어요: " + (e.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="register">
      <header className="reg-head">
        <button onClick={() => (step ? setStep(step - 1) : nav("/map"))}>‹</button>
        <span>장소 등록 ({step + 1}/4)</span>
      </header>

      {step === 0 && (
        <>
          <LocationPicker value={loc} onChange={(v) => { setLoc((p) => ({ ...p, ...v })); if (v.name && !b.name) setB((x) => ({ ...x, name: v.name! })); }} />
          {nearby.length > 0 && (
            <div className="existing-hint">
              <p>이 근처에 이미 등록된 장소가 있어요. 중복 대신 화장실을 추가해 주세요.</p>
              <ul>
                {nearby.slice(0, 5).map((n) => (
                  <li key={n.id} onClick={() => nav(`/place/${n.id}/add`)}>
                    <b>{n.name}</b><span>{distanceText(n.distance_m)}</span><em>화장실 추가 ›</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <section className="form">
          <label>장소명<input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></label>
          <label>장소 유형
            <select value={b.place_type} onChange={(e) => setB({ ...b, place_type: e.target.value })}>
              {opts(PLACE_TYPE).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </label>
          <label>이용 가능성 {accessRequired && <em className="req">(필수)</em>}
            <select value={b.accessibility} onChange={(e) => setB({ ...b, accessibility: e.target.value })}>
              {opts(ACCESS).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={b.is_24h} onChange={(e) => setB({ ...b, is_24h: e.target.checked })} /> 24시간 이용 가능</label>
        </section>
      )}

      {step === 2 && (
        <section className="form">
          {rooms.map((r, i) => (
            <div key={i} className="room-card">
              <div className="room-head">화장실 {i + 1}{rooms.length > 1 && <button onClick={() => setRooms(rooms.filter((_, j) => j !== i))}>삭제</button>}</div>
              <RestroomFields value={r} onChange={(patch) => setRoom(i, patch)} />
            </div>
          ))}
          <button className="ghost" onClick={() => setRooms([...rooms, emptyRestroom()])}>＋ 화장실 추가</button>
        </section>
      )}

      {step === 3 && (
        <section className="form">
          <PhotoUploader files={photos} onChange={setPhotos} />
          <div className="summary">
            <div><b>{b.name}</b> · {PLACE_TYPE[b.place_type]}</div>
            <div className="sub">{loc.address}</div>
            <div className="sub">화장실 {rooms.length}곳 · 사진 {photos.length}장</div>
          </div>
        </section>
      )}

      <footer className="reg-foot">
        {step < 3 ? <button className="primary" onClick={next}>다음</button>
          : <button className="primary" onClick={submit} disabled={saving}>{saving ? "등록 중…" : "등록하기"}</button>}
      </footer>
    </div>
  );
}
