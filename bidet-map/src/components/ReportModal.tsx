import { useState } from "react";
import { submitReport, type ReportType } from "../lib/reports";
import { ensureLogin } from "../lib/auth";

const REASONS: { type: ReportType; label: string }[] = [
  { type: "wrong_info", label: "정보가 틀려요" },
  { type: "broken", label: "비데가 고장났어요" },
  { type: "removed", label: "철거됐거나 없어요" },
];

// U7: 신고 (객관 항목 중심). 자유 서술은 보조.
export default function ReportModal({
  restroomId,
  onDone,
  onClose,
}: {
  restroomId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<ReportType>("wrong_info");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!(await ensureLogin())) return alert("로그인 후 신고할 수 있어요.");
    setBusy(true);
    try {
      await submitReport(restroomId, type, note ? { note } : undefined);
      onDone();
    } catch (e: any) {
      alert(e.message ?? "제출에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notice-overlay" onClick={onClose}>
      <div className="notice-card" onClick={(e) => e.stopPropagation()}>
        <h4>어떤 문제가 있나요?</h4>
        <div className="report-reasons">
          {REASONS.map((r) => (
            <label key={r.type} className={type === r.type ? "on" : ""}>
              <input type="radio" name="rt" checked={type === r.type} onChange={() => setType(r.type)} />
              {r.label}
            </label>
          ))}
        </div>
        <textarea placeholder="추가 설명 (선택) — 객관적인 정보 위주로 적어주세요" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" onClick={submit} disabled={busy}>{busy ? "제출 중…" : "신고하기"}</button>
      </div>
    </div>
  );
}
