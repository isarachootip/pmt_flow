import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SplitterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  orientation?: 'horizontal' | 'vertical';
  onDragStart?: () => void;
  onDragMove?: (e: MouseEvent | TouchEvent) => void;
  onDragEnd?: () => void;
}

const Splitter = React.forwardRef<HTMLDivElement, SplitterProps>(
  ({ orientation = 'horizontal', onDragStart, onDragMove, onDragEnd, className, ...props }, ref) => {
    const isDragging = React.useRef(false);
    const isVertical = orientation === 'vertical';

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      onDragStart?.();

      const handlePointerMove = (ev: MouseEvent | TouchEvent) => {
        if (isDragging.current) {
          onDragMove?.(ev);
        }
      };

      const handlePointerUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onDragEnd?.();
        document.removeEventListener('mousemove', handlePointerMove);
        document.removeEventListener('touchmove', handlePointerMove);
        document.removeEventListener('mouseup', handlePointerUp);
        document.removeEventListener('touchend', handlePointerUp);
      };

      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('touchmove', handlePointerMove, { passive: false });
      document.addEventListener('mouseup', handlePointerUp);
      document.addEventListener('touchend', handlePointerUp);
    };

    return (
      <div
        ref={ref}
        onPointerDown={handlePointerDown}
        className={cn(
          'group relative flex items-center justify-center bg-transparent select-none z-10',
          isVertical
            ? 'w-2.5 min-w-[10px] h-full cursor-col-resize hover:bg-[var(--primary-soft)]/40 transition-colors'
            : 'h-2.5 min-h-[10px] w-full cursor-row-resize hover:bg-[var(--primary-soft)]/40 transition-colors',
          className
        )}
        {...props}
      >
        {isVertical ? (
          <>
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border)] group-hover:bg-[var(--primary)]" />
            <div className="relative w-1 h-12 rounded-full bg-[var(--border)] group-hover:bg-[var(--primary)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border)] group-hover:bg-[var(--primary)]" />
            <div className="relative h-1 w-12 rounded-full bg-[var(--border)] group-hover:bg-[var(--primary)]" />
          </>
        )}
      </div>
    );
  }
);
Splitter.displayName = 'Splitter';

export { Splitter };
