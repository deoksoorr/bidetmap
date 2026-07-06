import type { NearbyBuilding } from "../lib/types";
import { PLACE_TYPE, BIDET_STATUS, distanceText } from "../lib/labels";
import AdBanner from "./AdBanner";

export default function BottomList({
  items,
  onSelect,
}: {
  items: NearbyBuilding[];
  onSelect: (b: NearbyBuilding) => void;
}) {
  return (
    <div className="bottom-sheet">
      <div className="grabber" />
      <AdBanner slot="banner_main" />
      <div className="sheet-head">이 지역 {items.length}곳</div>
      <ul className="place-list">
        {items.map((b) => (
          <li key={b.id} onClick={() => onSelect(b)}>
            <div className="row1">
              <span className="pname">{b.name}</span>
              <span className="dist">{distanceText(b.distance_m)}</span>
            </div>
            <div className="row2">
              <span className={`badge s-${b.best_bidet_status ?? "need_check"}`}>
                {BIDET_STATUS[b.best_bidet_status ?? "need_check"]}
              </span>
              <span className="ptype">{PLACE_TYPE[b.place_type] ?? b.place_type}</span>
              {b.has_photo && <span className="photo">📷</span>}
              {b.is_24h && <span className="h24">24h</span>}
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="empty">이 지역에 등록된 장소가 없어요. 첫 등록을 해보세요!</li>}
      </ul>
    </div>
  );
}
