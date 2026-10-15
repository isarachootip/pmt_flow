import { Button } from '@/components/ui/button';
import { CheckCircle2, X, Loader2 } from 'lucide-react';

export interface OrdersBulkBarProps {
  selectedCount: number;
  isAccepting: boolean;
  onAcceptAll: () => void;
  onClearSelection: () => void;
}

export function OrdersBulkBar({
  selectedCount,
  isAccepting,
  onAcceptAll,
  onClearSelection
}: OrdersBulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 bg-white border border-gray-300 rounded-2xl px-4 py-2.5 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-xs font-bold text-black">
            เลือกแล้ว <span className="text-blue-700 font-mono font-extrabold text-sm">{selectedCount}</span> รายการ
          </span>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        <Button
          size="sm"
          onClick={onAcceptAll}
          disabled={isAccepting}
          className="h-8 px-3.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
        >
          {isAccepting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              <span>กำลังรับงาน...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>รับงาน ({selectedCount})</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isAccepting}
          className="h-8 px-2 text-xs text-black font-semibold hover:bg-gray-100 flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5 text-black" />
          <span>ยกเลิก</span>
        </Button>
      </div>
    </div>
  );
}
