import * as React from 'react';
import { Camera, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from './dialog';

export interface PhotoSlot {
  id: string;
  label: string;
  url?: string;
}

export interface PhotoSlots5Props extends React.HTMLAttributes<HTMLDivElement> {
  slots?: PhotoSlot[];
  onUpload?: (slotId: string, file: File) => void;
  readOnly?: boolean;
}

const defaultSlots: PhotoSlot[] = [
  { id: 'before', label: 'ก่อนเริ่ม' },
  { id: 'progress1', label: 'ระหว่างทำ 1' },
  { id: 'progress2', label: 'ระหว่างทำ 2' },
  { id: 'test', label: 'ทดสอบ' },
  { id: 'after', label: 'เสร็จ' },
];

const PhotoSlots5 = React.forwardRef<HTMLDivElement, PhotoSlots5Props>(
  ({ slots = defaultSlots, onUpload, readOnly = false, className, ...props }, ref) => {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
      if (readOnly) return;
      const file = e.target.files?.[0];
      if (file && onUpload) {
        onUpload(slotId, file);
      }
    };

    const activeSlot = slots.find((s) => s.url === previewUrl);

    return (
      <div ref={ref} className={cn('grid grid-cols-2 gap-3 md:grid-cols-5', className)} {...props}>
        {slots.map((slot) => (
          <div key={slot.id} className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-black truncate">{slot.label}</span>
            <div
              onClick={() => {
                if (slot.url) {
                  setPreviewUrl(slot.url);
                }
              }}
              title={slot.url ? 'คลิกเพื่อขยายดูรูปขนาดเต็ม' : undefined}
              className={cn(
                'group relative h-24 sm:h-28 w-full overflow-hidden rounded-xl border transition-all duration-200',
                slot.url
                  ? 'border-gray-200 bg-gray-900 cursor-pointer shadow-2xs hover:border-[var(--primary)] hover:shadow-md'
                  : readOnly
                  ? 'border-gray-200 bg-gray-50/80 cursor-default'
                  : 'border-dashed border-[var(--border)] hover:border-[var(--primary)] bg-[var(--bg-subtle)] hover:bg-[var(--primary)]/5'
              )}
            >
              {slot.url ? (
                <>
                  <img
                    src={slot.url}
                    alt={slot.label}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Subtle hover overlay to indicate click-to-expand */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold pointer-events-none">
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>คลิกดูรูปใหญ่</span>
                  </div>
                  {/* Maximize button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewUrl(slot.url || null);
                    }}
                    className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/90 cursor-pointer shadow-sm z-10"
                    title="คลิกเพื่อดูรูปภาพขนาดเต็ม"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : readOnly ? (
                <div className="flex h-full w-full flex-col items-center justify-center text-gray-400 bg-gray-50/80 cursor-default select-none p-1">
                  <Camera className="mb-1 h-4 w-4 text-gray-400" />
                  <span className="text-[11px] text-gray-500 font-medium">ไม่มีรูปภาพ</span>
                </div>
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center text-[var(--text-placeholder)] hover:text-[var(--primary)] transition-colors p-1 group">
                  <Camera className="mb-1 h-5 w-5 text-gray-400 group-hover:text-[var(--primary)] transition-colors" />
                  <span className="text-xs font-semibold text-black">อัพโหลดรูป</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, slot.id)}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
        <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl border border-white/10 bg-black/95 p-3 sm:p-4 shadow-2xl rounded-2xl text-white backdrop-blur-md [&>button]:text-white [&>button]:opacity-80 [&>button:hover]:opacity-100 [&>button]:z-20">
            {previewUrl && (
              <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full flex items-center justify-between px-1 pb-1.5 border-b border-white/10">
                  <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" />
                    {activeSlot?.label || 'รูปถ่ายการปฏิบัติงาน'}
                  </span>
                  <span className="text-[11px] text-white/50 pr-8 hidden sm:inline">
                    คลิกนอกกรอบหรือกด Esc เพื่อปิด
                  </span>
                </div>
                <div className="relative mt-1 flex max-h-[80vh] w-full items-center justify-center overflow-hidden rounded-xl bg-black">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-auto max-h-[75vh] w-full rounded-lg object-contain"
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);
PhotoSlots5.displayName = 'PhotoSlots5';

export { PhotoSlots5 };
