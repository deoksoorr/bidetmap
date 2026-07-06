export const PLACE_TYPE: Record<string, string> = {
  public_toilet: "공중화장실", subway: "지하철/역사", mall: "백화점/몰", cafe: "카페",
  restaurant: "음식점", hotel: "호텔", motel: "모텔", hospital: "병원",
  government: "관공서", building: "일반건물", etc: "기타",
};
export const ACCESS: Record<string, string> = { anyone: "누구나 가능", customer_only: "고객만", resident_only: "숙박객/입주자", need_check: "확인 필요" };
export const RESTROOM_TYPE: Record<string, string> = { male: "남자", female: "여자", unisex: "공용", family: "가족", disabled: "장애인" };
export const BIDET_STATUS: Record<string, string> = { normal: "정상", weak_pressure: "수압 약함", broken: "고장", removed: "철거됨", need_check: "확인 필요" };
export const STATUS: Record<string, string> = { active: "노출중", pending_review: "검수대기", hidden: "숨김", deleted: "삭제됨" };
export const REPORT_TYPE: Record<string, string> = {
  helpful: "도움됐어요", recent_check: "최근확인", wrong_info: "정보틀림", broken: "고장", removed: "철거/없음",
};
export const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ko-KR") : "-");
