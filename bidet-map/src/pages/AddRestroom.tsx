import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RestroomFields from "../components/RestroomFields";
import PhotoUploader from "../components/PhotoUploader";
import { addRestroom, uploadPhotos, emptyRestroom, type RestroomInput } from "../lib/places";
import { ensureLogin } from "../lib/auth";

// 기존 장소(건물)에 화장실 1개 + 사진 추가
export default function AddRestroom() {
  const { id } = useParams();
  const nav = useNavigate();
  const [r, setR] = useState<RestroomInput>(emptyRestroom());
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!r.restroom_type || !r.bidet_status) return alert("구분과 비데 상태를 선택해 주세요.");
    if (!(await ensureLogin())) return alert("로그인 후 추가할 수 있어요.");
    setSaving(true);
    try {
      const restroomId = await addRestroom(id!, r);
      if (photos.length) await uploadPhotos(restroomId, photos);
      alert("화장실을 추가했어요. 사진은 검수 후 표시됩니다.");
      nav(`/place/${id}`);
    } catch (e: any) {
      alert(e.message ?? "추가에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="register">
      <header className="reg-head">
        <button onClick={() => nav(-1)}>‹</button>
        <span>이 장소에 화장실 추가</span>
      </header>
      <section className="form">
        <div className="room-card">
          <RestroomFields value={r} onChange={(patch) => setR({ ...r, ...patch })} />
        </div>
        <PhotoUploader files={photos} onChange={setPhotos} />
      </section>
      <footer className="reg-foot">
        <button className="primary" onClick={submit} disabled={saving}>{saving ? "추가 중…" : "추가하기"}</button>
      </footer>
    </div>
  );
}
