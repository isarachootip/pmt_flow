import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PipelineStepperProps extends React.HTMLAttributes<HTMLDivElement> {
  currentStep: number;
  quickService?: boolean;
}

const steps = [
  { id: 1, label: 'รับเรื่อง' },
  { id: 2, label: 'สำรวจ' },
  { id: 3, label: 'ออกแบบ' },
  { id: 4, label: 'BOQ' },
  { id: 5, label: 'ดำเนินการ' },
  { id: 6, label: 'ส่งมอบ' },
];

const PipelineStepper = React.forwardRef<HTMLDivElement, PipelineStepperProps>(
  ({ currentStep, quickService, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('flex w-full items-center', className)} {...props}>
        {steps.map((step, index) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isFuture = step.id > currentStep;
          const isSkipped = quickService && step.id > 1 && step.id < 5;

          return (
            <React.Fragment key={step.id}>
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold',
                    isDone && !isSkipped && 'border-[var(--st-done)] bg-[var(--st-done)] text-white',
                    isCurrent && !isSkipped && 'border-[var(--primary)] bg-[var(--primary)] text-white',
                    isFuture && !isSkipped && 'border-[var(--border)] bg-white text-[var(--text-placeholder)]',
                    isSkipped && 'border-dashed border-[var(--border)] bg-[var(--bg-subtle)] text-transparent'
                  )}
                >
                  {isDone && !isSkipped ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span
                  className={cn(
                    'absolute top-9 whitespace-nowrap text-xs font-medium',
                    isCurrent ? 'text-[var(--primary)]' : 'text-[var(--text-secondary)]',
                    isSkipped && 'opacity-50 line-through'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-[2px] flex-1 mx-2',
                    isDone ? 'bg-[var(--st-done)]' : 'bg-[var(--border)]',
                    (quickService && index > 0 && index < 4) && 'border-t-2 border-dashed border-[var(--border)] bg-transparent'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);
PipelineStepper.displayName = 'PipelineStepper';

export { PipelineStepper };
