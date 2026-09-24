import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SplitterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDragStart' | 'onDrag' | 'onDragEnd'> {
  onDragStart?: () => void;
  onDragMove?: (e: MouseEvent | TouchEvent) => void;
  onDragEnd?: () => void;
}

const Splitter = React.forwardRef<HTMLDivElement, SplitterProps>(
  ({ onDragStart, onDragMove, onDragEnd, className, ...props }, ref) => {
    const isDragging = React.useRef(false);

    const handlePointerDown = () => {
      isDragging.current = true;
      document.body.style.cursor = 'row-resize';
      onDragStart?.();

      const handlePointerMove = (ev: MouseEvent | TouchEvent) => {
        if (isDragging.current) {
          onDragMove?.(ev);
        }
      };

      const handlePointerUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
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
          'group relative flex h-4 w-full cursor-row-resize items-center justify-center bg-transparent',
          className
        )}
        {...props}
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border)] group-hover:bg-[var(--primary)]" />
        <div className="relative h-1 w-12 rounded-full bg-[var(--border)] group-hover:bg-[var(--primary)]" />
      </div>
    );
  }
);
Splitter.displayName = 'Splitter';

export { Splitter };
