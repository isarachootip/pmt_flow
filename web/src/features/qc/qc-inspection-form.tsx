import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QcQuestion {
  id: string;
  label: string;
  is_mandatory: boolean;
  result: 'PASS' | 'FAIL' | '';
  remark: string;
}

interface ReworkRecord {
  round: number;
  inspected_at: string;
  questions: { id: string; label: string; result: string; remark: string }[];
  overall_remark: string;
  score: number;
  outcome: 'REWORK' | 'PASS';
}

interface QcInspectionFormProps {
  jobId: number;
  /** จำนวน Rework ที่ผ่านมาแล้ว (รับมาจาก job.qc_history หรือ 0) */
  previousReworkCount?: number;
  /** ประวัติ rework ที่ผ่านมา */
  reworkHistory?: ReworkRecord[];
  onSubmit: (data: {
    questions: QcQuestion[];
    overall_remark: string;
    score: number;
    outcome: 'PASS' | 'REWORK';
    round: number;
  }) => void;
  /** เรียกเมื่อผ่าน QC ต้องการส่ง STK */
  onExportSTK?: () => void;
  onCancel: () => void;
  className?: string;
}

// ─── Main mandatory question ──────────────────────────────────────────────────

const MAIN_QUESTION: Omit<QcQuestion, 'result' | 'remark'> = {
  id: 'q_main',
  label: 'ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด และงานมีความเรียบร้อยตาม BOQ',
  is_mandatory: true,
};

const MAX_CUSTOM_QUESTIONS = 4;

// ─── Helper ───────────────────────────────────────────────────────────────────

function nowThai(): string {
  return new Date().toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const QcInspectionForm = React.forwardRef<HTMLDivElement, QcInspectionFormProps>(
  ({ jobId, previousReworkCount = 0, reworkHistory = [], onSubmit, onExportSTK, onCancel, className }, ref) => {

    const currentRound = previousReworkCount + 1; // เช่น รอบที่ 1, 2, 3 …

    // ─── State ─────────────────────────────────────────────────────────────────

    const [questions, setQuestions] = React.useState<QcQuestion[]>([
      { ...MAIN_QUESTION, result: '', remark: '' },
    ]);

    const [customQuestionLabel, setCustomQuestionLabel] = React.useState('');
    const [overallRemark, setOverallRemark] = React.useState('');
    const [reworkRemark, setReworkRemark] = React.useState('');
    const [submitted, setSubmitted] = React.useState(false);
    const [outcome, setOutcome] = React.useState<'PASS' | 'REWORK' | null>(null);
    const [finalScore, setFinalScore] = React.useState<number | null>(null);

    // ─── Derived ───────────────────────────────────────────────────────────────

    const totalQ = questions.length;
    const passedQ = questions.filter(q => q.result === 'PASS').length;
    const failedQ = questions.filter(q => q.result === 'FAIL').length;
    const unansweredQ = questions.filter(q => q.result === '').length;
    const allAnswered = unansweredQ === 0;
    const allPassed = failedQ === 0 && allAnswered;
    const customCount = questions.filter(q => !q.is_mandatory).length;

    /** คะแนน: รอบ 1 ผ่าน → 5.0 / รอบ ≥ 2 ผ่าน → lock 1.0 (กฎเหล็ก Isara Standard) */
    const computeScore = (pass: boolean) => {
      if (!pass) return 0;
      return currentRound === 1 ? 5.0 : 1.0;
    };

    // ─── Question handlers ─────────────────────────────────────────────────────

    const updateQuestion = (id: string, field: keyof QcQuestion, val: string) => {
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: val } : q));
    };

    const addCustomQuestion = () => {
      const label = customQuestionLabel.trim();
      if (!label || customCount >= MAX_CUSTOM_QUESTIONS) return;
      const newQ: QcQuestion = {
        id: `q_custom_${Date.now()}`,
        label,
        is_mandatory: false,
        result: '',
        remark: '',
      };
      setQuestions(prev => [...prev, newQ]);
      setCustomQuestionLabel('');
    };

    const removeCustomQuestion = (id: string) => {
      setQuestions(prev => prev.filter(q => q.id !== id || q.is_mandatory));
    };

    // ─── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!allAnswered) return;

      const result: 'PASS' | 'REWORK' = allPassed ? 'PASS' : 'REWORK';
      const score = computeScore(allPassed);

      setOutcome(result);
      setFinalScore(score);
      setSubmitted(true);

      onSubmit({
        questions,
        overall_remark: overallRemark,
        score,
        outcome: result,
        round: currentRound,
      });
    };

    // ─── Rework confirm ────────────────────────────────────────────────────────

    const handleReworkConfirm = () => {
      onSubmit({
        questions,
        overall_remark: reworkRemark,
        score: 0,
        outcome: 'REWORK',
        round: currentRound,
      });
    };

    // ─── Post-pass STK export ──────────────────────────────────────────────────

    const handleExportSTK = () => {
      if (onExportSTK) onExportSTK();
    };

    // ─── Result screen (after submit) ──────────────────────────────────────────

    if (submitted && outcome) {
      return (
        <div ref={ref} className={cn('space-y-5 text-black', className)}>
          {/* Outcome banner */}
          <div className={`rounded-xl border-2 p-5 text-center space-y-2 ${
            outcome === 'PASS'
              ? 'border-green-400 bg-green-50'
              : 'border-red-400 bg-red-50'
          }`}>
            <div className="text-4xl">{outcome === 'PASS' ? '✅' : '🔄'}</div>
            <h3 className={`text-xl font-bold ${outcome === 'PASS' ? 'text-black' : 'text-black'}`}>
              {outcome === 'PASS'
                ? `ผ่านการตรวจ QC รอบที่ ${currentRound}`
                : `ไม่ผ่าน — ส่งกลับแก้ไข (Rework)`}
            </h3>
            {outcome === 'PASS' && (
              <p className="text-sm text-black font-semibold">
                คะแนน: <span className="text-2xl font-bold">{finalScore?.toFixed(1)}</span> / 5.0
                {currentRound > 1 && (
                  <span className="ml-2 text-xs text-black bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded-full">
                    🔒 ล็อกคะแนนรอบแก้ไข (กฎ Isara Standard)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Summary table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-black">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-bold text-black">คำถาม</th>
                  <th className="text-center px-3 py-2 font-bold text-black w-24">ผล</th>
                  <th className="text-left px-3 py-2 font-bold text-black">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-black">
                      {q.label}
                      {q.is_mandatory && <span className="ml-1 text-[10px] text-black bg-red-100 border border-red-200 px-1 rounded">บังคับ</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        q.result === 'PASS'
                          ? 'bg-green-100 border-green-400 text-black'
                          : 'bg-red-100 border-red-400 text-black'
                      }`}>
                        {q.result === 'PASS' ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-black text-xs">{q.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rework reason input (if rework) */}
          {outcome === 'REWORK' && (
            <div className="space-y-2 border border-orange-200 bg-orange-50 rounded-lg p-4">
              <Label className="text-black font-bold">📋 บันทึกสาเหตุการส่งกลับแก้ไข (Rework Remark)</Label>
              <textarea
                value={reworkRemark}
                onChange={e => setReworkRemark(e.target.value)}
                placeholder="ระบุรายละเอียดงานที่ต้องแก้ไข เช่น: งานรั่วซึม ท่อไม่แน่น ต้องแก้ภายใน 3 วัน..."
                className="w-full border border-orange-300 rounded-md p-2 h-24 text-black bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={onCancel} className="text-black font-medium">ปิด</Button>
                <Button
                  onClick={handleReworkConfirm}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  🔄 ยืนยันส่งกลับแก้ไข (Rework)
                </Button>
              </div>
            </div>
          )}

          {/* Pass: STK export button */}
          {outcome === 'PASS' && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-bold text-black">✅ งานผ่าน QC แล้ว — ดำเนินการต่อ Step 6</p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onCancel} className="text-black font-medium">ปิด</Button>
                <Button
                  onClick={handleExportSTK}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  🚀 ส่งออก STK (Step 6)
                </Button>
              </div>
            </div>
          )}

          {/* Previous rework history */}
          {reworkHistory.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <h4 className="font-bold text-black text-sm flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-black" /> ประวัติการตรวจย้อนหลัง ({reworkHistory.length} รอบ)
              </h4>
              {reworkHistory.map(r => (
                <div key={r.round} className="text-xs text-black bg-gray-50 border border-gray-200 rounded p-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">รอบที่ {r.round}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                      r.outcome === 'PASS' ? 'bg-green-100 border-green-400' : 'bg-orange-100 border-orange-400'
                    }`}>
                      {r.outcome === 'PASS' ? '✓ ผ่าน' : '🔄 Rework'}
                    </span>
                  </div>
                  <div>วันที่: {r.inspected_at} · คะแนน: {r.score.toFixed(1)}</div>
                  {r.overall_remark && <div>หมายเหตุ: {r.overall_remark}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ─── Form screen ───────────────────────────────────────────────────────────

    return (
      <div ref={ref} className={cn('space-y-5 text-black', className)}>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-black">
              ตรวจรับรองคุณภาพ QC — ใบงาน #{jobId}
            </h2>
            <p className="text-xs text-black mt-0.5">
              รอบที่ <span className="font-bold">{currentRound}</span>
              {currentRound > 1 && (
                <span className="ml-2 text-xs bg-yellow-100 border border-yellow-300 text-black px-2 py-0.5 rounded-full font-semibold">
                  ⚠️ รอบแก้ไข — คะแนนสูงสุดไม่เกิน 1.0 (กฎ Isara Standard)
                </span>
              )}
            </p>
          </div>
          <div className="text-xs text-black font-mono bg-gray-100 border border-gray-300 px-2 py-1 rounded">
            {nowThai()}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Questions list */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`rounded-lg border p-4 space-y-3 ${
                  q.result === 'PASS'
                    ? 'border-green-300 bg-green-50'
                    : q.result === 'FAIL'
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-gray-200 text-black text-xs font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-black block">{q.label}</span>
                      {q.is_mandatory && (
                        <span className="text-[10px] text-black bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">
                          ★ คำถามหลัก (บังคับ)
                        </span>
                      )}
                    </div>
                  </div>
                  {!q.is_mandatory && (
                    <button
                      type="button"
                      onClick={() => removeCustomQuestion(q.id)}
                      className="text-black hover:opacity-60 shrink-0 cursor-pointer p-1"
                      title="ลบคำถามนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Pass / Fail radio */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`result_${q.id}`}
                      value="PASS"
                      checked={q.result === 'PASS'}
                      onChange={() => updateQuestion(q.id, 'result', 'PASS')}
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-sm font-bold text-black">✓ ผ่าน (PASS)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`result_${q.id}`}
                      value="FAIL"
                      checked={q.result === 'FAIL'}
                      onChange={() => updateQuestion(q.id, 'result', 'FAIL')}
                      className="w-4 h-4 accent-red-600"
                    />
                    <span className="text-sm font-bold text-black">✗ ไม่ผ่าน (FAIL)</span>
                  </label>
                </div>

                {/* Remark input (always visible for context) */}
                <Input
                  value={q.remark}
                  onChange={e => updateQuestion(q.id, 'remark', e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  className="h-9 text-sm text-black bg-white border-gray-300"
                />
              </div>
            ))}
          </div>

          {/* Add custom question */}
          {customCount < MAX_CUSTOM_QUESTIONS && (
            <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2 bg-gray-50">
              <Label className="text-black font-semibold text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                เพิ่มคำถาม ({customCount}/{MAX_CUSTOM_QUESTIONS} — สูงสุด {MAX_CUSTOM_QUESTIONS} ข้อเพิ่มเติม)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={customQuestionLabel}
                  onChange={e => setCustomQuestionLabel(e.target.value)}
                  placeholder="พิมพ์คำถามที่ต้องการประเมินเพิ่มเติม เช่น: การติดตั้ง CCTV ตรงตำแหน่ง..."
                  className="flex-1 h-9 text-sm text-black bg-white border-gray-300"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomQuestion(); } }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCustomQuestion}
                  disabled={!customQuestionLabel.trim() || customCount >= MAX_CUSTOM_QUESTIONS}
                  className="text-black font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-1" /> เพิ่ม
                </Button>
              </div>
            </div>
          )}
          {customCount >= MAX_CUSTOM_QUESTIONS && (
            <p className="text-xs text-black bg-yellow-50 border border-yellow-200 rounded px-3 py-1.5">
              ⚠️ ครบ {MAX_CUSTOM_QUESTIONS} คำถามเพิ่มเติมแล้ว (ไม่สามารถเพิ่มได้อีก)
            </p>
          )}

          {/* Overall remark */}
          <div className="space-y-1.5">
            <Label className="text-black font-semibold text-sm">หมายเหตุภาพรวม (Overall Remark)</Label>
            <textarea
              value={overallRemark}
              onChange={e => setOverallRemark(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 h-20 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="สรุปภาพรวมการตรวจสอบ..."
            />
          </div>

          {/* Summary bar */}
          <div className={`rounded-lg px-4 py-3 border text-sm flex items-center justify-between ${
            allPassed && allAnswered
              ? 'bg-green-50 border-green-300'
              : failedQ > 0
              ? 'bg-red-50 border-red-300'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3 text-black font-semibold">
              <span>ผลรวม: <span className="font-bold">{passedQ}</span>/{totalQ} ผ่าน</span>
              {failedQ > 0 && (
                <span className="text-black bg-red-100 border border-red-300 px-2 py-0.5 rounded-full text-xs font-bold">
                  {failedQ} ไม่ผ่าน → Rework
                </span>
              )}
              {unansweredQ > 0 && (
                <span className="text-xs text-black">ยังไม่ตอบ {unansweredQ} ข้อ</span>
              )}
              {allPassed && allAnswered && (
                <span className="text-black text-xs font-bold">
                  คะแนน: {currentRound === 1 ? '5.0' : '1.0 (รอบแก้ไข)'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onCancel} className="text-black font-medium">
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={!allAnswered}
                className={`font-bold text-white ${
                  allPassed
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {!allAnswered
                  ? `กรุณาตอบให้ครบ (เหลือ ${unansweredQ} ข้อ)`
                  : allPassed
                  ? '✅ ยืนยันผ่าน QC'
                  : '🔄 ยืนยันส่ง Rework'}
              </Button>
            </div>
          </div>

        </form>

        {/* Rework history (if any previous rounds) */}
        {reworkHistory.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <h4 className="font-bold text-black text-sm flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-black" /> ประวัติการตรวจย้อนหลัง ({reworkHistory.length} รอบ)
            </h4>
            {reworkHistory.map(r => (
              <div key={r.round} className="text-xs text-black bg-gray-50 border border-gray-200 rounded p-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold">รอบที่ {r.round}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                    r.outcome === 'PASS' ? 'bg-green-100 border-green-400' : 'bg-orange-100 border-orange-400'
                  }`}>
                    {r.outcome === 'PASS' ? '✓ ผ่าน' : '🔄 Rework'}
                  </span>
                </div>
                <div>วันที่: {r.inspected_at} · คะแนน: {r.score.toFixed(1)}</div>
                {r.overall_remark && <div>หมายเหตุ: {r.overall_remark}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
QcInspectionForm.displayName = 'QcInspectionForm';

export { QcInspectionForm };
