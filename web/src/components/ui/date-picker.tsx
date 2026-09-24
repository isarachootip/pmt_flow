import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Button } from './button';
import { formatDMY, parseDMY, toISODate } from '@/lib/date';

export interface DatePickerProps {
  value?: string; // ISO date YYYY-MM-DD
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
  ({ value, onChange, placeholder = 'DD/MM/YYYY', className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(
      value ? formatDMY(new Date(value)) : ''
    );
    const [month, setMonth] = React.useState<Date>(
      value ? new Date(value) : new Date()
    );

    React.useEffect(() => {
      if (value) {
        setInputValue(formatDMY(new Date(value)));
        setMonth(new Date(value));
      } else {
        setInputValue('');
      }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      const parsedDate = parseDMY(val);
      if (parsedDate) {
        setMonth(parsedDate);
        onChange?.(toISODate(parsedDate));
      }
    };

    const handleSelect = (date: Date | undefined) => {
      if (date) {
        setInputValue(formatDMY(date));
        onChange?.(toISODate(date));
        setIsOpen(false);
      }
    };

    const setPreset = (daysOffset: number) => {
      const date = new Date();
      date.setDate(date.getDate() + daysOffset);
      setInputValue(formatDMY(date));
      onChange?.(toISODate(date));
      setMonth(date);
      setIsOpen(false);
    };

    return (
      <div className={cn('relative', className)} ref={ref}>
        <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
          <div className="relative">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="pr-10"
            />
            <PopoverPrimitive.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-[var(--text-secondary)] hover:text-black"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverPrimitive.Trigger>
          </div>
          <PopoverPrimitive.Content
            align="start"
            className="z-50 rounded-md border border-[var(--border)] bg-white p-3 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          >
            <div className="mb-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreset(0)}>
                วันนี้
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset(1)}>
                พรุ่งนี้
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreset(7)}>
                สัปดาห์นี้
              </Button>
            </div>
            <DayPicker
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Root>
      </div>
    );
  }
);
DatePicker.displayName = 'DatePicker';

export { DatePicker };
