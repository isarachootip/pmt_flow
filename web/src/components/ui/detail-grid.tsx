import * as React from 'react';
import { Maximize2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { KpiChips, KpiChip } from './kpi-chips';

export interface DetailGridProps extends React.HTMLAttributes<HTMLDivElement> {
  jobInfoTitle: string;
  tabs: KpiChip[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  onAddRow?: () => void;
  onOpenFull?: () => void;
  children: React.ReactNode;
}

const DetailGrid = React.forwardRef<HTMLDivElement, DetailGridProps>(
  (
    { jobInfoTitle, tabs, activeTab, onTabChange, onAddRow, onOpenFull, children, className, ...props },
    ref
  ) => {
    return (
      <div ref={ref} className={cn('flex h-full flex-col bg-white', className)} {...props}>
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[var(--bg-subtle)] px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-black">{jobInfoTitle}</span>
            <KpiChips chips={tabs} activeId={activeTab} onSelect={onTabChange} />
          </div>
          <div className="flex items-center gap-2">
            {onAddRow && (
              <Button size="sm" onClick={onAddRow}>
                <Plus className="mr-1 h-4 w-4" />
                เพิ่ม
              </Button>
            )}
            {onOpenFull && (
              <Button variant="secondary" size="sm" onClick={onOpenFull}>
                <Maximize2 className="mr-1 h-4 w-4" />
                เปิดเต็มหน้า
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          {children}
        </div>
      </div>
    );
  }
);
DetailGrid.displayName = 'DetailGrid';

export { DetailGrid };
