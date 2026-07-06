import { useEffect, useRef, useState } from "react";
import { loadKakao, keywordSearch, coordToAddress, type Place } from "../lib/kakao";
import { getCurrentLocation } from "../lib/toss";

// U5 ①: 키워드 검색 + 지도 중앙 고정핀 드래그로 좌표/주소 선택
export default function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number; address: string; name: string };
  onChange: (v: { lat: number; lng: number; address: string; name?: string }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);

  useEffect(() => {
    (async () => {
      const kakao = await loadKakao();
      const start = value.lat ? value : await getCurrentLocation().then((l) => ({ ...l, address: "" }));
      const map = new kakao.maps.Map(el.current, {
        center: new kakao.maps.LatLng(start.lat, start.lng),
        level: 3,
      });
      mapRef.current = map;
      kakao.maps.event.addListener(map, "idle", async () => {
        const c = map.getCenter();
        const addr = await coordToAddress(c.getLat(), c.getLng());
        onChange({ lat: c.getLat(), lng: c.getLng(), address: addr });
      });
    })();
  }, []);

  async function search() {
    if (!q.trim()) return;
    setResults(await keywordSearch(q));
  }

  function choose(p: Place) {
    const kakao = (window as any).kakao;
    mapRef.current?.setCenter(new kakao.maps.LatLng(p.lat, p.lng));
    onChange({ lat: p.lat, lng: p.lng, address: p.address, name: p.name });
    setResults([]);
    setQ(p.name);
  }

  return (
    <div className="loc-picker">
      <div className="search-row">
        <input placeholder="장소·주소 검색" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()} />
        <button onClick={search}>검색</button>
      </div>
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((p, i) => (
            <li key={i} onClick={() => choose(p)}>
              <b>{p.name}</b><span>{p.address}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="picker-map">
        <div ref={el} className="map-canvas" />
        <div className="center-pin">📍</div>
      </div>
      <p className="picked-addr">{value.address || "지도를 움직여 정확한 위치를 맞춰주세요"}</p>
    </div>
  );
}
