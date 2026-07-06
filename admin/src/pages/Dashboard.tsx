import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// 운영 요약
export default function Dashboard() {
  const [c, setC] = useState({ review: 0, reports: 0, places: 0, photos: 0 });
  useEffect(() => {
    (async () => {
      const count = async (t: string, f: (q: any) => any): Promise<number> => {
        const res = await f(supabase.from(t).select("*", { count: "exact", head: true }));
        return res.count ?? 0;
      };
      setC({
        review: await count("restrooms", (q: any) => q.eq("status", "pending_review")),
        reports: await count("place_reports", (q: any) => q.eq("status", "open")),
        places: await count("buildings", (q: any) => q.eq("status", "active")),
        photos: await count("restroom_photos", (q: any) => q.eq("status", "pending")),
      });
    })();
  }, []);

  const Card = ({ n, label }: { n: number; label: string }) => (
    <div className="stat-card"><div className="n">{n}</div><div className="l">{label}</div></div>
  );
  return (
    <div className="cards">
      <Card n={c.reports} label="신고 대기" />
      <Card n={c.photos} label="사진 검수 대기" />
      <Card n={c.review} label="신고로 숨김" />
      <Card n={c.places} label="노출중 장소" />
    </div>
  );
}
