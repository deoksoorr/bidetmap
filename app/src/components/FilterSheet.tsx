import { useState, type ReactNode } from "react";
import type { NearbyFilters } from "../lib/types";
import { PLACE_TYPE, ACCESS, RESTROOM_TYPE, opts } from "../lib/labels";

// U3: 필터 바텀시트
export default function FilterSheet({
  initial,
  onApply,
  onClose,
}: {
  initial: NearbyFilters;
  onApply: (f: NearbyFilters) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<NearbyFilters>(initial);

  const toggle = (key: "types" | "access" | "restroom", code: string) => {
    const cur = f[key] ?? [];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    setF({ ...f, [key]: next.length ? next : undefined });
  };
  const isOn = (key: "types" | "access" | "restroom", code: string) => (f[key] ?? []).includes(code);

  return (
    <div className="filter-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <h4>장소 유형</h4>
        <div className="chips">{opts(PLACE_TYPE).map((o) => <Chip key={o.code} on={isOn("types", o.code)} onClick={() => toggle("types", o.code)}>{o.label}</Chip>)}</div>
        <h4>이용 가능성</h4>
        <div className="chips">{opts(ACCESS).map((o) => <Chip key={o.code} on={isOn("access", o.code)} onClick={() => toggle("access", o.code)}>{o.label}</Chip>)}</div>
        <h4>화장실 구분</h4>
        <div className="chips">{opts(RESTROOM_TYPE).map((o) => <Chip key={o.code} on={isOn("restroom", o.code)} onClick={() => toggle("restroom", o.code)}>{o.label}</Chip>)}</div>
        <h4>기타 조건</h4>
        <div className="chips">
          <Chip on={!!f.onlyWorking} onClick={() => setF({ ...f, onlyWorking: f.onlyWorking ? undefined : true })}>정상 작동만</Chip>
          <Chip on={!!f.hasPhoto} onClick={() => setF({ ...f, hasPhoto: f.hasPhoto ? undefined : true })}>사진 있음</Chip>
          <Chip on={!!f.is24h} onClick={() => setF({ ...f, is24h: f.is24h ? undefined : true })}>24시간</Chip>
          <Chip on={f.recentDays === 30} onClick={() => setF({ ...f, recentDays: f.recentDays ? undefined : 30 })}>최근 30일 확인</Chip>
        </div>
        <div className="filter-foot">
          <button className="ghost" onClick={() => setF({})}>초기화</button>
          <button className="primary" onClick={() => onApply(f)}>적용</button>
        </div>
      </div>
    </div>
  );
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button className={on ? "chip on" : "chip"} onClick={onClick}>{children}</button>
);
