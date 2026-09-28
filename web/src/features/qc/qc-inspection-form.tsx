import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Plus, Trash2, RefreshCw, Camera, Maximize2, Sparkles, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QcQuestion {
  id: string;
  label: string;
  is_mandatory: boolean;
  result: 'PASS' | 'FAIL' | '';
  remark: string;
}

export interface ReworkRecord {
  round: number;
  inspected_at: string;
  questions: { id: string; label: string; result: string; remark: string }[];
  overall_remark: string;
  score: number;
  outcome: 'REWORK' | 'PASS';
}

export interface PhotoSlot {
  id: string;
  label: string;
  url?: string;
}

export interface QcInspectionFormProps {
  jobId: number;
  /** ประเภทงาน: 'Q' | 'Quick' หรือ 'R' | 'Renovate' (default: 'R') */
  jobType?: 'Q' | 'R' | 'Quick' | 'Renovate' | string;
  /** จำนวน Rework ที่ผ่านมาแล้ว (รับมาจาก job.qc_history หรือ 0) */
  previousReworkCount?: number;
  /** ประวัติ rework ที่ผ่านมา */
  reworkHistory?: ReworkRecord[];
  /** รูปภาพเริ่มต้น (เช่น job.photos) */
  initialPhotos?: any[];
  onSubmit: (data: {
    questions: QcQuestion[];
    overall_remark: string;
    score: number;
    outcome: 'PASS' | 'REWORK';
    round: number;
    photos: PhotoSlot[];
  }) => void;
  /** เรียกเมื่อผ่าน QC ต้องการส่ง STK */
  onExportSTK?: () => void;
  onCancel: () => void;
  className?: string;
}

// ─── Default 5 Photo Slots ───────────────────────────────────────────────────

const DEFAULT_QC_PHOTO_SLOTS: PhotoSlot[] = [
  { id: 'before', label: '1. ก่อนเริ่ม (Before)' },
  { id: 'progress1', label: '2. ระหว่างทำ #1' },
  { id: 'progress2', label: '3. ระหว่างทำ #2' },
  { id: 'test', label: '4. ทดสอบความปลอดภัย' },
  { id: 'after', label: '5. งานเสร็จสมบูรณ์' },
];

// Sample placeholder demo photos for QA & training
const SAMPLE_DEMO_PHOTOS: Record<string, string> = {
  before: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
  progress1: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
  progress2: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80',
  test: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
  after: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
};

// ─── Main questions ───────────────────────────────────────────────────────────

const MAIN_QUESTION_QUICK: Omit<QcQuestion, 'result' | 'remark'> = {
  id: 'q_quick_main',
  label: 'ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด',
  is_mandatory: true,
};

const MAIN_QUESTION_RENOVATE: Omit<QcQuestion, 'result' | 'remark'> = {
  id: 'q_renovate_main',
  label: 'ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด และงานมีความเรียบร้อยตาม BOQ',
  is_mandatory: true,
};

const MAX_CUSTOM_QUESTIONS = 4;

function nowThai(): string {
  return new Date().toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const QcInspectionForm = React.forwardRef<HTMLDivElement, QcInspectionFormProps>(
  (
    {
      jobId,
      jobType = 'R',
      previousReworkCount = 0,
      reworkHistory = [],
      initialPhotos = [],
      onSubmit,
      onExportSTK,
      onCancel,
      className,
    },
    ref
  ) => {
    const isQuick = String(jobType || '').toUpperCase().includes('Q');
    const currentRound = previousReworkCount + 1;

    // ─── State: Questions ──────────────────────────────────────────────────────
    const [questions, setQuestions] = React.useState<QcQuestion[]>(() => [
      {
        ...(isQuick ? MAIN_QUESTION_QUICK : MAIN_QUESTION_RENOVATE),
        result: '',
        remark: '',
      },
    ]);

    const [customQuestionLabel, setCustomQuestionLabel] = React.useState('');
    const [overallRemark, setOverallRemark] = React.useState('');
    const [reworkRemark, setReworkRemark] = React.useState('');
    const [submitted, setSubmitted] = React.useState(false);
    const [outcome, setOutcome] = React.useState<'PASS' | 'REWORK' | null>(null);
    const [finalScore, setFinalScore] = React.useState<number | null>(null);

    // ─── State: 5 Photo Slots ──────────────────────────────────────────────────
    const [photoSlots, setPhotoSlots] = React.useState<PhotoSlot[]>(() => {
      const slots = DEFAULT_QC_PHOTO_SLOTS.map((s) => ({ ...s }));
      if (Array.isArray(initialPhotos) && initialPhotos.length > 0) {
        initialPhotos.forEach((p: any, idx: number) => {
          const slotId = p.slot_id || p.tag || (slots[idx] ? slots[idx].id : null);
          const url = p.url || p.dataUrl || (typeof p === 'string' ? p : undefined);
          if (slotId) {
            const match = slots.find((s) => s.id === slotId);
            if (match && url) match.url = url;
          } else if (slots[idx] && url) {
            slots[idx].url = url;
          }
        });
      }
      return slots;
    });

    // Lightbox modal state
    const [previewPhotoUrl, setPreviewPhotoUrl] = React.useState<string | null>(null);
    const [previewPhotoTitle, setPreviewPhotoTitle] = React.useState<string>('');

    // ─── Derived calculations ──────────────────────────────────────────────────
    const totalQ = questions.length;
    const passedQ = questions.filter((q) => q.result === 'PASS').length;
    const failedQ = questions.filter((q) => q.result === 'FAIL').length;
    const unansweredQ = questions.filter((q) => q.result === '').length;
    const allAnswered = unansweredQ === 0;
    const allPassed = failedQ === 0 && allAnswered;
    const customCount = questions.filter((q) => !q.is_mandatory).length;
    const uploadedPhotosCount = photoSlots.filter((s) => !!s.url).length;

    /** Score rule: Round 1 PASS = 5.0 / Round >= 2 PASS = 1.0 (Isara Standard) */
    const computeScore = (pass: boolean) => {
      if (!pass) return 0;
      return currentRound === 1 ? 5.0 : 1.0;
    };

    // ─── Question handlers ─────────────────────────────────────────────────────
    const updateQuestion = (id: string, field: keyof QcQuestion, val: string) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, [field]: val } : q))
      );
    };

    const addCustomQuestion = () => {
      if (isQuick) return; // Quick cannot add custom questions
      const label = customQuestionLabel.trim();
      if (!label || customCount >= MAX_CUSTOM_QUESTIONS) return;
      const newQ: QcQuestion = {
        id: `q_custom_${Date.now()}`,
        label,
        is_mandatory: false,
        result: '',
        remark: '',
      };
      setQuestions((prev) => [...prev, newQ]);
      setCustomQuestionLabel('');
    };

    const removeCustomQuestion = (id: string) => {
      setQuestions((prev) => prev.filter((q) => q.id !== id || q.is_mandatory));
    };

    // ─── Photo handlers ────────────────────────────────────────────────────────
    const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setPhotoSlots((prev) =>
          prev.map((s) => (s.id === slotId ? { ...s, url: dataUrl } : s))
        );
      };
      reader.readAsDataURL(file);
    };

    const handleRemovePhoto = (slotId: string) => {
      setPhotoSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, url: undefined } : s))
      );
    };

    const handleLoadSamplePhotos = () => {
      setPhotoSlots((prev) =>
        prev.map((s) => ({
          ...s,
          url: SAMPLE_DEMO_PHOTOS[s.id] || s.url,
        }))
      );
    };

    // ─── Submit handlers ───────────────────────────────────────────────────────
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
        photos: photoSlots,
      });
    };

    const handleReworkConfirm = () => {
      onSubmit({
        questions,
        overall_remark: reworkRemark,
        score: 0,
        outcome: 'REWORK',
        round: currentRound,
        photos: photoSlots,
      });
    };

    const handleExportSTK = () => {
      if (onExportSTK) onExportSTK();
    };

    // ─── Result Screen (After Submit) ──────────────────────────────────────────
    if (submitted && outcome) {
      return (
        <div ref={ref} className={cn('space-y-5 text-black', className)}>
          {/* Outcome banner */}
          <div
            className={`rounded-xl border-2 p-5 text-center space-y-2 ${
              outcome === 'PASS'
                ? 'border-green-400 bg-green-50'
                : 'border-red-400 bg-red-50'
            }`}
          >
            <div className="text-4xl">{outcome === 'PASS' ? '✅' : '🔄'}</div>
            <h3 className="text-xl font-bold text-black">
              {outcome === 'PASS'
                ? `ผ่านการตรวจ QC (${isQuick ? 'Quick Service' : 'Renovate'}) รอบที่ ${currentRound}`
                : `ไม่ผ่านเกณฑ์ — ส่งกลับแก้ไข (Rework)`}
            </h3>
            {outcome === 'PASS' && (
              <p className="text-sm text-black font-semibold">
                คะแนนผลตรวจ: <span className="text-2xl font-bold">{finalScore?.toFixed(1)}</span> / 5.0
                {currentRound > 1 && (
                  <span className="ml-2 text-xs text-black bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded-full">
                    🔒 ล็อกคะแนนรอบแก้ไข (กฎ Isara Standard)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Photo Preview Summary */}
          <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> รูปถ่ายหน้างาน 5 รูป ({uploadedPhotosCount}/5)
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {photoSlots.map((slot) => (
                <div key={slot.id} className="flex flex-col items-center gap-1">
                  <div className="relative aspect-[4/3] w-full rounded-md border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                    {slot.url ? (
                      <img
                        src={slot.url}
                        alt={slot.label}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                        onClick={() => {
                          setPreviewPhotoUrl(slot.url || null);
                          setPreviewPhotoTitle(slot.label);
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-gray-400">ไม่มีรูป</span>
                    )}
                  </div>
                  <span className="text-[10px] text-black font-medium truncate w-full text-center" title={slot.label}>
                    {slot.label.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Questions table */}
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
                {questions.map((q) => (
                  <tr key={q.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 text-black">
                      {q.label}
                      {q.is_mandatory && (
                        <span className="ml-1 text-[10px] text-black bg-red-100 border border-red-200 px-1 rounded">
                          บังคับ
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          q.result === 'PASS'
                            ? 'bg-green-100 border-green-400 text-black'
                            : 'bg-red-100 border-red-400 text-black'
                        }`}
                      >
                        {q.result === 'PASS' ? '✓ ผ่าน' : '✗ ไม่ผ่าน'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-black text-xs">{q.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rework reason input */}
          {outcome === 'REWORK' && (
            <div className="space-y-2 border border-orange-200 bg-orange-50 rounded-lg p-4">
              <Label className="text-black font-bold">📋 บันทึกสาเหตุการส่งกลับแก้ไข (Rework Remark)</Label>
              <textarea
                value={reworkRemark}
                onChange={(e) => setReworkRemark(e.target.value)}
                placeholder="ระบุจุดที่ต้องแก้ไข เช่น: ท่อระบายน้ำรั่วซึม, งานติดตั้งไม่ได้ระดับ..."
                className="w-full border border-orange-300 rounded-md p-2 h-20 text-black bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={onCancel} className="text-black font-medium">
                  ปิด
                </Button>
                <Button
                  onClick={handleReworkConfirm}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                >
                  🔄 ยืนยันส่งกลับแก้ไข (Rework)
                </Button>
              </div>
            </div>
          )}

          {/* Pass: STK export action */}
          {outcome === 'PASS' && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-bold text-black">
                ✅ งานผ่าน QC เรียบร้อย — พร้อมส่งออกข้อมูลตัดยอดในระบบ STK (Step 6)
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onCancel} className="text-black font-medium">
                  ปิด
                </Button>
                <Button
                  onClick={handleExportSTK}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  🚀 ส่งออก STK (Step 6)
                </Button>
              </div>
            </div>
          )}

          {/* Lightbox Dialog */}
          <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
            <DialogContent className="max-w-3xl bg-white p-4 text-black">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="font-bold text-sm text-black">{previewPhotoTitle || 'รูปถ่ายตรวจสอบ'}</span>
              </div>
              {previewPhotoUrl && (
                <div className="mt-2 flex items-center justify-center">
                  <img
                    src={previewPhotoUrl}
                    alt={previewPhotoTitle}
                    className="max-h-[70vh] w-auto rounded-lg object-contain"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // ─── Main Form Screen ──────────────────────────────────────────────────────
    return (
      <div ref={ref} className={cn('space-y-4 text-black', className)}>
        {/* Header bar */}
        <div className="flex items-start justify-between pb-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-black">
                ตรวจรับรองคุณภาพ QC — ใบงาน #{jobId}
              </h2>
              {isQuick ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 border border-amber-300 text-black">
                  QUICK SERVICE (QC ONLINE)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 border border-orange-400 text-black">
                  RENOVATE PROJECT (ON-SITE QC)
                </span>
              )}
            </div>
            <p className="text-xs text-black mt-0.5">
              รอบที่ <span className="font-bold">{currentRound}</span>
              {currentRound > 1 && (
                <span className="ml-2 text-xs bg-yellow-100 border border-yellow-300 text-black px-2 py-0.5 rounded-full font-semibold">
                  ⚠️ รอบแก้ไข — คะแนนสูงสุดล็อกที่ 1.0 (กฎ Isara Standard)
                </span>
              )}
            </p>
          </div>
          <div className="text-xs text-black font-mono bg-gray-100 border border-gray-300 px-2 py-1 rounded shrink-0">
            {nowThai()}
          </div>
        </div>

        {/* 📷 5 Photo Slots (Both Quick & Renovate) */}
        <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-black flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-black" />
              รูปถ่ายตรวจสอบคุณภาพหน้างาน (5 รูป)
              <span className="text-[11px] font-normal text-gray-500">
                ({uploadedPhotosCount}/5 รูป)
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLoadSamplePhotos}
              className="text-[11px] h-7 text-black hover:bg-gray-100 flex items-center gap-1 font-semibold"
              title="โหลดรูปตัวอย่างสำหรับการสาธิตหรือทดสอบ"
            >
              <Sparkles className="w-3 h-3 text-amber-600" /> โหลดรูปตัวอย่าง 5 ภาพ
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {photoSlots.map((slot) => (
              <div key={slot.id} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-black truncate" title={slot.label}>
                  {slot.label}
                </span>
                <div className="relative aspect-[4/3] w-full rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50 overflow-hidden flex flex-col items-center justify-center transition-colors">
                  {slot.url ? (
                    <>
                      <img
                        src={slot.url}
                        alt={slot.label}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => {
                          setPreviewPhotoUrl(slot.url || null);
                          setPreviewPhotoTitle(slot.label);
                        }}
                      />
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPhotoUrl(slot.url || null);
                            setPreviewPhotoTitle(slot.label);
                          }}
                          className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center p-1"
                          title="ดูรูปใหญ่"
                        >
                          <Maximize2 className="w-3 h-3 text-white" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(slot.id)}
                          className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center p-1"
                          title="ลบรูป"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2 text-center hover:bg-blue-50/50">
                      <Camera className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-[10px] font-semibold text-black">อัปโหลดรูป</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoFileChange(e, slot.id)}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form: Questions & Remarks */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Questions list */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black block">
                {isQuick
                  ? 'แบบประเมินมาตรฐานงาน QUICK SERVICE (1 ข้อคำถาม) (ประเมิน 1 ยิงจบ | รอบแรกผ่านได้ 5.0 คะแนน, หากเป็นรอบแก้ไขครั้งที่ 2, 3, 4 จะได้ 1.0 คะแนนอัตโนมัติ)'
                  : `รายการประเมิน Checklist (${questions.length} ข้อ):`}
              </span>
              {isQuick && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-black font-bold shrink-0">
                  1 ข้อคำถาม QC
                </span>
              )}
            </div>
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`rounded-lg border p-3 space-y-2.5 transition-colors ${
                  q.result === 'PASS'
                    ? 'border-green-300 bg-green-50/70'
                    : q.result === 'FAIL'
                    ? 'border-red-300 bg-red-50/70'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 text-black text-xs font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-black block">{q.label}</span>
                      {isQuick && q.id === 'q_quick_main' && (
                        <span className="text-xs text-black/70 block mt-0.5">
                          ข้อคำถามประเมินรับรองมาตรฐาน Quick Service (ตอบ 1 ข้อจบกระบวนการ)
                        </span>
                      )}
                      {q.is_mandatory && (
                        <span className="text-[10px] text-black bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-full font-bold inline-block mt-1">
                          ★ คำถามหลัก (บังคับ)
                        </span>
                      )}
                    </div>
                  </div>
                  {!q.is_mandatory && !isQuick && (
                    <button
                      type="button"
                      onClick={() => removeCustomQuestion(q.id)}
                      className="text-black hover:opacity-60 shrink-0 cursor-pointer p-1"
                      title="ลบคำถามนี้"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  )}
                </div>

                {/* Radio choices */}
                <div className="flex items-center gap-5">
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

                {/* Remark input */}
                <Input
                  value={q.remark}
                  onChange={(e) => updateQuestion(q.id, 'remark', e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติมสำหรับข้อนี้ (ถ้ามี)"
                  className="h-8 text-xs text-black bg-white border-gray-300"
                />
              </div>
            ))}
          </div>

          {/* Add custom question (Only for Renovate, Strictly hidden for Quick) */}
          {!isQuick && customCount < MAX_CUSTOM_QUESTIONS && (
            <div className="border border-dashed border-gray-300 rounded-lg p-2.5 space-y-1.5 bg-gray-50">
              <Label className="text-black font-semibold text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                เพิ่มคำถามหน้างาน ({customCount}/{MAX_CUSTOM_QUESTIONS} — สูงสุด {MAX_CUSTOM_QUESTIONS} ข้อเพิ่มเติม)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={customQuestionLabel}
                  onChange={(e) => setCustomQuestionLabel(e.target.value)}
                  placeholder="พิมพ์คำถามที่ต้องการตรวจเพิ่ม เช่น: การเก็บงานสี, การตรวจเช็คระดับท่อ..."
                  className="flex-1 h-8 text-xs text-black bg-white border-gray-300"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomQuestion();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCustomQuestion}
                  disabled={!customQuestionLabel.trim() || customCount >= MAX_CUSTOM_QUESTIONS}
                  className="text-black font-semibold text-xs h-8 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่ม
                </Button>
              </div>
            </div>
          )}
          {!isQuick && customCount >= MAX_CUSTOM_QUESTIONS && (
            <p className="text-xs text-black bg-yellow-50 border border-yellow-200 rounded px-2.5 py-1">
              ⚠️ ครบ {MAX_CUSTOM_QUESTIONS} คำถามเพิ่มเติมแล้ว (รวมคำถามหลักเป็น 5 ข้อ)
            </p>
          )}

          {/* Overall remark */}
          <div className="space-y-1">
            <Label className="text-black font-semibold text-xs">หมายเหตุภาพรวม (Overall Remark)</Label>
            <textarea
              value={overallRemark}
              onChange={(e) => setOverallRemark(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 h-16 text-xs text-black bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="สรุปภาพรวมการตรวจ QC..."
            />
          </div>

          {/* Summary action bar */}
          <div
            className={`rounded-lg px-3.5 py-2.5 border text-xs flex items-center justify-between flex-wrap gap-2 ${
              allPassed && allAnswered
                ? 'bg-green-50 border-green-300'
                : failedQ > 0
                ? 'bg-red-50 border-red-300'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 text-black font-semibold flex-wrap">
              <span>ผลรวม: <span className="font-bold">{passedQ}</span>/{totalQ} ผ่าน</span>
              {failedQ > 0 && (
                <span className="text-black bg-red-100 border border-red-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  {failedQ} ไม่ผ่าน → Rework
                </span>
              )}
              {unansweredQ > 0 && (
                <span className="text-black text-[11px]">ยังไม่ตอบ {unansweredQ} ข้อ</span>
              )}
              {allPassed && allAnswered && (
                <span className="text-black font-bold">
                  คะแนน: {currentRound === 1 ? '5.0' : '1.0 (รอบแก้ไข)'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onCancel} className="text-black font-medium h-8">
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!allAnswered}
                className={`font-bold text-white h-8 ${
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

        {/* Rework history */}
        {reworkHistory.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-2.5 space-y-1.5">
            <h4 className="font-bold text-black text-xs flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-black" /> ประวัติการตรวจย้อนหลัง ({reworkHistory.length} รอบ)
            </h4>
            {reworkHistory.map((r) => (
              <div key={r.round} className="text-[11px] text-black bg-gray-50 border border-gray-200 rounded p-1.5 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold">รอบที่ {r.round}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full font-bold border text-[10px] ${
                      r.outcome === 'PASS' ? 'bg-green-100 border-green-400' : 'bg-orange-100 border-orange-400'
                    }`}
                  >
                    {r.outcome === 'PASS' ? '✓ ผ่าน' : '🔄 Rework'}
                  </span>
                </div>
                <div>วันที่: {r.inspected_at} · คะแนน: {r.score.toFixed(1)}</div>
                {r.overall_remark && <div>หมายเหตุ: {r.overall_remark}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Lightbox Dialog */}
        <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
          <DialogContent className="max-w-3xl bg-white p-4 text-black">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="font-bold text-sm text-black">{previewPhotoTitle || 'รูปถ่ายตรวจสอบ'}</span>
            </div>
            {previewPhotoUrl && (
              <div className="mt-2 flex items-center justify-center">
                <img
                  src={previewPhotoUrl}
                  alt={previewPhotoTitle}
                  className="max-h-[70vh] w-auto rounded-lg object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);
QcInspectionForm.displayName = 'QcInspectionForm';

export { QcInspectionForm };
