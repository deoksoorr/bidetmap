import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadKakao, pinImage } from "../lib/kakao";
import { getCurrentLocation, type LatLng } from "../lib/toss";
import { fetchNearby } from "../lib/api";
import type { NearbyBuilding, NearbyFilters } from "../lib/types";
import BottomList from "../components/BottomList";
import FilterSheet from "../components/FilterSheet";

// 두 좌표 사이 거리(m)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function MapMain() {
  const nav = useNavigate();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const kakaoRef = useRef<any>(null);
  const locRef = useRef<LatLng>({ lat: 37.5665, lng: 126.978 });
  const [list, setList] = useState<NearbyBuilding[]>([]);
  const [filters, setFilters] = useState<NearbyFilters>({});
  const filtersRef = useRef<NearbyFilters>({}); // idle 리스너가 항상 최신 필터를 읽도록(클로저 stale 방지)
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needLoc, setNeedLoc] = useState(false);

  const activeCount = Object.values(filters).filter((v) => v != null && (!Array.isArray(v) || v.length)).length;

  // 위치 권한 상태 확인 → 미허용이면 허용 배너 노출
  useEffect(() => {
    const perms = (navigator as any).permissions;
    if (!perms?.query) return;
    perms.query({ name: "geolocation" })
      .then((p: any) => {
        setNeedLoc(p.state !== "granted");
        p.onchange = () => setNeedLoc(p.state !== "granted");
      })
      .catch(() => {});
  }, []);

  // "허용" 클릭 → 브라우저 권한 팝업 유도 후 실제 위치로 이동
  function allowLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        locRef.current = loc;
        setNeedLoc(false);
        mapRef.current?.panTo(new kakaoRef.current.maps.LatLng(loc.lat, loc.lng));
        await refresh();
      },
      () => {
        setError("위치 권한이 거부됐어요. 브라우저 주소창의 위치 아이콘에서 허용해 주세요.");
        setTimeout(() => setError(null), 3000);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const [kakao, loc] = await Promise.all([loadKakao(), getCurrentLocation()]);
        kakaoRef.current = kakao;
        locRef.current = loc;
        const map = new kakao.maps.Map(mapEl.current, { center: new kakao.maps.LatLng(loc.lat, loc.lng), level: 4 });
        mapRef.current = map;
        clusterRef.current = new kakao.maps.MarkerClusterer({ map, averageCenter: true, minLevel: 6 });
        new kakao.maps.Marker({ map, position: new kakao.maps.LatLng(loc.lat, loc.lng), zIndex: 10 });
        // 지도를 움직이면 그 중심 기준으로 재검색(구글맵식 "이 지역 검색")
        kakao.maps.event.addListener(map, "idle", () => {
          const c = map.getCenter();
          locRef.current = { lat: c.getLat(), lng: c.getLng() };
          refresh().catch(() => {});
        });
        await refresh();
      } catch {
        setError("지도를 불러오지 못했어요. 위치 권한과 네트워크를 확인해 주세요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 현재 지도에 보이는 영역(중심→모서리)을 반경으로 → 뷰포트 전체 검색 (0.5~50km)
  function viewRadius(): number {
    const map = mapRef.current;
    if (!map?.getBounds) return 1500;
    const b = map.getBounds();
    const c = map.getCenter();
    const ne = b.getNorthEast();
    const r = haversine(c.getLat(), c.getLng(), ne.getLat(), ne.getLng());
    return Math.min(Math.max(Math.ceil(r), 500), 50000);
  }

  async function refresh(f?: NearbyFilters) {
    const active = f ?? filtersRef.current; // 인자 없으면(idle 등) 최신 필터 사용
    const kakao = kakaoRef.current;
    const rows = await fetchNearby(locRef.current, viewRadius(), active);
    setList(rows);
    clusterRef.current.clear();
    const markers = rows.map((b) => {
      const m = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(b.lat, b.lng),
        image: pinImage(kakao, b.best_bidet_status ?? "need_check"),
        title: b.name,
      });
      kakao.maps.event.addListener(m, "click", () => nav(`/place/${b.id}`));
      return m;
    });
    clusterRef.current.addMarkers(markers);
  }

  async function recenter() {
    try {
      const loc = await getCurrentLocation();
      locRef.current = loc;
      mapRef.current?.panTo(new kakaoRef.current.maps.LatLng(loc.lat, loc.lng));
      await refresh();
    } catch {
      setError("주변 정보를 새로고침하지 못했어요.");
      setTimeout(() => setError(null), 2000);
    }
  }

  function applyFilters(f: NearbyFilters) {
    filtersRef.current = f;
    setFilters(f);
    setShowFilter(false);
    refresh(f).catch(() => {
      setError("필터를 적용하지 못했어요.");
      setTimeout(() => setError(null), 2000);
    });
  }

  return (
    <div className="map-screen">
      <div ref={mapEl} className="map-canvas" />
      <button className="filter-bar" onClick={() => setShowFilter(true)}>
        ⚙ 필터{activeCount > 0 && <span className="fcount">{activeCount}</span>}
      </button>
      <div className="top-nav">
        <button onClick={() => nav("/favorites")} aria-label="즐겨찾기">★</button>
        <button onClick={() => nav("/recent")} aria-label="최근 본 장소">🕘</button>
      </div>
      {needLoc && (
        <div className="loc-prompt">
          <span>📍 현재 위치를 허용하면 주변을 정확히 찾을 수 있어요</span>
          <button onClick={allowLocation}>허용</button>
        </div>
      )}
      {loading && <div className="map-toast">주변 비데 화장실을 찾는 중…</div>}
      {error && <div className="map-toast error">{error}</div>}
      <button className="fab locate" onClick={recenter} aria-label="내 위치로 이동" title="내 위치로 이동">◎</button>
      <button className="fab add" onClick={() => nav("/register")} aria-label="장소 등록" title="비데 화장실 등록">＋</button>
      <BottomList items={list} onSelect={(b) => nav(`/place/${b.id}`)} />
      {showFilter && <FilterSheet initial={filters} onApply={applyFilters} onClose={() => setShowFilter(false)} />}
    </div>
  );
}
