import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { ScrollArea } from './scroll-area';

export interface TimePicker24Props {
  value?: string; // HH:mm format
  onChange?: (val: string) => void;
  className?: string;
}

const TimePicker24 = React.forwardRef<HTMLButtonElement, TimePicker24Props>(
  ({ value, onChange, className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    const [selectedHour, selectedMinute] = value?.split(':') || ['', ''];

    const handleHourSelect = (hr: string) => {
      const min = selectedMinute || '00';
      onChange?.(`${hr}:${min}`);
    };

    const handleMinuteSelect = (min: string) => {
      const hr = selectedHour || '00';
      onChange?.(`${hr}:${min}`);
      setIsOpen(false);
    };

    return (
      <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <PopoverPrimitive.Trigger asChild>
          <Button
            ref={ref}
            variant="secondary"
            className={cn(
              'w-[120px] justify-between text-left font-normal',
              !value && 'text-[var(--text-placeholder)]',
              className
            )}
          >
            {value ? `${value} น.` : 'HH:mm น.'}
            <Clock className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-auto rounded-md border border-[var(--border)] bg-white p-3 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          <div className="mb-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { onChange?.('08:00'); setIsOpen(false); }}>08:00</Button>
            <Button size="sm" variant="outline" onClick={() => { onChange?.('08:30'); setIsOpen(false); }}>08:30</Button>
            <Button size="sm" variant="outline" onClick={() => { onChange?.('09:00'); setIsOpen(false); }}>09:00</Button>
          </div>
          <div className="flex gap-4">
            <ScrollArea className="h-48 w-16">
              <div className="flex flex-col gap-1 pr-3">
                {hours.map((hr) => (
                  <Button
                    key={hr}
                    variant={selectedHour === hr ? 'primary' : 'ghost'}
                    size="sm"
                    className="w-full text-center"
                    onClick={() => handleHourSelect(hr)}
                  >
                    {hr}
                  </Button>
                ))}
              </div>
            </ScrollArea>
            <ScrollArea className="h-48 w-16">
              <div className="flex flex-col gap-1 pr-3">
                {minutes.map((min) => (
                  <Button
                    key={min}
                    variant={selectedMinute === min ? 'primary' : 'ghost'}
                    size="sm"
                    className="w-full text-center"
                    onClick={() => handleMinuteSelect(min)}
                  >
                    {min}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>
    );
  }
);
TimePicker24.displayName = 'TimePicker24';

export { TimePicker24 };
