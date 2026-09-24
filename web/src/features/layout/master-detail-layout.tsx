import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MasterDetailLayoutProps {
  masterTitle?: string;
  masterActions?: React.ReactNode;
  master: React.ReactNode;
  detail: React.ReactNode;
  hasDetail: boolean;
  className?: string;
}

export function MasterDetailLayout({
  masterTitle,
  masterActions,
  master,
  detail,
  hasDetail,
  className
}: MasterDetailLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {(masterTitle || masterActions) && (
        <div className="flex items-center justify-between mb-4">
          {masterTitle && <h1 className="text-xl font-bold text-text">{masterTitle}</h1>}
          {masterActions && <div className="flex items-center gap-2">{masterActions}</div>}
        </div>
      )}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        <div className={cn(
          "flex flex-col transition-all duration-300",
          hasDetail ? "w-1/3 min-w-[400px]" : "w-full"
        )}>
          {master}
        </div>
        
        {hasDetail && (
          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 animate-in fade-in slide-in-from-right-4">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
