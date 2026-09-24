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
}

const defaultSlots: PhotoSlot[] = [
  { id: 'before', label: 'ก่อนเริ่ม' },
  { id: 'progress1', label: 'ระหว่างทำ 1' },
  { id: 'progress2', label: 'ระหว่างทำ 2' },
  { id: 'test', label: 'ทดสอบ' },
  { id: 'after', label: 'เสร็จ' },
];

const PhotoSlots5 = React.forwardRef<HTMLDivElement, PhotoSlots5Props>(
  ({ slots = defaultSlots, onUpload, className, ...props }, ref) => {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
      const file = e.target.files?.[0];
      if (file && onUpload) {
        onUpload(slotId, file);
      }
    };

    return (
      <div ref={ref} className={cn('grid grid-cols-2 gap-4 md:grid-cols-5', className)} {...props}>
        {slots.map((slot) => (
          <div key={slot.id} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-black">{slot.label}</span>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] border-2 border-dashed border-[var(--border)] bg-[var(--bg-subtle)] transition-colors hover:border-[var(--primary)]">
              {slot.url ? (
                <>
                  <img src={slot.url} alt={slot.label} className="h-full w-full object-cover" />
                  <button
                    onClick={() => setPreviewUrl(slot.url || null)}
                    className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center text-[var(--text-placeholder)] hover:text-[var(--primary)]">
                  <Camera className="mb-2 h-6 w-6" />
                  <span className="text-xs">อัพโหลดรูป</span>
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
          <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="h-auto w-full rounded-lg object-contain" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);
PhotoSlots5.displayName = 'PhotoSlots5';

export { PhotoSlots5 };
