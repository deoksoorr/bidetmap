// 카카오맵 JS SDK 동적 로더 + 헬퍼
let loaded: Promise<any> | null = null;

export function loadKakao(): Promise<any> {
  if (loaded) return loaded;
  loaded = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.kakao?.maps) return resolve(w.kakao);
    const s = document.createElement("script");
    const key = import.meta.env.VITE_KAKAO_JS_KEY;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    // 도메인 미등록/네트워크 실패 시 무한 대기 방지 (10초 타임아웃). 실패 시 캐시 초기화로 재시도 허용.
    const fail = (msg: string) => { loaded = null; reject(new Error(msg)); };
    const timer = setTimeout(() => fail("kakao_load_timeout"), 10000);
    s.onload = () => w.kakao.maps.load(() => { clearTimeout(timer); resolve(w.kakao); });
    s.onerror = () => { clearTimeout(timer); fail("kakao_load_error"); };
    document.head.appendChild(s);
  });
  return loaded;
}

const STATUS_COLOR: Record<string, string> = {
  normal: "#12B886",
  weak_pressure: "#FAB005",
  broken: "#FA5252",
  removed: "#868E96",
  need_check: "#4C6EF5",
};

export type Place = { name: string; address: string; lat: number; lng: number };

// 키워드로 장소 검색 (등록 시 건물 찾기)
export async function keywordSearch(query: string): Promise<Place[]> {
  const kakao = await loadKakao();
  return new Promise((resolve) => {
    new kakao.maps.services.Places().keywordSearch(query, (data: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) return resolve([]);
      resolve(data.map((d) => ({ name: d.place_name, address: d.road_address_name || d.address_name, lat: +d.y, lng: +d.x })));
    });
  });
}

// 주소 → 좌표
export async function geocodeAddress(address: string): Promise<Place | null> {
  const kakao = await loadKakao();
  return new Promise((resolve) => {
    new kakao.maps.services.Geocoder().addressSearch(address, (data: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !data[0]) return resolve(null);
      const d = data[0];
      resolve({ name: address, address: d.address_name, lat: +d.y, lng: +d.x });
    });
  });
}

// 좌표 → 주소 (핀 드래그 후)
export async function coordToAddress(lat: number, lng: number): Promise<string> {
  const kakao = await loadKakao();
  return new Promise((resolve) => {
    new kakao.maps.services.Geocoder().coord2Address(lng, lat, (data: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !data[0]) return resolve("");
      resolve(data[0].road_address?.address_name || data[0].address?.address_name || "");
    });
  });
}

// 상태별 색상 핀 이미지 (SVG data URI)
export function pinImage(kakao: any, status: string) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.need_check;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='40'><path d='M15 0C6.7 0 0 6.7 0 15c0 10 15 25 15 25s15-15 15-25C30 6.7 23.3 0 15 0z' fill='${color}'/><circle cx='15' cy='15' r='6' fill='#fff'/></svg>`;
  return new kakao.maps.MarkerImage(
    "data:image/svg+xml;base64," + btoa(svg),
    new kakao.maps.Size(30, 40),
    { offset: new kakao.maps.Point(15, 40) },
  );
}
