import type { RestroomInput } from "../lib/places";
import { RESTROOM_TYPE, BIDET_STATUS, AMENITIES, opts } from "../lib/labels";

// 화장실 입력 필드(등록 폼 / 화장실 추가에서 공용 사용)
export default function RestroomFields({
  value,
  onChange,
}: {
  value: RestroomInput;
  onChange: (patch: Partial<RestroomInput>) => void;
}) {
  const amenities = value.amenities ?? [];
  const toggleAmenity = (code: string) =>
    onChange({ amenities: amenities.includes(code) ? amenities.filter((c) => c !== code) : [...amenities, code] });

  return (
    <>
      <label>화장실 구분
        <select value={value.restroom_type} onChange={(e) => onChange({ restroom_type: e.target.value })}>
          {opts(RESTROOM_TYPE).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
      </label>
      <div className="two">
        <input placeholder="층 (예: B1, 2F)" value={value.floor ?? ""} onChange={(e) => onChange({ floor: e.target.value })} />
        <input placeholder="구역 (예: 푸드코트 옆)" value={value.area_desc ?? ""} onChange={(e) => onChange({ area_desc: e.target.value })} />
      </div>
      <input placeholder="비데 위치 (예: 입구 1번째 칸)" value={value.bidet_location ?? ""} onChange={(e) => onChange({ bidet_location: e.target.value })} />
      <label>비데 상태
        <select value={value.bidet_status} onChange={(e) => onChange({ bidet_status: e.target.value })}>
          {opts(BIDET_STATUS).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
      </label>
      <div className="chips">
        {opts(AMENITIES).map((o) => (
          <button key={o.code} className={amenities.includes(o.code) ? "chip on" : "chip"} onClick={() => toggleAmenity(o.code)}>{o.label}</button>
        ))}
      </div>
    </>
  );
}
