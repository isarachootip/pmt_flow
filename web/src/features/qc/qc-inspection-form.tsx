import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Camera, 
  Maximize2, 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  FileCheck2, 
  RotateCcw,
  Send,
  Clock,
  ExternalLink
} from 'lucide-react';
import { formatDateTimeDMY, formatDMY, format24HourTimeBadge } from '@/lib/date';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QcQuestion {
  id: string;
  label: string;
  subtitle?: string;
  is_mandatory: boolean;
  result: 'PASS' | 'FAIL' | '';
  remark: string;
}

export interface ReworkRecord {
  round: number;
  inspected_at: string;
  questions?: { id: string; label: string; result: string; remark: string }[];
  overall_remark?: string;
  remarks?: string;
  score: number;
  outcome?: 'REWORK' | 'PASS' | 'FAIL';
  result?: string;
  inspector?: string;
}

export interface PhotoSlot {
  id: string;
  label: string;
  url?: string;
}

export interface QcInspectionFormProps {
  jobId: number | string;
  jobNo?: string;
  /** ประเภทงาน: 'Q' | 'Quick' หรือ 'R' | 'Renovate' */
  jobType?: 'Q' | 'R' | 'Quick' | 'Renovate' | string;
  jobStatus?: string;
  assignedTech?: string;
  planDate?: string;
  planTime?: string;
  qcScore?: number;
  /** จำนวน Rework ที่ผ่านมาแล้ว */
  previousReworkCount?: number;
  /** ประวัติ rework ที่ผ่านมา */
  reworkHistory?: ReworkRecord[];
  /** รูปภาพเริ่มต้น (เช่น job.photos) */
  initialPhotos?: any[];
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  onSubmit: (data: {
    answers?: any[];
    items?: any[];
    questions: QcQuestion[];
    overall_remark: string;
    remarks: string;
    score: number;
    outcome: 'PASS' | 'REWORK';
    round: number;
    photos: PhotoSlot[];
  }) => void;
  /** เรียกเมื่อผ่าน QC ต้องการส่ง STK */
  onExportSTK?: () => void;
  onCancel?: () => void;
  className?: string;
  isInline?: boolean;
}

// ─── Default 5 Photo Slots & Demo Samples ──────────────────────────────────────

const DEFAULT_QC_PHOTO_SLOTS: PhotoSlot[] = [
  { id: 'before', label: '1. ก่อนเริ่ม (Before)' },
  { id: 'progress1', label: '2. ระหว่างทำ #1' },
  { id: 'progress2', label: '3. ระหว่างทำ #2' },
  { id: 'test', label: '4. ทดสอบความปลอดภัย' },
  { id: 'after', label: '5. งานเสร็จสมบูรณ์' },
];

const SAMPLE_DEMO_PHOTOS: Record<string, string> = {
  before: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
  progress1: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
  progress2: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80',
  test: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
  after: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80',
};

// ─── Question Definitions ──────────────────────────────────────────────────────

const QUICK_QUESTIONS_DEF: Omit<QcQuestion, 'result' | 'remark'>[] = [
  {
    id: 'q_quick_1',
    label: '1. ช่างทำงานได้ตามมาตรฐานการทำงานที่กำหนด',
    subtitle: 'ข้อคำถามประเมินรับรองมาตรฐาน Quick Service (ตอบ 1 ข้อจบกระบวนการ)',
    is_mandatory: true,
  }
];

const RENOVATE_QUESTIONS_DEF: Omit<QcQuestion, 'result' | 'remark'>[] = [
  {
    id: 'q_reno_1',
    label: '1. ความเรียบร้อยของงานติดตั้งและโครงสร้าง',
    subtitle: 'โครงสร้าง แผงยึด และจุดเชื่อมต่อได้ระดับ มั่นคง แข็งแรงตามแบบวิศวกรรม',
    is_mandatory: true,
  },
  {
    id: 'q_reno_2',
    label: '2. ความปลอดภัยตามมาตรฐานวิศวกรรม',
    subtitle: 'ระบบสายดิน เบรกเกอร์ วาล์วตัด และระยะห่างความปลอดภัยตามมาตรฐาน',
    is_mandatory: true,
  },
  {
    id: 'q_reno_3',
    label: '3. คุณภาพวัสดุและอุปกรณ์ตรงตาม BOQ',
    subtitle: 'รายการวัสดุและอุปกรณ์ที่ติดตั้งตรงตามสเปกและปริมาณในสัญญา BOQ',
    is_mandatory: true,
  },
  {
    id: 'q_reno_4',
    label: '4. ความสะอาดและความเรียบร้อยของพื้นที่ทำงาน',
    subtitle: 'ไม่มีรอยเปรอะเปื้อน เช็ดทำความสะอาดเรียบร้อยก่อนส่งมอบงานให้ลูกค้า',
    is_mandatory: false,
  },
  {
    id: 'q_reno_5',
    label: '5. การจัดเก็บเศษวัสดุและขยะออกจากพื้นที่ลูกค้า',
    subtitle: 'นำเศษซากวัสดุ กล่องบรรจุภัณฑ์ และขยะกลับไปทิ้งอย่างถูกต้องเรียบร้อย',
    is_mandatory: false,
  },
];

const MAX_CUSTOM_QUESTIONS = 4;

// ─── Component ────────────────────────────────────────────────────────────────

const QcInspectionForm = React.forwardRef<HTMLDivElement, QcInspectionFormProps>(
  (
    {
      jobId,
      jobNo,
      jobType = 'R',
      jobStatus = 'NEW',
      assignedTech,
      planDate,
      planTime,
      qcScore,
      previousReworkCount = 0,
      reworkHistory = [],
      initialPhotos = [],
      onPhotosChange,
      onSubmit,
      onExportSTK,
      onCancel: _onCancel,
      className,
      isInline: _isInline = true,
    },
    ref
  ) => {
    const isQuick = String(jobType || '').toUpperCase().includes('Q');
    const isAlreadyPassed = jobStatus === 'QC_PASS' || jobStatus === 'QC_PASSED' || jobStatus === 'PASSED' || jobStatus === 'COMPLETED';
    const isRework = jobStatus === 'REWORK';
    const currentRound = previousReworkCount + 1;

    // Toggle edit mode if already passed (default view-only banner with option to re-inspect)
    const [isEditMode, setIsEditMode] = React.useState(!isAlreadyPassed);

    // ─── State: Questions ──────────────────────────────────────────────────────
    const [questions, setQuestions] = React.useState<QcQuestion[]>(() => {
      const defs = isQuick ? QUICK_QUESTIONS_DEF : RENOVATE_QUESTIONS_DEF;
      return defs.map((d) => ({
        ...d,
        result: isAlreadyPassed ? 'PASS' : '',
        remark: '',
      }));
    });

    // Re-initialize questions when jobType changes
    React.useEffect(() => {
      const defs = isQuick ? QUICK_QUESTIONS_DEF : RENOVATE_QUESTIONS_DEF;
      setQuestions(defs.map((d) => ({
        ...d,
        result: isAlreadyPassed ? 'PASS' : '',
        remark: '',
      })));
    }, [isQuick, isAlreadyPassed]);

    const [customQuestionLabel, setCustomQuestionLabel] = React.useState('');
    const [overallRemark, setOverallRemark] = React.useState('');
    const [previewPhotoUrl, setPreviewPhotoUrl] = React.useState<string | null>(null);
    const [previewPhotoTitle, setPreviewPhotoTitle] = React.useState<string>('');

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

    React.useEffect(() => {
      if (Array.isArray(initialPhotos) && initialPhotos.length > 0) {
        setPhotoSlots((prev) => {
          const next = prev.map(s => ({ ...s }));
          initialPhotos.forEach((p: any, idx: number) => {
            const slotId = p.slot_id || p.tag || (next[idx] ? next[idx].id : null);
            const url = p.url || p.dataUrl || (typeof p === 'string' ? p : undefined);
            if (slotId) {
              const match = next.find((s) => s.id === slotId);
              if (match && url) match.url = url;
            } else if (next[idx] && url) {
              next[idx].url = url;
            }
          });
          return next;
        });
      }
    }, [initialPhotos]);

    // ─── Derived Calculations ──────────────────────────────────────────────────
    const totalQ = questions.length;
    const passedQ = questions.filter((q) => q.result === 'PASS').length;
    const failedQ = questions.filter((q) => q.result === 'FAIL').length;
    const unansweredQ = questions.filter((q) => q.result === '').length;
    const allAnswered = unansweredQ === 0;
    const allPassed = failedQ === 0 && allAnswered;
    const customCount = questions.filter((q) => !q.is_mandatory).length;
    const uploadedPhotosCount = photoSlots.filter((s) => !!s.url).length;

    /** Score Rule: Round 1 PASS = 5.0 / Round >= 2 PASS = 1.0 (Isara Standard) */
    const computeScore = (pass: boolean) => {
      if (!pass) return 0;
      return currentRound === 1 ? 5.0 : 1.0;
    };

    // ─── Handlers: Questions ───────────────────────────────────────────────────
    const updateQuestion = (id: string, field: keyof QcQuestion, val: string) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, [field]: val } : q))
      );
    };

    const addCustomQuestion = () => {
      if (isQuick) return;
      const label = customQuestionLabel.trim();
      if (!label || customCount >= MAX_CUSTOM_QUESTIONS) return;
      const newQ: QcQuestion = {
        id: `q_custom_${Date.now()}`,
        label: `${questions.length + 1}. ${label}`,
        subtitle: 'คำถามเพิ่มเติมเฉพาะหน้างาน',
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

    const handleResetAnswers = () => {
      setQuestions((prev) => prev.map((q) => ({ ...q, result: '', remark: '' })));
      setOverallRemark('');
    };

    // ─── Handlers: Photos ──────────────────────────────────────────────────────
    const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const updated = photoSlots.map((s) => (s.id === slotId ? { ...s, url: dataUrl } : s));
        setPhotoSlots(updated);
        if (onPhotosChange) onPhotosChange(updated);
      };
      reader.readAsDataURL(file);
    };

    const handleRemovePhoto = (slotId: string) => {
      const updated = photoSlots.map((s) => (s.id === slotId ? { ...s, url: undefined } : s));
      setPhotoSlots(updated);
      if (onPhotosChange) onPhotosChange(updated);
    };

    const handleLoadSamplePhotos = () => {
      const updated = photoSlots.map((s) => ({
        ...s,
        url: SAMPLE_DEMO_PHOTOS[s.id] || s.url,
      }));
      setPhotoSlots(updated);
      if (onPhotosChange) onPhotosChange(updated);
      toast.success('โหลดรูปถ่ายตัวอย่าง 5 ภาพเรียบร้อยแล้ว');
    };

    const handleClearAllPhotos = () => {
      const updated = photoSlots.map((s) => ({ ...s, url: undefined }));
      setPhotoSlots(updated);
      if (onPhotosChange) onPhotosChange(updated);
    };

    // ─── Submit Handlers ───────────────────────────────────────────────────────
    const handleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!allAnswered) {
        toast.warning(`กรุณาตอบคำถามให้ครบถ้วน (เหลือ ${unansweredQ} ข้อ)`);
        return;
      }

      const result: 'PASS' | 'REWORK' = allPassed ? 'PASS' : 'REWORK';
      const score = computeScore(allPassed);

      onSubmit({
        answers: questions.map((q) => ({
          item_id: q.id,
          item_name: q.label,
          label: q.label,
          result: q.result,
          is_mandatory: q.is_mandatory,
          remark: q.remark,
        })),
        items: questions.map((q) => ({
          item_id: q.id,
          item_name: q.label,
          label: q.label,
          result: q.result,
          is_mandatory: q.is_mandatory,
          remark: q.remark,
        })),
        questions,
        remarks: overallRemark,
        overall_remark: overallRemark,
        score,
        outcome: result,
        round: currentRound,
        photos: photoSlots,
      });

      if (allPassed) {
        setIsEditMode(false);
      }
    };

    // ─── Render Inline QC Workspace ────────────────────────────────────────────
    return (
      <div ref={ref} className={cn('space-y-4 text-black bg-white', className)}>
        {/* 1. Header & Meta Status Strip */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <FileCheck2 className="w-5 h-5 text-black shrink-0" />
              <h3 className="text-base font-bold text-black">
                ตรวจรับรองคุณภาพ QC {jobNo ? `— ใบงาน ${jobNo}` : `(ID: ${jobId})`}
              </h3>
              {isQuick ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 border border-amber-300 text-black">
                  ⚡ QUICK SERVICE (QC ONLINE)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 border border-blue-300 text-black">
                  🔨 RENOVATE PROJECT (ON-SITE QC)
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-gray-100 border border-gray-300 text-black">
                รอบที่ {currentRound}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isAlreadyPassed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 border border-green-300 text-black">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-700" />
                  ผ่านการตรวจ QC ({qcScore ? qcScore.toFixed(1) : '5.0'}/5.0)
                </span>
              ) : isRework ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 border border-red-300 text-black">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                  ส่งกลับแก้ไข (Rework)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-black">
                  <Clock className="w-3.5 h-3.5 text-blue-700" />
                  รอการตรวจสอบ QC หน้างาน
                </span>
              )}

              {isAlreadyPassed && onExportSTK && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onExportSTK}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-7 px-3 flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-white" />
                  <span>🚀 ส่งออก STK (Step 6)</span>
                </Button>
              )}

              {isAlreadyPassed && (
                <a
                  href="https://vwds.online/wds/pmt-qc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2.5 h-7 rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold transition-colors shadow-xs"
                  title="เปิดดูข้อมูลผลตรวจ QC ในระบบ WDS (vwds.online/wds/pmt-qc)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>ดูใน WDS ↗</span>
                </a>
              )}

              {isAlreadyPassed && !isEditMode && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  className="text-black font-semibold text-xs h-7 px-2.5"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> ตรวจประเมินใหม่
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-xs text-black">
            <div className="flex items-start gap-1.5 min-w-0">
              <span className="font-bold text-black shrink-0">ผู้ตรวจ QC:</span>
              <span className="text-black truncate font-normal">
                {assignedTech || 'QC Inspector (สถาพร ช่างตรวจงาน)'}
              </span>
            </div>
            <div className="flex items-start gap-1.5 min-w-0">
              <span className="font-bold text-black shrink-0">วันนัดตรวจ QC:</span>
              <span className="text-black font-normal">
                {planDate && formatDMY(planDate) !== '-' ? formatDMY(planDate) : 'ตามเวลานัดหมาย'}
                {planTime && (
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-mono font-semibold bg-gray-100 border border-gray-300 text-black">
                    {format24HourTimeBadge(planTime, planDate)}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-start gap-1.5 min-w-0">
              <span className="font-bold text-black shrink-0">เกณฑ์คะแนน:</span>
              <span className="text-black font-normal">
                {currentRound === 1 
                  ? 'รอบแรกผ่านได้เต็ม 5.0 คะแนน' 
                  : '🔒 รอบแก้ไข ครั้งที่ 2+ ล็อกที่ 1.0 คะแนน (Isara Standard)'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. 📷 Section: รูปถ่ายตรวจสอบคุณภาพหน้างาน (5 รูป) (PhotoSlots 5) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Camera className="w-4 h-4 text-black" />
              <h4 className="text-sm font-bold text-black">
                รูปถ่ายตรวจสอบคุณภาพหน้างาน (5 รูป)
              </h4>
              <span className="text-xs text-black font-medium">
                (อัปโหลดแล้ว {uploadedPhotosCount}/5 รูป)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLoadSamplePhotos}
                className="text-xs h-7 text-black hover:bg-gray-100 flex items-center gap-1 font-semibold"
                title="โหลดรูปตัวอย่างสำหรับการสาธิตหรือทดสอบระบบ"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>✨ โหลดรูปตัวอย่าง 5 ภาพ</span>
              </Button>
              {uploadedPhotosCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllPhotos}
                  className="text-xs h-7 text-red-600 hover:bg-red-50 flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างรูปทั้งหมด</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {photoSlots.map((slot) => (
              <div key={slot.id} className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-black truncate" title={slot.label}>
                  {slot.label}
                </span>
                <div className="relative aspect-[4/3] w-full rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-500 bg-gray-50 overflow-hidden flex flex-col items-center justify-center transition-colors">
                  {slot.url ? (
                    <>
                      <img
                        src={slot.url}
                        alt={slot.label}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-95"
                        onClick={() => {
                          setPreviewPhotoUrl(slot.url || null);
                          setPreviewPhotoTitle(slot.label);
                        }}
                      />
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPhotoUrl(slot.url || null);
                            setPreviewPhotoTitle(slot.label);
                          }}
                          className="w-6 h-6 text-white hover:text-blue-300 flex items-center justify-center cursor-pointer"
                          title="ดูรูปใหญ่"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(slot.id)}
                          className="w-6 h-6 text-white hover:text-red-400 flex items-center justify-center cursor-pointer"
                          title="ลบรูปภาพนี้"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2 text-center hover:bg-gray-100 transition-colors">
                      <Camera className="w-5 h-5 text-gray-500 mb-1" />
                      <span className="text-xs font-bold text-black">อัปโหลดรูป</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">JPG / PNG</span>
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

        {/* 3. 📋 Section: แบบประเมินและเกณฑ์มาตรฐานคุณภาพ (QC Checklist & Questions) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-2.5">
              <div>
                <h4 className="text-sm font-bold text-black">
                  {isQuick
                    ? 'แบบประเมินมาตรฐานงาน QUICK SERVICE (1 ข้อคำถาม)'
                    : 'Checklist คุณภาพงานมาตรฐาน (QC Checklist)'}
                </h4>
                <p className="text-xs text-black/80 mt-0.5">
                  {isQuick
                    ? 'ข้อคำถามประเมินรับรองมาตรฐาน Quick Service (ตอบ 1 ข้อจบกระบวนการ | รอบแรก 5.0 คะแนน, รอบแก้ไข 1.0 คะแนน)'
                    : 'ตรวจสอบรายการคุณภาพงานติดตั้ง โครงสร้าง ความปลอดภัย และความสะอาดตามสัญญา BOQ'}
                </p>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-black font-bold">
                {isQuick ? '1 ข้อคำถาม QC' : `${questions.length} ข้อคำถาม QC`}
              </span>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className={`rounded-lg border p-3.5 space-y-2.5 transition-colors ${
                    q.result === 'PASS'
                      ? 'border-green-300 bg-green-50/60'
                      : q.result === 'FAIL'
                      ? 'border-red-300 bg-red-50/60'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-gray-200 text-black text-xs font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-black">{q.label}</span>
                          {q.is_mandatory && (
                            <span className="text-[10px] text-black bg-red-100 border border-red-300 px-2 py-0.5 rounded font-bold">
                              ★ คำถามหลัก (ข้อบังคับ)
                            </span>
                          )}
                        </div>
                        {q.subtitle && (
                          <span className="text-xs text-black/80 block mt-0.5">
                            {q.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {!q.is_mandatory && !isQuick && isEditMode && (
                      <button
                        type="button"
                        onClick={() => removeCustomQuestion(q.id)}
                        className="text-black hover:opacity-70 shrink-0 cursor-pointer p-1"
                        title="ลบคำถามนี้"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  {/* Radio Choice (PASS / FAIL) */}
                  <div className="flex items-center gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name={`result_${q.id}`}
                        value="PASS"
                        checked={q.result === 'PASS'}
                        disabled={!isEditMode && isAlreadyPassed}
                        onChange={() => updateQuestion(q.id, 'result', 'PASS')}
                        className="w-4 h-4 accent-green-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-black">✓ ผ่าน (PASS)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name={`result_${q.id}`}
                        value="FAIL"
                        checked={q.result === 'FAIL'}
                        disabled={!isEditMode && isAlreadyPassed}
                        onChange={() => updateQuestion(q.id, 'result', 'FAIL')}
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-black">✗ ไม่ผ่าน (FAIL)</span>
                    </label>
                  </div>

                  {/* Remark input per question */}
                  <Input
                    value={q.remark}
                    disabled={!isEditMode && isAlreadyPassed}
                    onChange={(e) => updateQuestion(q.id, 'remark', e.target.value)}
                    placeholder="หมายเหตุเพิ่มเติมสำหรับข้อนี้ (ถ้ามี)"
                    className="h-8 text-xs text-black bg-white border-gray-300"
                  />
                </div>
              ))}
            </div>

            {/* Custom Question for Renovate Jobs */}
            {!isQuick && customCount < MAX_CUSTOM_QUESTIONS && isEditMode && (
              <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2 bg-gray-50/70">
                <Label className="text-black font-semibold text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มข้อคำถามหน้างานเพิ่มเติม ({customCount}/{MAX_CUSTOM_QUESTIONS} ข้อ)
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
                    <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มคำถาม
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 4. 📝 Section: หมายเหตุภาพรวม (Overall QC Remark) */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-1.5">
            <Label className="text-black font-bold text-xs">
              หมายเหตุภาพรวมการตรวจ QC (Overall Remark)
            </Label>
            <textarea
              value={overallRemark}
              disabled={!isEditMode && isAlreadyPassed}
              onChange={(e) => setOverallRemark(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2.5 h-16 text-xs text-black bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="สรุปภาพรวมการตรวจ QC เช่น ช่างปฏิบัติตามมาตรฐานงานติดตั้งเรียบร้อย ระบบทำงานได้ตามปกติ..."
            />
          </div>

          {/* 5. ⚡ Section: แถบสรุปผลและการดำเนินการ (QC Action & Outcome Bar) */}
          <div
            className={`rounded-xl p-4 border text-xs flex items-center justify-between flex-wrap gap-3 shadow-xs ${
              allPassed && allAnswered
                ? 'bg-green-50 border-green-300'
                : failedQ > 0
                ? 'bg-red-50 border-red-300'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3 text-black font-semibold flex-wrap">
              <span className="text-sm">
                ผลรวม: <span className="font-bold text-black">{passedQ}</span>/{totalQ} ผ่าน
              </span>
              {failedQ > 0 && (
                <span className="text-black bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  ⚠️ มี {failedQ} ข้อไม่ผ่าน → ส่งกลับแก้ไข (Rework)
                </span>
              )}
              {unansweredQ > 0 && (
                <span className="text-black text-xs font-medium bg-gray-200 px-2 py-0.5 rounded-full">
                  ยังไม่ตอบ {unansweredQ} ข้อ
                </span>
              )}
              {allPassed && allAnswered && (
                <span className="text-black font-bold text-sm bg-green-200/80 px-2.5 py-0.5 rounded-md">
                  คะแนนผลตรวจ: {currentRound === 1 ? '5.0' : '1.0 (รอบแก้ไข)'} / 5.0
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetAnswers}
                  className="text-black font-semibold text-xs h-8 hover:bg-gray-200"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> ล้างคำตอบ
                </Button>
              )}

              {isAlreadyPassed && !isEditMode ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                    className="text-black font-bold text-xs h-8"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> ประเมินใหม่ / แก้ไขผลตรวจ
                  </Button>
                  {onExportSTK && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={onExportSTK}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-8 px-4"
                    >
                      🚀 ส่งออก STK (Step 6)
                    </Button>
                  )}
                  <a
                    href="https://vwds.online/wds/pmt-qc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs shadow-xs transition-colors"
                    title="เปิดดูข้อมูลในระบบ WDS (vwds.online/wds/pmt-qc)"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>ดูใน WDS ↗</span>
                  </a>
                </div>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!allAnswered}
                  className={`font-bold text-white h-8 text-xs px-4 cursor-pointer ${
                    !allAnswered
                      ? 'bg-gray-400 opacity-60 cursor-not-allowed text-black'
                      : allPassed
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {!allAnswered
                    ? `กรุณาตอบให้ครบ (เหลือ ${unansweredQ} ข้อ)`
                    : allPassed
                    ? '✅ ยืนยันบันทึกผลผ่าน QC'
                    : '🔄 ยืนยันส่งกลับแก้ไข (Rework)'}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* 6. 📜 Section: ประวัติการตรวจย้อนหลัง (Rework History) */}
        {reworkHistory.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-2">
            <h4 className="font-bold text-black text-xs flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-black" /> ประวัติการตรวจย้อนหลัง ({reworkHistory.length} รอบ)
            </h4>
            <div className="space-y-1.5">
              {reworkHistory.map((r, i) => (
                <div
                  key={r.round || i}
                  className="text-xs text-black bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">รอบที่ {r.round || i + 1}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold border text-[11px] ${
                        r.outcome === 'PASS' || r.result === 'PASS'
                          ? 'bg-green-100 border-green-400 text-black'
                          : 'bg-orange-100 border-orange-400 text-black'
                      }`}
                    >
                      {r.outcome === 'PASS' || r.result === 'PASS' ? '✓ ผ่าน (PASS)' : '🔄 ส่งแก้ไข (Rework)'}
                    </span>
                  </div>
                  <div className="text-black/80">
                    วันที่: {r.inspected_at ? formatDateTimeDMY(r.inspected_at) : '-'} · คะแนน: {typeof r.score === 'number' ? r.score.toFixed(1) : '-'} / 5.0
                    {r.inspector && ` · ผู้ตรวจ: ${r.inspector}`}
                  </div>
                  {(r.overall_remark || r.remarks) && (
                    <div className="text-black font-medium">
                      หมายเหตุ: {r.overall_remark || r.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox Dialog (Only for zoom viewing of photos) */}
        <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
          <DialogContent className="max-w-3xl bg-white p-4 text-black">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="font-bold text-sm text-black">{previewPhotoTitle || 'รูปถ่ายตรวจสอบคุณภาพ'}</span>
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
