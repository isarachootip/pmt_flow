import * as React from 'react';
import { cn } from '@/lib/utils';
import { Splitter } from './splitter';

export interface MasterDetailLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  pageKey: string;
  masterContent: React.ReactNode;
  detailContent: React.ReactNode;
  defaultMasterHeight?: number;
  orientation?: 'horizontal' | 'vertical';
  defaultSplitRatio?: number; // e.g. 0.55 for 55% master / 45% detail
  minMasterRatio?: number;
  minDetailRatio?: number;
}

const MasterDetailLayout = React.forwardRef<HTMLDivElement, MasterDetailLayoutProps>(
  (
    {
      pageKey,
      masterContent,
      detailContent,
      defaultMasterHeight = 300,
      orientation = 'horizontal',
      defaultSplitRatio = 0.55,
      minMasterRatio = 0.25,
      minDetailRatio = 0.25,
      className,
      ...props
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const isVertical = orientation === 'vertical';

    // For horizontal (top/bottom): masterHeight in px
    const [masterHeight, setMasterHeight] = React.useState<number>(defaultMasterHeight);

    // For vertical (left/right): masterRatio (0.0 - 1.0)
    const [masterRatio, setMasterRatio] = React.useState<number>(defaultSplitRatio);

    React.useEffect(() => {
      try {
        if (isVertical) {
          const savedRatio = localStorage.getItem(`pmt_master_ratio_${pageKey}`);
          if (savedRatio) {
            const val = parseFloat(savedRatio);
            if (!isNaN(val) && val >= minMasterRatio && val <= 1 - minDetailRatio) {
              setMasterRatio(val);
              return;
            }
          }
          setMasterRatio(defaultSplitRatio);
        } else {
          const saved = localStorage.getItem(`pmt_master_h_${pageKey}`);
          if (saved) {
            const val = Number(saved);
            if (!isNaN(val) && val >= 120 && val <= 500) {
              setMasterHeight(val);
              return;
            }
          }
          if (defaultMasterHeight) {
            setMasterHeight(defaultMasterHeight);
          }
        }
      } catch {
        // localStorage error boundary
      }
    }, [pageKey, isVertical, defaultMasterHeight, defaultSplitRatio, minMasterRatio, minDetailRatio]);

    const handleDrag = React.useCallback(
      (e: MouseEvent | TouchEvent) => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();

        if (isVertical) {
          let clientX: number;
          if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
          } else if ('clientX' in e) {
            clientX = (e as MouseEvent).clientX;
          } else {
            return;
          }

          const containerWidth = containerRect.width;
          if (containerWidth <= 0) return;

          const newMasterWidth = clientX - containerRect.left;
          const ratio = Math.max(minMasterRatio, Math.min(1 - minDetailRatio, newMasterWidth / containerWidth));
          setMasterRatio(ratio);
        } else {
          let clientY: number;
          if ('touches' in e && e.touches.length > 0) {
            clientY = e.touches[0].clientY;
          } else if ('clientY' in e) {
            clientY = (e as MouseEvent).clientY;
          } else {
            return;
          }

          const newHeight = clientY - containerRect.top;
          const minMasterHeight = 120;
          const minDetailHeight = 200;
          const maxMasterHeight = containerRect.height - minDetailHeight;

          if (newHeight >= minMasterHeight && newHeight <= maxMasterHeight) {
            setMasterHeight(newHeight);
          }
        }
      },
      [isVertical, minMasterRatio, minDetailRatio]
    );

    const handleDragEnd = React.useCallback(() => {
      try {
        if (isVertical) {
          localStorage.setItem(`pmt_master_ratio_${pageKey}`, masterRatio.toString());
        } else {
          localStorage.setItem(`pmt_master_h_${pageKey}`, masterHeight.toString());
        }
      } catch {
        // localStorage error boundary
      }
    }, [pageKey, isVertical, masterRatio, masterHeight]);

    if (isVertical) {
      return (
        <div
          ref={containerRef}
          className={cn('flex h-full w-full flex-row overflow-hidden', className)}
          {...props}
        >
          <div
            style={{ width: `${(masterRatio * 100).toFixed(2)}%` }}
            className="min-w-[280px] h-full shrink-0 overflow-hidden"
          >
            {masterContent}
          </div>
          <Splitter orientation="vertical" onDragMove={handleDrag} onDragEnd={handleDragEnd} />
          <div className="flex-1 min-w-[320px] h-full overflow-hidden">
            {detailContent}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={cn('flex h-full flex-col overflow-hidden', className)}
        {...props}
      >
        <div style={{ height: `${masterHeight}px` }} className="min-h-[120px] w-full shrink-0">
          {masterContent}
        </div>
        <Splitter orientation="horizontal" onDragMove={handleDrag} onDragEnd={handleDragEnd} />
        <div className="flex-1 min-h-[200px] w-full overflow-hidden">
          {detailContent}
        </div>
      </div>
    );
  }
);
MasterDetailLayout.displayName = 'MasterDetailLayout';

export { MasterDetailLayout };
