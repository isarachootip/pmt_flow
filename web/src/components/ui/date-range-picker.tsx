import * as React from 'react';
import { DatePicker } from './date-picker';
import { cn } from '@/lib/utils';

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (val: string) => void;
  onEndDateChange?: (val: string) => void;
  className?: string;
}

const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  (
    { startDate, endDate, onStartDateChange, onEndDateChange, className },
    ref
  ) => {
    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)}>
        <DatePicker
          value={startDate}
          onChange={onStartDateChange}
          placeholder="DD/MM/YYYY"
        />
        <span className="text-sm text-[var(--text-secondary)]">ถึง</span>
        <DatePicker
          value={endDate}
          onChange={onEndDateChange}
          placeholder="DD/MM/YYYY"
        />
      </div>
    );
  }
);
DateRangePicker.displayName = 'DateRangePicker';

export { DateRangePicker };
