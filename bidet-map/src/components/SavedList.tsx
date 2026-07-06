import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SavedBuilding } from "../lib/social";
import { PLACE_TYPE } from "../lib/labels";

// U9/U10 공용 목록 화면
export default function SavedList({
  title,
  load,
  emptyText,
}: {
  title: string;
  load: () => Promise<SavedBuilding[]>;
  emptyText: string;
}) {
  const nav = useNavigate();
  const [rows, setRows] = useState<SavedBuilding[] | null>(null);

  useEffect(() => { load().then(setRows).catch(() => setRows([])); }, []);

  return (
    <div className="saved">
      <header className="detail-head">
        <button onClick={() => nav("/map")}>‹</button>
        <span>{title}</span>
      </header>
      <ul className="place-list">
        {rows?.map((b) => (
          <li key={b.id} onClick={() => nav(`/place/${b.id}`)}>
            <div className="row1"><span className="pname">{b.name}</span></div>
            <div className="row2">
              <span className="ptype">{PLACE_TYPE[b.place_type] ?? b.place_type}</span>
              {b.address && <span>{b.address}</span>}
            </div>
          </li>
        ))}
        {rows && rows.length === 0 && <li className="empty">{emptyText}</li>}
        {!rows && <li className="empty">불러오는 중…</li>}
      </ul>
    </div>
  );
}
