import * as React from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface OrdersIntSyncIndicatorProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function OrdersIntSyncIndicator({ onRefresh, isRefreshing }: OrdersIntSyncIndicatorProps) {
  const [lastSyncTime, setLastSyncTime] = React.useState<string>(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });

  const handleManualRefresh = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    setLastSyncTime(`${h}:${m}`);
    onRefresh();
  };

  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-black bg-emerald-50/70 border border-emerald-300 px-2 py-0.5 rounded-lg shadow-2xs">
      <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      <span className="whitespace-nowrap">
        ซิงค์ INT ล่าสุด <span className="font-mono font-bold text-black">{lastSyncTime} น.</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="h-6 w-6 p-0 hover:bg-emerald-100 rounded-md text-emerald-800"
        title="รีเฟรชคิวงาน INT"
      >
        <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
