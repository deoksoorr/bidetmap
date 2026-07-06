import { useRef, useState, type ChangeEvent } from "react";

// U6: 사진 업로드 + 개인정보 주의 안내 오버레이 (첫 촬영 전 필수 노출)
export default function PhotoUploader({
  files,
  onChange,
}: {
  files: File[];
  onChange: (f: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ack, setAck] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  function addClick() {
    if (!ack) return setShowNotice(true);
    inputRef.current?.click();
  }

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    onChange([...files, ...picked].slice(0, 5)); // 최대 5장
    e.target.value = "";
  }

  return (
    <div className="uploader">
      <div className="thumbs">
        {files.map((f, i) => (
          <div key={i} className="thumb">
            <img src={URL.createObjectURL(f)} alt="" />
            <button onClick={() => onChange(files.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {files.length < 5 && <button className="add-photo" onClick={addClick}>＋ 사진</button>}
      </div>
      {/* 앱인토스 카메라 SDK 연동 지점: capture 속성으로 촬영/앨범 모두 지원 */}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pick} />

      {showNotice && (
        <div className="notice-overlay">
          <div className="notice-card">
            <h4>사진 업로드 전 확인해 주세요</h4>
            <ul>
              <li>사람·신체가 나오지 않게 촬영해 주세요.</li>
              <li>거울에 얼굴이 비치지 않도록 주의해 주세요.</li>
              <li>이름·전화번호 등 개인정보가 보이지 않게 해주세요.</li>
              <li>비데·화장실 상태 확인 목적의 사진만 올려주세요.</li>
            </ul>
            <button
              className="primary"
              onClick={() => {
                setAck(true);
                setShowNotice(false);
                inputRef.current?.click();
              }}
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
