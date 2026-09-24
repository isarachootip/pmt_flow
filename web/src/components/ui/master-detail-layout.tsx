import * as React from 'react';
import { cn } from '@/lib/utils';
import { Splitter } from './splitter';

export interface MasterDetailLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  pageKey: string;
  masterContent: React.ReactNode;
  detailContent: React.ReactNode;
}

const MasterDetailLayout = React.forwardRef<HTMLDivElement, MasterDetailLayoutProps>(
  ({ pageKey, masterContent, detailContent, className, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const [masterHeight, setMasterHeight] = React.useState<number>(300);

    React.useEffect(() => {
      const saved = localStorage.getItem(`pmt_master_h_${pageKey}`);
      if (saved) {
        setMasterHeight(Number(saved));
      }
    }, [pageKey]);

    const handleDrag = React.useCallback(
      (e: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        
        let clientY;
        if ('touches' in e) {
          clientY = e.touches[0].clientY;
        } else {
          clientY = e.clientY;
        }

        const newHeight = clientY - containerRect.top;
        const minMasterHeight = 120;
        const minDetailHeight = 200;
        const maxMasterHeight = containerRect.height - minDetailHeight;

        if (newHeight >= minMasterHeight && newHeight <= maxMasterHeight) {
          setMasterHeight(newHeight);
        }
      },
      []
    );

    const handleDragEnd = React.useCallback(() => {
      localStorage.setItem(`pmt_master_h_${pageKey}`, masterHeight.toString());
    }, [pageKey, masterHeight]);

    return (
      <div
        ref={containerRef}
        className={cn('flex h-full flex-col overflow-hidden', className)}
        {...props}
      >
        <div style={{ height: `${masterHeight}px` }} className="min-h-[120px] w-full shrink-0">
          {masterContent}
        </div>
        <Splitter onDragMove={handleDrag} onDragEnd={handleDragEnd} />
        <div className="flex-1 min-h-[200px] w-full overflow-hidden">
          {detailContent}
        </div>
      </div>
    );
  }
);
MasterDetailLayout.displayName = 'MasterDetailLayout';

export { MasterDetailLayout };
