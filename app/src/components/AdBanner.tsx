import { useEffect, useState } from "react";
import { getAdSetting } from "../lib/settings";

// 설정(monetization_settings) 기반 광고 슬롯. 실제 앱인토스 광고 SDK 유닛 연동 지점.
export default function AdBanner({ slot }: { slot: string }) {
  const [cfg, setCfg] = useState<any | null>(null);

  useEffect(() => {
    getAdSetting(slot).then((s) => setCfg(s?.enabled ? s.config : null)).catch(() => {});
  }, [slot]);

  if (!cfg) return null; // 비활성 시 렌더 안 함
  // TODO(광고 연동): @apps-in-toss 광고 SDK의 배너/전면 유닛을 cfg.adUnitId로 표시
  return <div className="ad-banner">광고</div>;
}
