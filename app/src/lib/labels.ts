// 코드값 → 한국어 라벨 (category_settings와 동일. Phase 3에서 DB 동기화로 대체 가능)
export const PLACE_TYPE: Record<string, string> = {
  public_toilet: "공중화장실", subway: "지하철/역사", mall: "백화점/몰", cafe: "카페",
  restaurant: "음식점", hotel: "호텔", motel: "모텔", hospital: "병원",
  government: "관공서", building: "일반건물", etc: "기타",
};
export const BIDET_STATUS: Record<string, string> = {
  normal: "정상", weak_pressure: "수압 약함", broken: "고장", removed: "철거됨", need_check: "확인 필요",
};
export const ACCESS: Record<string, string> = {
  anyone: "누구나 가능", customer_only: "고객만", resident_only: "숙박객/입주자", need_check: "확인 필요",
};
export const RESTROOM_TYPE: Record<string, string> = {
  male: "남자", female: "여자", unisex: "공용", family: "가족", disabled: "장애인",
};
export const AMENITIES: Record<string, string> = {
  tissue: "휴지 있음", good_sink: "세면대 좋음", diaper_table: "기저귀 교환대",
  disabled_access: "장애인 이용 가능", emergency_bell: "비상벨",
};
export const distanceText = (m: number) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`);

export function verifiedText(iso: string | null): string {
  if (!iso) return "확인 기록 없음";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "오늘 확인";
  if (days < 30) return `${days}일 전 확인`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전 확인`;
  return "1년 이상 전 확인";
}
export const opts = (m: Record<string, string>) => Object.entries(m).map(([code, label]) => ({ code, label }));

// 이용조건 필수 표시 대상 (사유시설 단정 금지)
export const ACCESS_REQUIRED_TYPES = ["hotel", "motel", "building"];
